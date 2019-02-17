// TODO : write contracts!!
import { findInitTransition, getStatesPath, getStatesTransitionsMap, getStatesType } from "./helpers"
import { objectTreeLenses, PRE_ORDER, traverseObj } from "fp-rosetree"
import { INIT_EVENT, INIT_STATE } from "./properties"

// Contracts
/**
 * State names must be unique
 * @type {Contract}
 */
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
  shouldThrow: true,
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
export const validInitialTransition = {
  name: 'validInitialTransition',
  shouldThrow: false,
  predicate: (fsmDef, settings, { initTransition }) => {
    const { initialControlState, transitions } = fsmDef;
    // Find transitions from INIT_STATE
    // Can only be one
    // That one must have INIT_EVENT
    const initTransitions = transitions.reduce((acc, transition) => {
      transition.from === INIT_STATE && acc.push(transition);
      return acc
    }, []);
    const isFulfilled =
      (initialControlState && !initTransition) ||
      (!initialControlState && initTransition && initTransitions.length === 1 && initTransition.event === INIT_EVENT && typeof initTransition.to === 'string');

    return {
      isFulfilled,
      blame: {
        message: `Invalid configuration for initial transition! Cf. log`,
        info: { initTransition, initTransitions, initialControlState }
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
        return from !== to && statesPath[to].startsWith(statesPath[from])
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

const fsmContracts = {
  computed: (fsmDef, settings) => {
    return {
      statesType: getStatesType(fsmDef.states),
      initTransition: findInitTransition(fsmDef.transitions),
      statesTransitionsMap: getStatesTransitionsMap(fsmDef.transitions),
      statesPath: getStatesPath(fsmDef.states)
    }
  },
  description: 'FSM structure',
  contracts: [noDuplicatedStates, noReservedStates, atLeastOneState, eventsAreStrings, validInitialConfig, validInitialTransition, validInitialTransitionForCompoundState],
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
    const isFulfilled = contractsDef.contracts.every(contract => {
      const { name: contractName, select, predicate, shouldThrow } = contract;
      const fullArgs = args.concat(computedArgs);
      const { isFulfilled, blame } = predicate.apply(null, fullArgs);
      const blameMessageHeader = `${contractsDescription} FAILS ${contractName}!`;
      const { message, info } = blame || {};

      if (isFulfilled) return true
      else {
        failingContracts.push({ name: contractName, message, info });
        console.error(blameMessageHeader);
        console.error([contractName, message].join(': '));
        console.debug('Supporting error data:', info);

        if (shouldThrow) throw new Error([blameMessageHeader, `check console for information!`].join('\n'))
      }
    })

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
// NOT ENFORCED, NOT IMPLEMENTED
// T11. If there is an eventless transition A -eventless-> B, there cannot be a competing A -ev-> X
// ENFORCE
// T12. All transitions A -ev-> * must have the same transition index, i.e. all associated guards must be together
// in a single array and there cannot be two transition rows showcasing A -ev-> * transitions
// ENFORCE
// T13. Guards for a transition A -ev-> * must be : 1. non-overlapping, i.e. no two guards can be true at the same
// time for any value handled by the state machine, 2. at least one guard must be fulfilled at all time. In short,
// guards must partition the state space.
// NOT ENFORCED. Cf T4
// T14. Conflicting transitions are not allowed, i.e. A -ev-> B and A < OUTER_A is not compatible with OUTER_A
// -ev->C. The event `ev` could trigger a transition towards either B or C
// T15. Init transitions can only occur from compound states or the initial state, i.e. A -INIT-> B iff A is a compound
// state or A is the initial state

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
// TODO : I am here, and later complete with contracts in TODO
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
