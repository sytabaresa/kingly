import {
  everyTransition, findInitTransition, getAncestorMap, getEventTransitionsMaps, getHistoryStatesMap,
  getHistoryUnderlyingState, getStatesPath, getStatesTransitionsMap, getStatesTransitionsMaps, getStatesType,
  getTargetStatesMap,
  isActionFactory, isControlState, isEvent, isFunction, isHistoryControlState
} from "./helpers"
import { objectTreeLenses, PRE_ORDER, traverseObj } from "fp-rosetree"
import { ACTION_IDENTITY, INIT_EVENT, INIT_STATE } from "./properties"

// Contracts

// S2. State names must be unique
export const noDuplicatedStates = {
  name: 'noDuplicatedStates',
  shouldThrow: false,
  predicate: (fsmDef, settings) => {
    const { getLabel } = objectTreeLenses;
    const traverse = {
      strategy: PRE_ORDER,
      seed: { duplicatedStates: [], statesHashMap: {} },
      visit: (acc, traversalState, tree) => {
        const { duplicatedStates, statesHashMap } = acc;
        const treeLabel = getLabel(tree);
        const controlState = Object.keys(treeLabel)[0];
        if (controlState in statesHashMap) {
          return {
            duplicatedStates: duplicatedStates.concat(controlState),
            statesHashMap
          }
        }
        else {
          return {
            duplicatedStates,
            statesHashMap: (statesHashMap[controlState] = "", statesHashMap)
          }
        }
      }
    }

    const { duplicatedStates } = traverseObj(traverse, fsmDef.states);

    const isFulfilled = duplicatedStates.length === 0;
    return {
      isFulfilled,
      blame: {
        message: `State names must be unique! Found duplicated state names. Cf. log`,
        info: { duplicatedStates }
      }
    }
  },
};

// S1. State name cannot be a reserved state name (for now only INIT_STATE)
export const noReservedStates = {
  name: 'noReservedStates',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesType }) => {
    return {
      isFulfilled: Object.keys(statesType).indexOf(INIT_STATE) === -1,
      blame: {
        message: `You cannot use a reserved control state name for any of the configured control states for the machine! Cf. log`,
        info: { reservedStates: [INIT_STATE], statesType }
      }
    }
  },
};

// S4. At least one control state (other than the initial state) muat be declared
export const atLeastOneState = {
  name: 'atLeastOneState',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesType }) => {
    return {
      isFulfilled: Object.keys(statesType).length > 0,
      blame: {
        message: `Machine configuration must define at least one control state! Cf. log`,
        info: { statesType }
      }
    }
  },
};

// S5. check initial control state is a defined state in states
export const isInitialControlStateDeclared = {
  name: 'isInitialControlStateDeclared',
  shouldThrow: false,
  predicate: (fsmDef, settings, { initTransition , statesType}) => {
    const { initialControlState, transitions } = fsmDef;
    const stateList = Object.keys(statesType);
    if (initialControlState) {
      return {
        isFulfilled: stateList.indexOf(initialControlState) > -1,
        blame: {
          message: `Configured initial control state must be a declared state. Cf. log`,
          info: { initialControlState, states: stateList }
        }
      }
    }
    else {
      return {
        isFulfilled: true,
        blame: void 0
      }
    }

  },
};

// E0. `fsmDef.events` msut be an array of strings
export const eventsAreStrings = {
  name: 'eventsAreStrings',
  shouldThrow: false,
  predicate: (fsmDef, settings) => {
    return {
      isFulfilled: fsmDef.events.every(x => typeof x === 'string'),
      blame: {
        message: `Events must be an array of strings!`,
        info: { events: fsmDef.events }
      }
    }
  },
};

export const validInitialConfig = {
  name: 'validInitialConfig',
  shouldThrow: false,
  predicate: (fsmDef, settings, { initTransition }) => {
    const { initialControlState, transitions } = fsmDef;

    if (initTransition && initialControlState) {
      return {
        isFulfilled: false,
        blame: {
          message: `Invalid machine configuration : defining an initial control state and an initial transition at the same time may lead to ambiguity and is forbidden!`,
          info: { initialControlState, initTransition }
        }
      }
    }
    else if (!initTransition && !initialControlState) {
      return {
        isFulfilled: false,
        blame: {
          message: `Invalid machine configuration : you must define EITHER an initial control state OR an initial transition! Else in which state is the machine supposed to start?`,
          info: { initialControlState, initTransition }
        }
      }
    }
    else return {
        isFulfilled: true,
        blame: void 0
      }
  },
};

// T1. There must be configured at least one transition away from the initial state
// T2. A transition away from the initial state can only be triggered by the initial event
// T7b. The initial state must have a valid transition INIT_STATE -INIT-> defined which does not have a history
// state as target
// TODO : test it
// T23. We allow conditional initial transitions, but what about the action ? should it be always identity? We
// can't run any actions. We can update internal state, but we can't trace it, so we loose tracing properties and
// debugging!. So enforce ACTIONS to be identity
export const validInitialTransition = {
  name: 'validInitialTransition',
  shouldThrow: false,
  predicate: (fsmDef, settings, { initTransition }) => {
    const { initialControlState, transitions } = fsmDef;
    const initTransitions = transitions.reduce((acc, transition) => {
      transition.from === INIT_STATE && acc.push(transition);
      return acc
    }, []);
    // DOC : or not, we allow conditional init transitions!! allow to set the initial state depending on settings!
    const isFulfilled =
      (initialControlState && !initTransition) ||
      (!initialControlState && initTransition && initTransitions.length === 1 && initTransition.event === INIT_EVENT
        && (
          isInconditionalTransition(initTransition) && initTransition.actions === ACTION_IDENTITY
          || areCconditionalTransitions(initTransition) && initTransition.guards.every(guard =>
            guard.actions === ACTION_IDENTITY
          )
        )
      );

    return {
      isFulfilled,
      blame: {
        message: `Invalid configuration for initial transition! Cf. log`,
        info: { initTransition, initTransitions, initialControlState }
      }
    }
  },
};

// T15. Init transitions can only occur from compound states or the initial state, i.e. A -INIT-> B iff A is a compound
// state or A is the initial state
export const initEventOnlyInCompoundStates = {
  name: 'initEventOnlyInCompoundStates',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesTransitionsMap, statesType, statesPath }) => {
    // The compound states below does not include the initial state by construction
    const atomicStates = Object.keys(statesType).filter(controlState => !statesType[controlState]);
    const atomicInitTransitions = atomicStates.map(
      atomicState => ({
        [atomicState]: statesTransitionsMap[atomicState] && statesTransitionsMap[atomicState][INIT_EVENT]
      })
    ).filter(obj => Object.values(obj)[0]);

    const hasInitEventOnlyInCompoundStates = atomicInitTransitions.length === 0

    return {
      isFulfilled: hasInitEventOnlyInCompoundStates,
      blame: {
        message: `Found at least one atomic state with an entry transition! That is forbidden! Cf. log`,
        info: { initTransitions: atomicInitTransitions }
      }
    }
  },
};

// T5. Every compound state NOT the initial state A must have a valid transition A -INIT-> defined
// T6. Every compound state NOT the initial state must have a valid INCONDITIONAL transition A -INIT-> defined
// T7a. Every compound state NOT the initial state must have a valid INCONDITIONAL transition A -INIT-> defined which
// does not have a history state as target
// NOTE: actually we could limit it to history state of the containing compound state to avoid infinity loop
// T8. Every compound state NOT the initial state must have a valid INCONDITIONAL transition A -INIT-> defined which
// does not have the history state as target and has a target control state that is one of its substates (no
// out-of-hierarchy INIT transitions)
export const validInitialTransitionForCompoundState = {
  name: 'validInitialTransitionForCompoundState',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesTransitionsMap, statesType, statesPath }) => {
    // The compound states below does not include the initial state by construction
    const compoundStates = Object.keys(statesType).filter(controlState => statesType[controlState]);
    const initTransitions = compoundStates.map(
      compoundState => statesTransitionsMap[compoundState] && statesTransitionsMap[compoundState][INIT_EVENT]);

    const allHaveInitTransitions = initTransitions.every(Boolean);

    if (!allHaveInitTransitions) {
      return {
        isFulfilled: false,
        blame: {
          message: `Found at least one compound state without an entry transition! Cf. log`,
          info: {
            hasEntryTransitions: compoundStates.map(
              state => ({ [state]: !!(statesTransitionsMap[state] && statesTransitionsMap[state][INIT_EVENT]) }))
          }
        }
      }
    }

    const allHaveValidInitTransitions = allHaveInitTransitions &&
      initTransitions.every(initTransition => {
        const { guards, to } = initTransition;
        // T6 and T7a
        return !guards && typeof to === 'string'
      });
    if (!allHaveValidInitTransitions) {
      return {
        isFulfilled: false,
        blame: {
          message: `Found at least one compound state with an invalid entry transition! Entry transitions for compound states must be inconditional and the associated target control state cannot be a history pseudo-state. Cf. log`,
          info: { entryTransitions: initTransitions }
        }
      }
    }
    ;

    const allHaveTargetStatesWithinHierarchy = allHaveValidInitTransitions &&
      initTransitions.every(initTransition => {
        const { from, to } = initTransition;

        // Don't forget to also eliminate the case when from = to
        // Also note that wwe check that `to` is in statesPath as one is derived from states in transitions, and the
        // other from declared states
        return from !== to && statesPath[to] && statesPath[to].startsWith(statesPath[from])
      });
    if (!allHaveTargetStatesWithinHierarchy) {
      return {
        isFulfilled: false,
        blame: {
          message: `Found at least one compound state with an invalid entry transition! Entry transitions for compound states must have a target state which is strictly below the compound state in the state hierarchy! `,
          info: { states: fsmDef.states, statesPath, entryTransitions: initTransitions }
        }
      }
    }

    return {
      isFulfilled: true,
      blame: void 0
    }
  },
};

// T11. If there is an eventless transition A -eventless-> B, there cannot be a competing A -ev-> X
// TODO : test it
// T24. Check that we have this implicitly : Compound states must not have eventless transitions
// defined on them (would introduce ambiguity with the INIT transition).
export const validEventLessTransitions = {
  name: 'validEventLessTransitions',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesTransitionsMap, statesType, statesPath }) => {
    // The compound states below does not include the initial state by construction
    const stateList = Object.keys(statesType);
    const failingOriginControlStates = stateList.map(state => {
      return {
        [state]: statesTransitionsMap[state] &&
        `${void 0}` in statesTransitionsMap[state] &&
        Object.keys(statesTransitionsMap[state]).length !== 1
      }
    }).filter(obj => Object.values(obj)[0] !== void 0 && Object.values(obj)[0]);

    const isFulfilled = failingOriginControlStates.length === 0;

    return {
      isFulfilled,
      blame: {
        message: `Found at least one control state without both an eventless transition and a competing transition! Cf. log`,
        info: { failingOriginControlStates }
      }
    }
  },
};

// T12. All transitions A -ev-> * must have the same transition index, i.e. all associated guards must be together
// in a single array and there cannot be two transition rows showcasing A -ev-> * transitions
export const allStateTransitionsOnOneSingleRow = {
  name: 'allStateTransitionsOnOneSingleRow',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesTransitionsMaps }) => {
    const stateList = Object.keys(statesTransitionsMaps);
    const statesTransitionsInfo = stateList.reduce((acc, state) => {
      const events = Object.keys(statesTransitionsMaps[state]);
      const wrongEventConfig = events.filter(event => statesTransitionsMaps[state][event].length > 1);
      if (wrongEventConfig.length > 0) {
        acc[state] = wrongEventConfig;
      }

      return acc
    }, {});

    const isFulfilled = Object.keys(statesTransitionsInfo).length === 0;

    return {
      isFulfilled,
      blame: {
        message: `Found at least one control state and one event for which the associated transition are not condensated under a unique row! Cf. log`,
        info: { statesTransitionsInfo }
      }
    }
  },
};

// T14. Conflicting transitions are not allowed, i.e. A -ev-> B and A < OUTER_A is not compatible with OUTER_A
// -ev->C. The event `ev` could trigger a transition towards either B or C
export const noConflictingTransitionsWithAncestorState = {
  name: 'noConflictingTransitionsWithAncestorState',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesTransitionsMaps, eventTransitionsMaps, ancestorMap }) => {
    const eventList = Object.keys(eventTransitionsMaps);
    const eventTransitionsInfo = eventList.reduce((acc, event) => {
      const states = Object.keys(eventTransitionsMaps[event]);
      // The wrongly configured states are those which have an ancestor also in the transition map for the same event
      const wrongStateConfig = states
        .filter(state => state !== INIT_STATE)
        .map(state => ancestorMap[state] && {
          [state]: ancestorMap[state].find(
            ancestorState => states.indexOf(ancestorState) > -1
          )
        })
        // removing cases : undefined and {[state]: undefined}
        .filter(obj => {
          return obj && Object.values(obj).filter(Boolean).length > 0
        })
      ;
      if (wrongStateConfig.length > 0) {
        acc[event] = wrongStateConfig;
      }

      return acc
    }, {});

    const isFulfilled = Object.keys(eventTransitionsInfo).length === 0;

    return {
      isFulfilled,
      blame: {
        message: `Found two conflicting transitions! A -ev-> X, and B -ev-> Y leads to ambiguity if A < B or B < A. Cf. log`,
        info: { eventTransitionsInfo }
      }
    }
  },
};

// T16.a History states must be target states
export const isHistoryStatesTargetStates = {
  name: 'isHistoryStatesTargetStates',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesTransitionsMaps }) => {
    const wrongHistoryStates = fsmDef.transitions.reduce((acc, transition) => {
      return isHistoryControlState(transition.from)
        ? acc.concat(transition)
        : acc
    }, []);

    const isFulfilled = Object.keys(wrongHistoryStates).length === 0;

    return {
      isFulfilled,
      blame: {
        message: `Found a history pseudo state configured as the origin control state for a transition. History pseudo states should only be target control states. Cf. log`,
        info: { wrongHistoryStates }
      }
    }
  },
};

// T16.b History states must be compound states
export const isHistoryStatesCompoundStates = {
  name: 'isHistoryStatesCompoundStates',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesTransitionsMaps, statesType }) => {
    const stateList = Object.keys(statesTransitionsMaps);
    const wrongHistoryStates = stateList.map(originState => {
      if (originState === INIT_STATE) return []

      const events = Object.keys(statesTransitionsMaps[originState]);

      return events.reduce((acc, event) => {
        // I should only ever have one transition, that is checked in another contract
        // !! if there are several transitions, we may have a false positive, but that is ok
        // When the other contract will fail and the issue will be solved, and app will be rerun,
        // this will be recomputed correctly
        const transition = statesTransitionsMaps[originState][event][0];
        const { guards, to } = transition;
        if (!guards) {
          // Reminder: statesType[controlState] === true iff controlState is compound state
          return isHistoryControlState(to) && !statesType[getHistoryUnderlyingState(to)]
            ? acc.concat(transition)
            : acc
        }
        else {
          return guards.reduce((acc, guard) => {
            const { to } = guard;

            return isHistoryControlState(to) && !statesType[getHistoryUnderlyingState(to)]
              ? acc.concat(transition)
              : acc
          }, acc)
        }
      }, [])
    })
      .reduce((acc, x) => acc.concat(x), []);

    const isFulfilled = Object.keys(wrongHistoryStates).length === 0;

    return {
      isFulfilled,
      blame: {
        message: `Found a history pseudo state connected to an atomic state! History pseudo states only refer to compound states. Cf. log`,
        info: { wrongHistoryStates, states: fsmDef.states }
      }
    }
  },
};

// T17 An history state must refer to an existing state
export const isHistoryStatesExisting = {
  name: 'isHistoryStatesExisting',
  shouldThrow: false,
  predicate: (fsmDef, settings, { historyStatesMap, statesType }) => {
    const invalidTransitions = Array.from(historyStatesMap.entries())
      .map(([historyState, flatTransitions]) => {
        return !(historyState in statesType) && {historyState, flatTransitions}
      })
      .filter(Boolean);

    const howMany = Object.keys(invalidTransitions).length;
    const isFulfilled = howMany === 0;

    return {
      isFulfilled,
      blame: {
        message: `Found ${howMany} history pseudo state referring to a control state that is not declared! Check the states property of the state machine definition.`,
        info: { invalidTransitions, states: fsmDef.states }
      }
    }
  },
};

export function isInconditionalTransition(transition) {
  const { from, event, guards, to, actions } = transition;

  return typeof guards === void 0 && to && isControlState(from) && isEvent(event) && isControlState(to) && isActionFactory(actions)
}

export function isValidGuard(guard) {
  const { to, predicate, actions } = guard;

  return to && isControlState(to) && isFunction(predicate) && isActionFactory(actions)
}

export function areCconditionalTransitions(transition) {
  const { from, event, guards, to } = transition;

  return guards && Array.isArray(guards) && !to && isControlState(from) && isEvent(event) && guards.every(isValidGuard)
}

// TODO : test it
// T18. Transitions have a valid format, and are either inconditional (no guards) or conditional
// events are strings
// guards are functions
// action factories are functions
export const haveTransitionsValidTypes = {
  name: 'haveTransitionsValidTypes',
  shouldThrow: false,
  predicate: (fsmDef) => {
    const { transitions } = fsmDef;
    const wrongTransitions = transitions
      .map((transition, transitionIndex) => {
        return !isInconditionalTransition(transition) && !areCconditionalTransitions(transition) && {
          transition,
          index: transitionIndex
        }
      })
      .filter(Boolean)

    const howMany = Object.keys(wrongTransitions).length;
    const isFulfilled = howMany === 0;

    return {
      isFulfilled,
      blame: {
        message: `Found ${howMany} transitions with invalid format! Check logs for more details.`,
        info: { wrongTransitions, transitions }
      }
    }
  },
}

export const areEventsDeclared = {
  name: 'areEventsDeclared',
  shouldThrow: false,
  predicate: (fsmDef, settings, { eventTransitionsMaps }) => {
    const eventList = Object.keys(eventTransitionsMaps);
    const declaredEventList = fsmDef.events;
    const eventsDeclaredButNotTriggeringTransitions = declaredEventList
      .map(declaredEvent => eventList.indexOf(declaredEvent) === -1 && declaredEvent)
      .filter(Boolean);
    const eventsNotDeclaredButTriggeringTransitions = eventList
      .map(triggeringEvent => declaredEventList.indexOf(triggeringEvent) === -1 && triggeringEvent)
      .filter(Boolean)
      .filter(ev => ev !== INIT_EVENT);

    const isFulfilled = eventsDeclaredButNotTriggeringTransitions.length === 0
      && eventsNotDeclaredButTriggeringTransitions.length === 0;

    return {
      isFulfilled,
      blame: {
        message: `All declared events must be used in transitions. All events used in transition must be declared! Cf. log`,
        info: { eventsDeclaredButNotTriggeringTransitions, eventsNotDeclaredButTriggeringTransitions }
      }
    }
  },
};

export const areStatesDeclared = {
  name: 'areStatesDeclared',
  shouldThrow: false,
  predicate: (fsmDef, settings, { statesTransitionsMaps, statesType }) => {
    const stateList = Object.keys(statesTransitionsMaps);
    const declaredStateList = Object.keys(statesType);
    const statesDeclaredButNotTriggeringTransitions = declaredStateList
      .map(declaredState => stateList.indexOf(declaredState) === -1 && declaredState)
      .filter(Boolean);
    const statesNotDeclaredButTriggeringTransitions = stateList
      .map(stateInTransition =>
        stateInTransition !== INIT_STATE && declaredStateList.indexOf(stateInTransition) === -1 && stateInTransition)
      .filter(Boolean);

    const isFulfilled = statesDeclaredButNotTriggeringTransitions.length === 0
      && statesDeclaredButNotTriggeringTransitions.length === 0;

    return {
      isFulfilled,
      blame: {
        message: `All declared states must be used in transitions. All states used in transition must be declared! Cf. log`,
        info: { statesDeclaredButNotTriggeringTransitions, statesNotDeclaredButTriggeringTransitions }
      }
    }
  },
};

// TODO : test it
// T25. SS1
export const isValidSettings = {
  name: 'isValidSettings',
  shouldThrow: false,
  predicate: (fsmDef, settings) => {
    if (!settings) {
      return {
        isFulfilled: false,
        blame: {
          message: `Settings for the state machine must be defined! You passed a falsy value for settings!`,
          info: { settings}
        }
      }
    }
    else {
      const {updateState}= settings;
      return {
        isFulfilled: isFunction(updateState),
        blame: {
          message: `settings.updateState must be a function!`,
          info: { settings}
        }
      }
    }
  },
};

// TODO L I am in T22, helper fucntion done and getTargetStatesMap included in fsmContracts
// TODO : T22. There are no incoming transitions to the reserved initial state, check if implemented or not, prob. not
// TODO : complete README with table ENFORCED : Y/N, or just - [ ]
// TODO : put as non enforced . there cannot be two transitions with the same `(from, event, predicate)` - sameness
// defined for predicate by referential equality.
//

const fsmContracts = {
  computed: (fsmDef, settings) => {
    return {
      statesType: getStatesType(fsmDef.states),
      initTransition: findInitTransition(fsmDef.transitions),
      statesTransitionsMap: getStatesTransitionsMap(fsmDef.transitions),
      statesTransitionsMaps: getStatesTransitionsMaps(fsmDef.transitions),
      eventTransitionsMaps: getEventTransitionsMaps(fsmDef.transitions),
      ancestorMap: getAncestorMap(fsmDef.states),
      statesPath: getStatesPath(fsmDef.states),
      historyStatesMap: getHistoryStatesMap(fsmDef.transitions),
      targetStatesMap: getTargetStatesMap(fsmDef.transitions)
    }
  },
  description: 'FSM structure',
  contracts: [isValidSettings, haveTransitionsValidTypes, noDuplicatedStates, noReservedStates, atLeastOneState, eventsAreStrings, validInitialConfig, validInitialTransition, initEventOnlyInCompoundStates, validInitialTransitionForCompoundState, validEventLessTransitions, allStateTransitionsOnOneSingleRow, noConflictingTransitionsWithAncestorState, isHistoryStatesExisting, isHistoryStatesTargetStates, isHistoryStatesCompoundStates, areEventsDeclared, areStatesDeclared, isInitialControlStateDeclared],
};

/**
 * Takes a series of contracts grouped considered as a unit, run them, and return the results. Some contracts may
 * throw. If no contract throws, the returned value include a list of the failing contracts if any. A failing
 * contract data structure include relevant information about the failing contract, in particular the contract name,
 * the associated error message and additional info expliciting the error message.
 * @returns {function(...[*]=): {isFulfilled: boolean, failingContracts: Array}}
 * @param {{computed : function, description: string, contracts: Array<*>} contractsDef
 */
function makeContractHandler(contractsDef) {
  const contractsDescription = contractsDef.description;

  return function checkContracts(...args) {
    const failingContracts = [];
    const computedArgs = contractsDef.computed.apply(null, args);
    const isFulfilled = contractsDef.contracts.reduce((acc, contract) => {
      const { name: contractName, select, predicate, shouldThrow } = contract;
      const fullArgs = args.concat(computedArgs);
      const { isFulfilled, blame } = predicate.apply(null, fullArgs);
      const blameMessageHeader = `${contractsDescription} FAILS ${contractName}!`;
      const { message, info } = blame || {};

      if (isFulfilled) return acc
      else {
        failingContracts.push({ name: contractName, message, info });
        console.error(blameMessageHeader);
        console.error([contractName, message].join(': '));
        console.debug('Supporting error data:', info);

        if (shouldThrow) throw new Error([blameMessageHeader, `check console for information!`].join('\n'))
        else {
          return false
        }
      }
    }, true)

    return { isFulfilled, failingContracts }
  }
}

export const fsmContractChecker = makeContractHandler(fsmContracts);

// NOTE contracts execution may be order sensitive, or reuse contracts in contracts??

// Terminology
// . A transition is uniquely defined by `(origin, event, predicate, target, action, transition index, guard index)`
// For instance, the transition array `[{from: INIT_STATE, event:INIT_EVENT, to:A}, {from: A, event: Ev,
// guards : [{predicate: T, to:B, action: IDENTITY}] }]` has its first transition
// uniquely referenced by `(INIT_STATE, INIT_EVENT, undefined, undefined, A, 0, 0)`. The second transition would be
// referenced by `(A, Ev, T, B, IDENTITY, 1, 0)`.
// . We write A < B if A is a substate of B, with the implication that B is hence a compound state
// . We write A !< B if A is a direct substate of B
// . We write A !!< B if A is a substate of B, and A is also an atomic state
// . We write A -ev-> B to denote a transition from A to B triggered by `ev`

// S0. `FsmDef.states` must be an object
// NOT ENFORCED
// S1. State name cannot be a reserved state name (for now only INIT_STATE)
// TO ENFORCE: DONE
// S2. State names must be unique
// TO ENFORCE;: DONE
// S3. State names must conform to the same nomenclature than javascript variable identifiers
// - cannot be empty strings,
// - cannot start with a number
// NOT ENFORCED
// S4. At least one control state (other than the initial state) muat be declared
// TO ENFORCE;: DONE

// Events
// E0. `fsmDef.events` msut be an array of strings
// TO ENFORCE: PENDING
// E1. Event names passed to configure the state machine must be unique
// NOT ENFORCED

// Transitions
// T1. There must be configured at least one transition away from the initial state
// Reason : the machine, to be meaningful, must progress
// Recoverable
// TO ENFORCE : DONE
// T2. A transition away from the initial state can only be triggered by the initial event
// TO ENFORCE : DONE
// T4. If several guards are defined for the initial state, then one of those guards should be fulfilled
// NOT ENFORCED - that eddge case is not explicitly but if we are lucky should be enforced through the general case
// T5. Every compound state A must have a valid transition A -INIT-> defined
// T6. Every compound state NOT the initial state must have a valid INCONDITIONAL transition A -INIT-> defined
// T7a. Every compound state NOT the initial state must have a valid INCONDITIONAL transition A -INIT-> defined which
// does not have a history state as target
// T7b. The initial state must have a valid transition INIT_STATE -INIT-> defined which does not have a history
// state as target : DONE
// NOTE: actually we could limit it to history state of the containing compound state to avoid infinity loop
// T8. Every compound state NOT the initial state must have a valid INCONDITIONAL transition A -INIT-> defined which
// does not have the history state as target and has a target control state that is one of its substates (no
// out-of-hierarchy INIT transitions)
// T9. A valid transition to a history state must transition to the history state containing parent, if there is no
// history
// ENFORCE, NOT IMPLEMENTED TODO in ROADMAP!!! impact on test generation
// T10. A transition A -eventless-> B may have several or no guards, but at least one must be fulfilled
// NOT ENFORCED, immplemenation must be embedded in code
// T11. If there is an eventless transition A -eventless-> B, there cannot be a competing A -ev-> X
// ENFORCE: DONE
// T12. All transitions A -ev-> * must have the same transition index, i.e. all associated guards must be together
// in a single array and there cannot be two transition rows showcasing A -ev-> * transitions
// ENFORCE: DONE
// T13. Guards for a transition A -ev-> * must be : 1. non-overlapping, i.e. no two guards can be true at the same
// time for any value handled by the state machine, 2. at least one guard must be fulfilled at all time. In short,
// guards must partition the state space.
// NOT ENFORCED. Cf T4
// T14. Conflicting transitions are not allowed, i.e. A -ev-> B and A < OUTER_A is not compatible with OUTER_A
// -ev->C. The event `ev` could trigger a transition towards either B or C
// T15. Init transitions can only occur from compound states or the initial state, i.e. A -INIT-> B iff A is a compound
// state or A is the initial state
// ENFORCE: DONE
// T16. History states must be target states, and compound states
// ENFORCE: DONE
// TODO : update readme with contracts enforced, also add those who I forgot here

// Guards
// G0. Guards are functions
// ENFORCED
// G1. Guards are pure functions
// NOT ENFORCED

// Action factories
// A0. Action factories are functions
// ENFORCED
// A1. Action factories are pure functions
// NOT ENFORCED
// A2. Action factories must return {outputs, updates} : no syntax sugar
// NOT ENFORCED

// Behaviour
// B1. the state machine starts in the initial state
// ENFORCED by construction
// B2. The machine cannot stay blocked in the initial control state
// ENFORCED by S4, T1, T2, T4
// B3. A transition evaluation must end in an atomic state
// ENFORCED by T5, T6, T7, T8, T9
// The initial state transition to an atomic state. A transition from an atomic state can only be to (atomic state,
// compound state, history state).
// T7 ensures that we do not go to the history state when there is no history yet
// T8 ensures transition to compound states always descend and readh an atomic| state. T9 ensure the third case.
// B4 : eventless transitions must progress the state machine
// ENFORCED by T10, T11
// NOTE : we could have failing guards provided they modify the extended state so that eventually after a number of
// looping, a guard is fulfilled. We reject that possibility as too error-prone and complexity-adding. Hard to
// imagine a use case for it (while loops implemented with eventless transitions??).
// B5. Non-deterministic transitions are not allowed
// ENFORCED by T13, T14, necessary for generative testing
// B6. If an event is configured to be processed by the state machine, it must progress the machine (possibly
// returning to the same state)
// ENFORCED by T13, T4, T10, necessary for generative testing
// B7. There is only one 'dead' state, the final state. Any other state should feature transitions which progress
// the state machine.
// NOT ENFORCED. Not very important in practice. Several final states may also appear, though it is weird
// ROADMAP : distingush a true final state. When final state receive event, throw? Not important in practice
// B8. It is possible to reach any states
// NOT ENFORCED. Just a warning to issue. reachable states requires a graph structure, and a traversal

// Settings
// S1. `settings.updateState` must be a pure function
// This is important in particular for the tracing mechanism which triggers two execution of this function with the
// same parameters
// NOT ENFORCED

// Contract types
/**
 * @typedef {String} ContractSection name of a contract section.
 */
/**
 * @typedef {*} Argument argument argument can be anything and will be passed to the contract checking function
 */
/**
 * @typedef {{message: String, info : *}} Blame contains a message and extra info identifying the blaming party for
 * the contract violation
 */
/**
 * @typedef {Object} Contract
 * @property {String} name contract name
 * @property {Boolean} isRecoverable indicates whether the contract violation should provoke an exception or a
 * warning (when set to `true`)
 * @property {function (*=) : Array<Argument>} select take a list of arguments
 * @property {function (*=) : {isFulfilled :Boolean, blame : Blame} } predicate
 */
