/**
 * @typedef {Object} FSM_Def
 * @property {Object.<ControlState, *>} states Object whose every key is a control state admitted by the
 * specified state machine. The value associated to that key is unused in the present version of the library. The
 * hierarchy of the states correspond to property nesting in the `states` object
 * @property {Array<EventLabel>} events A list of event monikers the machine is configured to react to
 * @property {Array<Transition>} transitions An array of transitions the machine is allowed to take
 * @property {*} initial_extended_state The initial value for the machine's extended state
 */
/**
 * @typedef {InconditionalTransition | ConditionalTransition} Transition
 */
/**
 * @typedef {{from: ControlState, to: ControlState, event: EventLabel, action: ActionFactory}} InconditionalTransition
 * **!! DEPRECATED!!**
 *   Inconditional_Transition encodes transition with no guards attached. Every time the specified event occurs, and
 *   the machine is in the specified state, it will transition to the target control state, and invoke the action
 *   returned by the action factory
 */
/**
 * @typedef {{from: ControlState, guards: Array<Condition>}} ConditionalTransition Transition for the
 * specified state is contingent to some guards being passed. Those guards are defined as an array.
 */
/**
 * @typedef {{predicate: Predicate, to: ControlState, action: ActionFactory}} Condition On satisfying the
 * specified predicate, the received event data will trigger the transition to the specified target control state
 * and invoke the action created by the specified action factory, leading to an update of the internal state of the
 * extended state machine and possibly an output to the state machine client.
 */
/**
 * @typedef {function(model: FSM_Model, event_data: *, settings: FSM_Settings) : Actions} ActionFactory
 */
/**
 * @typedef {{model_update: Array<JSON_PatchOperation>, output: MachineOutput}} Actions The actions to be performed
 * by the state machine in response to a transition. `model_update` represents the state update for the variables
 * of the extended state machine. `output` represents the output of the state machine passed to the API caller.
 */
/** @typedef {function (*=) : Boolean} Predicate */
/** @typedef {*} FSM_Settings */
/** @typedef {*} FSM_Model */
/** @typedef {*} MachineOutput well it is preferrable that that be an object instead of a primitive */
/** @typedef {String} EventLabel */
/** @typedef {String} ControlState Name of the control state */
