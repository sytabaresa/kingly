define(function (require) {
  var utils = require('utils');
  var Err = require('custom_errors');
  return require_synchronous_standard_fsm(utils, Err);
});

function require_synchronous_standard_fsm(utils, Err) {
  function get_internal_transitions(fsm_internal_transitions, state, event) {
    return fsm_internal_transitions[state][event];
  }

  /**
   * Evaluates a set of transitions vs. a triggering event and event data, and returns the corresponding output symbol
   * as configured in the triggered transition.
   * @param fsm_internal_states {State_Definition} UNUSED FOR NOW
   * @param arr_transitions {Array<Transition> | Transition} where :
   * - Transition :: Hash {predicate :: T -> E -> Boolean, action :: T -> E -> T, to :: State_Identifier}, where
   *   - E is a type representing an event (also named input symbol in the state machine terminology)
   *   - T is any non-trivial type which represents the data associated with the event
   *   - State_Identifier is a string
   \     * @param fsm_state {T}
   * @param internal_event {E}
   * @returns {O} where O is the output symbol type :: Hash {updated_fsm_state:: T, next_state :: String, error :: Error}
   * - `updated_fsm_state` is the updated value obtained as a result of calling the action with `fsm_state` and the event
   * - `next_state` is the value of the `to` field of the corresponding transition record
   * - error is : undefined is the action did not return an error, otherwise it contains the corresponding error
   * NOTE : FOR NOW, it is up to the actions to catch or return their errors
   * @throws {Exception}:
   * - when `arr_transitions` not truthy
   * - when none of the predicates given for the given event are satisfied
   *   NOTE : we could also not raise an exception in that case, FOR NOW we do
   * CONTRACT : `arr_transitions` MUST be truthy
   * CONTRACT : transitions are evaluated in the order by which they are found in the array
   * CONTRACT : actions are synchronous, i.e. the immediate return value of the action call will be used as the action
   * CONTRACT : actions must throw exceptions which are instance of Error (i.e. don't throw strings or else)
   */
  function evaluate_internal_transitions(fsm_internal_states, arr_transitions, fsm_state, internal_event) {
    // NOTE : we do nothing yet with `fsm_internal_states` which holds the entry/exit actions for the state
    if (!arr_transitions) {
      // CASE : there is no transition associated to that internal event from that state
      // that is an internal error : should NEVER happened
      throw 'evaluate_internal_transitions : internal error : unknown internal event!'
    }
    // CASE : arr_transitions is not an array but a single row (1 transition), we make it an array
    if (!arr_transitions.length) arr_transitions = [arr_transitions];

    var evaluation_result;
    arr_transitions.some(function evaluate_till_first_truthy_predicate(transition) {
      // evaluate predicates in order till the first satisfied predicate
      var predicate = transition.predicate;
      var action = transition.action;
      var to = transition.to;
      var advice = undefined; // unused for now

      if (predicate(fsm_state, internal_event)) {
        var decorated_action = advice ? advice(action) : action;
        var action_result = Err.try_catch(decorated_action)(fsm_state, internal_event);
        var action_error;
        if (action_result instanceof Error) {
          action_error = action_result;
          Err.enrich_error(action_error, {
            fsm_state : utils.clone_deep(fsm_state),
            executed_action : decorated_action.name
          });
        }
        else action_error = undefined;

        evaluation_result = {
          // updated_fsm_state: action_error ? fsm_state : update_fsm_state_fn(fsm_state, action_result),
          fsm_state_update: action_result,
          next_fsm_state: action_error ? undefined : to,
          fatal_error: action_error,
          recoverable_error: action_result && action_result.recoverable_error
        };
        return true;
      }
      return false;
    });

    if (evaluation_result) return evaluation_result;
    // We do not allow here to have an event occuring AND there is no transition possible
    throw 'internal state machine : no predicates were satisfied!! Review them'
  }

  /**
   * Side-effects : FOR NOW updates `updated_fsm_state` in place
   * @param updated_fsm_state {T} OUT
   * @param next_state {State_Identifier}
   * @returns {T}
   */
  function get_next_internal_state_update(/*OUT*/updated_fsm_state, next_state) {
    return {
      internal_state: {expecting: next_state}
    };
  }

  return {
    get_internal_transitions: get_internal_transitions,
    evaluate_internal_transitions: evaluate_internal_transitions,
    get_next_internal_state_update: get_next_internal_state_update
  }
}
