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
/** @typedef {{subject_factory: function() : Subject, ...}} FSM_Settings */
/** @typedef {{subject_factory: function() : Subject, merge: MergeObsFn, of: OfObsFn, ...}} FSM$_Settings */
/** @typedef {*} FSM_Model */
/** @typedef {*} MachineOutput well it is preferrable that that be an object instead of a primitive */
/** @typedef {String} EventLabel */
/** @typedef {String} ControlState Name of the control state */
/**
 * @typedef {{emit: function(value) : void, ...}} Subject An object with emulates a subject. The subject must have an
 * `emit` method by which values can be emitted. This allows to decouple the streaming library from our library. For
 * Rxjs v5, `emit` is the equivalent of `next`. The subject must also have an `subscribe` method corresponding to
 * the eponym method for Rxjs v5 subjects.
 */
/**
 * @typedef {function (Array<Observable>) : Observable} MergeObsFn Similar to Rxjs v4's `Rx.Observable.merge`. Takes
 * an array of observables and return an observable which passes on all outputs emitted by the observables in the array.
 */
/**
 * @typedef {function (value) : Observable} OfObsFn Similar to Rxjs v4's `Rx.Observable.of`. Takes
 * a value and lift it into an observable which completes immediately after emitting that value.
 */
map filter concat share
