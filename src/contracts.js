// TODO : write contracts!!, but put them as AOP, i.e. in an auxiliary function like trace, or put them in trace??
import { getFsmStateList } from "./helpers"

const contracts = {
  states: [
    {
      select: (fsmDef, settings) => void 0,
      predicate: (states, settings) => {},
      isRecoverable: void false,
      name: void ""
    }
  ],
  events: [],
  transitions: [],
  initialExtendedState: [],
  settings : [],
  fsm: []
};

/**
 *
 * @param {Object.<ContractSection, Array<Contract>>} contracts
 * @param {String} contractTarget
 * @returns {function(*=): {isFulfilled: boolean, failingContracts: Array}}
 */
function makeContractHandler(contracts, contractTarget) {
  return function contractHandler(args) {
    const contractSections = Object.keys(contracts);
    const failingContracts = [];
    const isFulfilled = contractSections.every(contractSection => {
      const sectionContracts = contracts[contractSection];

      return sectionContracts.every(contract => {
        const { name: contractName, select, predicate, isRecoverable } = contract;
        const contractArgs = select.apply(null, args);
        const {isFulfilled, blame} = predicate.apply(null, contractArgs);

        if (isFulfilled) return true
        else if (isRecoverable) {
          const blameMessageHeader = `${contractTarget} FAILS ${contractSection} / ${contractName} !`;
          const { message, info } = blame || {};
          failingContracts.push({ name: contractName, message, info });
          console.warn(blameMessageHeader);
          console.info(message, info);

          return false
        }
        else {
          const blameMessageHeader = `${contractTarget} FAILS contract ${contractName}!`;
          const { message, info } = blame || {};
          failingContracts.push({ name: contractName, message, info });
          console.error(blameMessageHeader);
          console.info(message, info);

          throw [blameMessageHeader, `check console for information!`].join('\n')
        }
      })
    });

    return { isFulfilled, failingContracts }
  }
}

// Contracts
/**
 * State names must be unique
 * @type {Contract}
 */
const noDuplicatedStates = {
  name: 'noDuplicatedStates',
  isRecoverable: false,
  select: (fsmDef, settings) => ([fsmDef.states, fsmDef.settings]),
  predicate: (states, settings) => {
    const stateList = getFsmStateList(states);

    // TODO : do an every tree traversal in fp-rosetree
    // so I can traverse the obj and stop when encountered duplicated states

    const message = `state names must be unique`
    return {
      isFulfilled,
      blame : {
        message,
        info
      }
    }
  },
};

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

// S0. `FsmDef.states` must be an array of strings
// TO ENFORCE
// S1. State name cannot be a reserved state name (for now only INIT_STATE)
// TO ENFORCE
// S2. State names must be unique
// TO ENFORCE
// S3. State names must conform to the same nomenclature than javascript variable identifiers
// - cannot be empty strings,
// - cannot start with a number
// NOT ENFORCED
// S4. At least one control state other than the initial state muat be declared

// Events
// E0. `fsmDef.events` msut be an array of strings
// E1. Event names passed to configure the state machine must be unique

// Transitions
// T1. There must be configured at least one transition away from the initial state
// Reason : the machine, to be meaningful, must progress
// Recoverable
// T2. A transition away from the initial state can only be triggered by the initial event
// TO ENFORCE
// T3. A transition away from the initial state and triggered by the initial event SHOULD pass the initial extended
// state as event data
// NOT ENFORCED, Recoverable
// T4. If several guards are defined for the initial state, then one of those guards should be fulfilled
// NOT ENFORCED
// T5. Every compound state A must have a valid transition A -INIT-> defined
// T6. Every compound state NOT the initial state must have a valid INCONDITIONAL transition A -INIT-> defined
// T7a. Every compound state NOT the initial state must have a valid INCONDITIONAL transition A -INIT-> defined which
// does not have a history state as target
// T7b. The initial state must have a valid transition INIT_STATE -INIT-> defined which does not have a history
// state as target
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
// NOT ENFORCED... no two records with identical `(from, event, predicate)` mm no that is lame
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
// TODO : impl. have a select function per section which will pass preprocessed parameters (for instance
// preprocessed sate object, so I don't recompute everytime
// B7. There is only one 'dead' state, the final state. Any other state should feature transitions which progress
// the state machine.
// NOT ENFORCED
// B8. It is possible to reach any states
// NOT ENFORCED


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
