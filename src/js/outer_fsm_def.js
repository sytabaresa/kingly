define(function (require) {
  var utils = require('utils');
  var Err = require('custom_errors');
  var constants = require('constants');

  return require_outer_fsm_def(Err, utils, constants);
});

function require_outer_fsm_def(Err, utils, constants) {
  var EXPECTING_INTENT = constants.EXPECTING_INTENT;
  var EXPECTING_EFFECT_RESULT = constants.EXPECTING_ACTION_RESULT;
  // The following three are events for the outer fsm
  var EV_INTENT = constants.EV_INTENT;
  var EV_EFFECT_RES = constants.EV_EFFECT_RES;
  var EV_TRACE = constants.EV_TRACE;
  // Types
  var INTENT = constants.INTENT;
  // The following three are events for the inner fsm
  var EV_CODE_TRACE = constants.EV_CODE_TRACE;
  var EV_CODE_AUTO = constants.EV_CODE_AUTO;
  var EV_CODE_INIT = constants.EV_CODE_INIT;
  var EV_CODE_EFFECT_ERROR = constants.EV_CODE_EFFECT_ERROR;
  var INITIAL_STATE_NAME = constants.INITIAL_STATE_NAME;
  // Action-handler-related constants
  var PURE_ACTION_HANDLER = constants.PURE_ACTION_HANDLER;
  var EVENT_HANDLER_RESULT = constants.EVENT_HANDLER_RESULT;
  var LAST_EFFECT_REQUEST = constants.LAST_EFFECT_REQUEST;
  var EFFECT_RESPONSE = constants.EFFECT_RESPONSE;
  var EXECUTE = constants.commands.EXECUTE;
  var CANCEL = constants.commands.CANCEL;
  var IGNORE = constants.commands.IGNORE;
  var EFFECT_ERROR_DATA = constants.EFFECT_ERROR_DATA;

  function get_internal_sync_fsm() {
    ////////////
    // Define the (synchronous standard finite) state machine for the state machine maker (!)

    ////////////
    // States
    var fsm_internal_states = {};
    fsm_internal_states[EXPECTING_INTENT] = {entry: undefined, exit: undefined};
    fsm_internal_states[EXPECTING_EFFECT_RESULT] = {entry: undefined, exit: undefined};

    ////////////
    // Events
    var fsm_internal_events = {EV_INTENT: EV_INTENT, EV_EFFECT_RES: EV_EFFECT_RES, EV_TRACE: EV_TRACE};

    ////////////
    // Transitions :: {state : {event : [{predicate, action, to}]}}
    // predicate :: FSM_STATE -> internal_event :: {code, payload} -> Boolean
    var fsm_internal_transitions = {};
    fsm_internal_transitions[EXPECTING_INTENT] = {};
    fsm_internal_transitions[EXPECTING_INTENT][fsm_internal_events.EV_INTENT] = [
      {
        // CASE : There is a transition associated to that event - the corresponding action is one and pure
        predicate: utils.and(has_event_handler, has_action_seq_handler, is_seq_handler_of_pure_action),
        action: update_model_with_pure_action_result,
        to: EXPECTING_INTENT
      },
      {
        // CASE : There is a transition associated to that event - the corresponding action implies a sequence of effects
        predicate: utils.and(has_event_handler, has_action_seq_handler, utils.not(is_seq_handler_of_pure_action)),
        action: update_model_and_send_first_effect_request,
        to: EXPECTING_EFFECT_RESULT
      },
      {
        // CASE : we don't have an action for that event :
        // - none of the guards were truthy, it is a possibility
        // So we remain in the same state
        predicate: utils.and(has_event_handler, utils.not(has_action_seq_handler)),
        action: emit_no_guard_satisfied_recoverable_error,
        to: EXPECTING_INTENT
      },
      {
        // CASE : default case (must be last) : There is no transition associated to that event from that state
        predicate: utils.and(utils.not(has_event_handler), is_error_intent),
        action: throw_fatal_error,
        to: EXPECTING_INTENT
      },
      {
        // CASE : default case (must be last) : There is no transition associated to that event from that state
        predicate: utils.and(utils.not(has_event_handler), utils.not(is_error_intent)),
        action: emit_no_transition_recoverable_error,
        to: EXPECTING_INTENT
      }
    ];
    fsm_internal_transitions[EXPECTING_INTENT][fsm_internal_events.EV_EFFECT_RES] = [
      {
        // CASE : we receive an effect result, but we were NOT expecting it
        predicate: utils.always(true), // predicate satisfied
        action: emit_only_warning,
        to: EXPECTING_INTENT // remain in same state
      }
    ];
    fsm_internal_transitions[EXPECTING_INTENT][fsm_internal_events.EV_TRACE] = [
      {
        // CASE : Trace request
        predicate: utils.always(true),
        action: update_trace_mechanism,
        to: EXPECTING_INTENT // back to wait for intents
      }
    ];
    fsm_internal_transitions[EXPECTING_EFFECT_RESULT] = {};
    fsm_internal_transitions[EXPECTING_EFFECT_RESULT][fsm_internal_events.EV_EFFECT_RES] = [
      {
        // CASE : the effect received is not the one we are waiting for
        predicate: utils.not(is_effect_expected),
        action: warning_received_unexpected_effect_result,
        to: EXPECTING_EFFECT_RESULT
      },
      {
        // CASE : the effect is the one expected could not be executed satisfactorily
        predicate: utils.and(is_effect_expected, is_effect_error),
        action: set_internal_state_to_expecting_intent_and_emit_error_event,
        to: EXPECTING_INTENT
      },
      {
        // CASE : effect was executed correctly, and there is some more to execute before changing state
        predicate: utils.and(is_effect_expected, utils.not(is_effect_error), has_more_effects_to_execute),
        action: update_model_and_send_effect_request,
        to: EXPECTING_EFFECT_RESULT
      },
      {
        // CASE : last effect was executed correctly, and the fsm should update the model and transition to the next state
        predicate: utils.and(is_effect_expected, utils.not(is_effect_error), utils.not(has_more_effects_to_execute)),
        action: update_model_and_transition_to_next_state,
        to: EXPECTING_INTENT
      }
    ];
    fsm_internal_transitions[EXPECTING_EFFECT_RESULT][fsm_internal_events.EV_INTENT] = [
      {
        // CASE : received intent while expecting action result : that could very much happen
        // Because actions can be asynchronous, it is possible that user intents comes in while the action
        // is still being executed. RTC semantics leads us to two choices:
        // - discard the event
        // - queue it for later execution when the action is done executing
        predicate: utils.not(is_preemptive_transition),
        action: emit_unexpected_intent_warning
      },
      {
        // TODO : think about edge cases, it is the transition which is preemptive meaning this case is possible
        // - event EV, guard : C1 , non preemptive
        // - event EV, guard : C2 , preemptive !
        // should we duplicate the logic in EXPECTING_INTENT??
        // better :
        // detect if the transition is preemptive : has handler, has guard satisfied (that means updating event handler to return a value is preemptive)
        // if NOT : see case above
        // if YES :
        // - cancel the current effect (if any)
        // - return in EXPECTING_INTENT state and emit the event EV (as automatic event)
        // CASE : received a preemptive transition which provokes immediate abortion (or weak abortion) from current effect handling
        predicate: is_preemptive_transition,
        action: abort_effect_execution_and_transition_to_next_state
      }
    ];
    fsm_internal_transitions[EXPECTING_EFFECT_RESULT][fsm_internal_events.EV_TRACE] = [
      {
        // CASE : Trace request
        predicate: is_trace_event,// TODO : review this, not sure that makes any sense any more
        action: update_trace_mechanism,
        to: EXPECTING_EFFECT_RESULT // back to wait for action results
      }
    ];

    ////////////
    // Predicates
    function has_event_handler(fsm_state, internal_event) {
      var event = internal_event.code;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var current_state = get_current_state(fsm_state);
      return !!hash_states[current_state][event];
    }

    function has_action_seq_handler(fsm_state, internal_event) {
      var event = internal_event.code;
      var event_data = internal_event.payload;
      var model = fsm_state.inner_fsm.model;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
      var event_handler = hash_states[current_state][event];
      return has_event_handler(fsm_state, internal_event)
        && event_handler(model, event_data, current_state).action_seq_handler;
    }

    function is_seq_handler_of_pure_action(fsm_state, internal_event) {
      var event = internal_event.code;
      var event_data = internal_event.payload;
      var model = fsm_state.inner_fsm.model;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
      var event_handler = hash_states[current_state][event];
      var action_seq_handler;
      return has_event_handler(fsm_state, internal_event)
        && (action_seq_handler = event_handler(model, event_data, current_state).action_seq_handler)
        && is_pure_action_handler(action_seq_handler);
    }

    function is_pure_action_handler(action_seq_handler) {
      return utils.has_custom_type(action_seq_handler, PURE_ACTION_HANDLER);
    }

    function is_effect_expected(fsm_state, internal_event) {
      var effect_response = internal_event;
      var response_effect_request = effect_response.effect_request;

      // Check that the request who generated the response is the request that we are expecting
      var expected_effect_request = fsm_state.effect_execution_state.effect_request;
      return _.isEqual(expected_effect_request, response_effect_request);
    }

    function has_more_effects_to_execute(fsm_state, internal_event) {
      return utils.has_custom_type(internal_event, EFFECT_RESPONSE)
        && fsm_state.effect_execution_state.has_more_effects_to_execute
    }

    function is_preemptive_transition(fsm_state, internal_event) {
      var event = internal_event.code;
      var event_data = internal_event.payload;
      var model = fsm_state.inner_fsm.model;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var current_state = get_current_state(fsm_state);
      var event_handler = hash_states[current_state][event];
      return event_handler && event_handler(model, event_data, current_state).is_preemptive;
    }

    function is_effect_error(fsm_state, internal_event) {
      var effect_result = internal_event.effect_result;
      return effect_result instanceof Error;
    }

    function is_error_intent(fsm_state, internal_event) {
      // Reminder : `internal_event` here is of type intent, `internal_event.payload` is of type `EFFECT_ERROR_DATA`
      return utils.has_custom_type(internal_event.payload, EFFECT_ERROR_DATA);
    }

    function is_trace_event(fsm_state, internal_event) {
      return internal_event.code === EV_CODE_TRACE;
    }

    ////////////
    // Actions
    // TODO : test, this could be buggy for INIT events entered with event_data and previous event_data (second transition is INIT)
    function update_model_with_pure_action_result(/*-OUT-*/fsm_state, internal_event) {
      // CASE : There is a transition associated to that event :
      // - no effect has to be executed
      // - a pure update of the inner FSM model has to be performed
      var fsm_state_update = fsm_state;
      var event_data = internal_event.payload;
      var model = fsm_state.inner_fsm.model;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var current_state = get_current_state(fsm_state);
      var event_handler = get_event_handler(fsm_state, internal_event);
      var event_handler_result = event_handler(model, event_data, current_state);
      var predicate = event_handler_result.predicate;
      var action_seq_handler = event_handler_result.action_seq_handler;
      var from = event_handler_result.from;
      var to = event_handler_result.to;
      var previously_processed_event_data = fsm_state.event ? fsm_state.event.payload : undefined;

      utils.assert_custom_type(event_handler_result, EVENT_HANDLER_RESULT);

      utils.info("WHEN EVENT ", internal_event.code);
      utils.info("IN STATE ", from);
      utils.log("found event handler!");
      utils.info("WITH model, event data BEING ", model, event_data);
      utils.info("CASE : "
        + (predicate ? "predicate " + predicate.name + " for transition is fulfilled"
          : "automatic transition"));

      // Go to next state
      transition_to_next_state(fsm_state, from, to);
      var next_state = get_next_state(to, hash_states);

      // Update fsm state
      // -  AUTO event to trigger transitions which are automatic :
      //    - transitions without events
      //    - INIT events
      // TODO : test, this could be buggy for INIT events entered with event_data and previous event_data (second transition is INIT)
      // This works because automatic events do not have event data associated so they rely on the previous event data
      var automatic_event = process_automatic_events(
        next_state,
        fsm_state.inner_fsm.is_auto_state,
        fsm_state.inner_fsm.is_init_state,
        previously_processed_event_data);

      // In that branch case, we do not have an effect result to process, and index is 0
      var action_seq_handler_result = action_seq_handler(model, event_data, undefined, 0);
      var effect_struct = action_seq_handler_result.effect_request;
      if (utils.is_null(effect_struct) || utils.is_undefined(effect_struct)) {
        fsm_state_update.noop = false;
        // case pure action handler as expected
        var model_update = action_seq_handler_result.model_update;

        // set the automatic event if any (will be undefined if there is none)
        fsm_state_update.automatic_event = automatic_event;
        // serves as a trace of the event which provoked the transition
        fsm_state_update.event = internal_event;
        // model has been modified
        fsm_state_update.internal_state = {
          // but we remain in the internal state EXPECTING_INTENT as there are automatic events
          // to process. Those events come through the intent$ channel, like other user-originated
          // events.
          expecting: EXPECTING_INTENT,
          // EXPECTING_INTENT internal state does not make use of from and to
          from: from,
          to: to
        };
        // update model private props which are computed properties based on `fsm_state`
        fsm_state_update.inner_fsm.model_update = model_update;
        // no effect request to be made
        fsm_state_update.effect_execution_state = undefined;
        // no error
        fsm_state_update.recoverable_error = undefined;

        return fsm_state_update;
      }
      else {
        fsm_state_update.noop = true; // don't pass model or effect requests
        // pathological case, we supposedly have a pure action handler, and yet that handler returns an effect request
        throw 'update_model_with_pure_action_result : action handler should not return an effect request!'
      }
    }

    function get_fsm_state_update_when_first_effect(/*-OUT-*/fsm_state, internal_event) {
      var fsm_state_update = fsm_state;
      fsm_state_update.effect_execution_state = {};
      // We keep track of the event to reuse its event data for calling the event handler
      fsm_state_update.event = internal_event;
      var event_data = internal_event.payload;
      var model = fsm_state.inner_fsm.model;
      var current_state = get_current_state(fsm_state);
      var event_handler = get_event_handler(fsm_state, internal_event);
      var event_handler_result = event_handler(model, event_data, current_state);
      utils.assert_custom_type(event_handler_result, EVENT_HANDLER_RESULT);

      var predicate = event_handler_result.predicate;
      // We also keep track of the action handler (instead of recomputing it each time)
      var action_seq_handler = event_handler_result.action_seq_handler;
      var effect_result = undefined; // In that branch case, we do not have an effect result to process

      utils.info("WHEN EVENT ", internal_event.code);
      utils.info("IN STATE ", event_handler_result.from);
      utils.log("found event handler associated to effectful actions!");
      utils.info("WITH model, event data BEING ", model, event_data);
      utils.info("CASE : " + (predicate
          ? "predicate " + predicate.name + " for transition is fulfilled"
          : "automatic transition"));
      utils.info("executing action handler: " + action_seq_handler.name);

      // Update fsm state
      var action_seq_handler_result = action_seq_handler(model, event_data, effect_result, 0); // index = 0 for first effect
      utils.assert_type(action_seq_handler_result, 'object', 'update_model_and_send_effect_request : action_seq_handler did not return an object as expected!');

      var model_update = action_seq_handler_result.model_update;
      /** @type Unaddressed_Effect_Request*/
      var effect_request = action_seq_handler_result.effect_request;
      utils.assert_type(effect_request, 'object', 'update_model_and_send_effect_request : effect request is not an object as expected!');

      fsm_state_update.noop = false;
      fsm_state_update.recoverable_error = undefined;
      fsm_state_update.automatic_event = undefined;
      fsm_state_update.event = internal_event;

      fsm_state_update.inner_fsm.model_update = model_update;

      effect_request.command = EXECUTE;
      fsm_state_update.effect_execution_state = {
        action_seq_handler: action_seq_handler,
        index: 0,
        effect_request: effect_request,
        has_more_effects_to_execute: true
      };
      fsm_state_update.internal_state = {
        expecting: EXPECTING_EFFECT_RESULT,
        // Reminder : the `to` state is wrapped with some character to indicate that the transition is pending
        from: event_handler_result.from,
        // wrap the target state to indicate it is pending
        to: utils.wrap(event_handler_result.to)
      };
      return fsm_state_update;
    }

    function get_fsm_state_update_when_subsequent_effects(/*-OUT-*/fsm_state, internal_event) {
      var fsm_state_update = fsm_state;
      var last_effect_request = utils.new_typed_object({}, LAST_EFFECT_REQUEST);
      var effect_response = internal_event;
      var model = fsm_state.inner_fsm.model;
      var event_data = fsm_state.event.payload;
      var index = fsm_state.effect_execution_state.index + 1;
      var action_seq_handler = fsm_state.effect_execution_state.action_seq_handler;
      var action_seq_handler_result = action_seq_handler(model, event_data, effect_response.effect_result, index);
      utils.assert_type(action_seq_handler_result, 'object', 'update_model_and_send_effect_request : action_seq_handler did not return an object as expected!');

      var model_update = action_seq_handler_result.model_update;
      var effect_request = action_seq_handler_result.effect_request;

      log_messages(effect_request);

      // Set effect execution state in function of expected number of requests, number of requests received
      if (effect_request) {
        // Case : More effects to execute
        fsm_state_update.noop = false;
        effect_request.command = EXECUTE;
        fsm_state_update.effect_execution_state = {
          action_seq_handler: fsm_state.effect_execution_state.action_seq_handler,
          index: index,
          effect_request: effect_request,
          has_more_effects_to_execute: true
        }
      }
      else {
        // Case : Last effect request
        var effect_number = action_seq_handler.effect_number;
        if (effect_number !== index) {
          // Case : unexpected end of effect requests (i.e. is before or after the expected)
          fsm_state_update.noop = true; // don't pass model or effect requests
          throw Err.Effect_Error({
              message: 'Unexpected end of effect requests, expected ' + effect_number + ', encountered end of effects at index ' + index,
              extended_info: {effect_number: effect_number, index: index}
            }
          )
        }
        else {
          // We pass a dummy effect request to signal completion (eq. to stream's `onCompleted` event)
          fsm_state_update.noop = false;
          effect_request = {
            command: IGNORE,
            driver: {}
          };
          fsm_state_update.effect_execution_state = {
            action_seq_handler: fsm_state.effect_execution_state.action_seq_handler,
            index: index,
            effect_request: effect_request,
            has_more_effects_to_execute: false
          }
        }
      }

      // Update fsm state
      fsm_state_update.recoverable_error = undefined;
      fsm_state_update.automatic_event = undefined;
      // fsm_state_update.event = internal_event; no change!!!

      fsm_state_update.inner_fsm.model_update = model_update;

      fsm_state_update.internal_state.expecting = EXPECTING_EFFECT_RESULT;
      // Reminder : the `to` state is wrapped with some character to indicate that the transition is pending
      // fsm_state_update.internal_state.from = event_handler_result.from; no change!!! same for .to!!!

      return fsm_state_update;

      function log_messages(effect_request) {
        if (effect_request) {
          utils.info("Processing effect", effect_request.driver.family, effect_request.driver.name, effect_request.params);
        } else {
          utils.info("Processing model update only");
        }
        utils.info("IN STATE ", fsm_state.internal_state.from);
        utils.info("WITH model, event data BEING ", model, event_data);
        utils.info("executing action handler: " + action_seq_handler.name, index);
      }
    }

    function update_model_and_send_first_effect_request(/*-OUT-*/fsm_state, internal_event) {
      // CASE : There is a transition associated to that event :
      // - some effects have to be executed
      // - before effect request take place, a pure update of the inner FSM model has to be performed

      // 1. This is the first effect is to be requested
      //    `internal_event` will be user intent or program-generated intent
      return get_fsm_state_update_when_first_effect(fsm_state, internal_event);
    }

    function update_model_and_send_effect_request(/*-OUT-*/fsm_state, internal_event) {
      // CASE : There is a transition associated to that event :
      // - some effects have to be executed
      // - the first effect was already requested
      // - we are here because the corresponding effect response was received (internal_event)

      var fsm_state_update;

      if (fsm_state.effect_execution_state.has_more_effects_to_execute) {
        // 2. Remaining effects are to be requested
        fsm_state_update = get_fsm_state_update_when_subsequent_effects(fsm_state, internal_event);
      }
      else {
        // (case 3. (end of effects) dealt separately with)
        // dead branch
        throw 'that code branch should be dead!!!'
      }

      return fsm_state_update;
    }

    function warning_received_unexpected_effect_result(/*-OUT-*/fsm_state, internal_event) {
      console.warn('received unexpected effect result!', internal_event);
      // no updates, return undefined to avoid resending the request downstream
      var fsm_state_update = fsm_state;
      fsm_state_update.recoverable_error = Err.SM_Error({
        message: 'warning_received_unexpected_effect_result',
        extended_info: {effect_result: utils.clone_deep(internal_event)}
      });
      fsm_state_update.noop = true;
      return fsm_state_update;
    }

    function update_model_and_transition_to_next_state(/*-OUT-*/fsm_state, internal_event) {
      var fsm_state_update = fsm_state;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var event_data = fsm_state.event.payload;
      var effect_request = fsm_state.effect_execution_state.effect_request;

      // 3. No more effects is to be requested
      //    The action handler returned falsy `effect_request` field (case 2.)

      //    We reset all temporary fields
      fsm_state_update.recoverable_error = undefined;
      fsm_state_update.inner_fsm.model_update = undefined;
      fsm_state_update.effect_execution_state = undefined;

      fsm_state_update.noop = false;
      fsm_state_update.internal_state.expecting = EXPECTING_INTENT;
      var from = fsm_state.internal_state.from;
      var to = fsm_state_update.internal_state.to = utils.unwrap(fsm_state.internal_state.to);
      utils.info("Finished processing effects", effect_request.driver.family, effect_request.driver.name, effect_request.params);

      //    We set for automatic events if any
      // TODO : refactor this - it is not DRY - repeated twice

      // Go to next state
      transition_to_next_state(fsm_state, from, to);
      var next_state = get_next_state(to, hash_states);

      var automatic_event = process_automatic_events(
        next_state,
        fsm_state.inner_fsm.is_auto_state,
        fsm_state.inner_fsm.is_init_state,
        event_data);

      fsm_state_update.automatic_event = automatic_event;

      return fsm_state_update;
    }

    function throw_fatal_error(fsm_state, internal_event) {
      // internal_event is an error intent, carrying an enriched effect execution state
      var message = 'Fatal error encountered while processing effect request. A handler to process the error was not found!';
      throw Err.Effect_Error({
        message: message,
        extended_info: {
          effect_execution_state: utils.clone_deep(internal_event.payload),
          error: fsm_state.recoverable_error.error
        }
      });
    }

    function emit_no_guard_satisfied_recoverable_error(/*-OUT-*/fsm_state, internal_event) {
      var event = internal_event.code;
      var event_data = internal_event.payload;
      var model = fsm_state.model;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
      var event_handler = hash_states[current_state][event];
      var effect_struct = event_handler(model, event_data, current_state);
      var from = effect_struct.from;
      var to = from;
      var error_msg = ['No transition found while processing the event', event,
        'while transitioning from state', from,
        '.\n It is possible that no guard predicates were fulfilled.'].join(" ");

      return set_internal_state_to_transition_error(/*-OUT-*/fsm_state, event, event_data, from, to, error_msg);
    }

    function emit_only_warning(/*-OUT-*/fsm_state, internal_event) {
      // TODO : think about options for the warning (error?exception?)
      var message = 'received effect result while waiting for intent';
      console.warn(message);
      // no updates, return undefined to avoid resending the request downstream
      var fsm_state_update = fsm_state;
      fsm_state_update.recoverable_error = Err.SM_Error({
        message: message,
        extended_info: {effect_result: internal_event}
      });
      fsm_state_update.noop = true;
      return fsm_state_update;
    }

    function emit_unexpected_intent_warning(/*-OUT-*/fsm_state, internal_event) {
      var message = 'Received non-preemptive intent while awaiting effect results!';
      console.warn(message);
      // no updates, return undefined to avoid resending the request downstream
      var fsm_state_update = fsm_state;
      fsm_state_update.recoverable_error = Err.SM_Error({
        message: message,
        extended_info: internal_event
      });
      fsm_state_update.noop = true;
      return fsm_state_update;
    }

    function emit_no_transition_recoverable_error(/*-OUT-*/fsm_state, internal_event) {
      // CASE : There is no transition associated to that event from that state
      // We keep the internal state `expecting` property the same
      // However, we update the model to indicate that an error occurred
      // it will be up to the user to determine what to do with the error
      // TODO : think more carefully about error management : have an optional parameter to decide behaviour?
      var error_msg = 'There is no transition associated to that event!';
      var event = internal_event.code;
      var event_data = internal_event.payload;
      var current_state = get_current_state(fsm_state);
      var from = current_state;
      var to = from;

      utils.info("WHEN EVENT ", event);
      console.error(error_msg);

      return set_internal_state_to_transition_error(/*-OUT-*/fsm_state, event, event_data, from, to, error_msg);
    }

    function set_internal_state_to_expecting_intent_and_emit_error_event(/*-OUT-*/fsm_state, internal_event) {
      var fsm_state_update = fsm_state;
      var effect_response = internal_event;
      // NOTE : effect_result is not cloned here, as there is little chance that it is later modified unexpectedly
      // We also want to keep the instanceof type information
      var effect_result = effect_response.effect_result;
      var effect_execution_state = fsm_state.effect_execution_state;
      var from = fsm_state.internal_state.from;

      fsm_state_update.noop = false;
      // Error passed as recoverable error for tracing purposes
      fsm_state_update.recoverable_error = {
        error: effect_result,
        effect_request: effect_response.effect_request,
        effect_execution_state: effect_execution_state,
        resulting_state: from,
        timestamp: utils.get_timestamp()
      };
      // fsm_state_update.event should hold the previous event which led to executing the effect sequence - keep it;
      // the effect result information (which is the error) shjould be added automatically
      fsm_state_update.automatic_event = utils.new_typed_object({
        code: EV_CODE_EFFECT_ERROR, payload: utils.new_typed_object(effect_execution_state, EFFECT_ERROR_DATA)
      }, INTENT);
      fsm_state_update.effect_execution_state = undefined;
      fsm_state_update.internal_state = {
        expecting: EXPECTING_INTENT,
        // we keep the from and to information for tracing purpose - we remain in the same state
        from: from,
        to: from
      };
      // keep the model unchanged. This means that if the sequence of effects is considered to be a transaction,
      // the model will be in an 'intermediary' state as all effects and model updates will not have been run...
      fsm_state_update.inner_fsm.model_update = {};

      utils.info("Encountered error while executing effect", utils.clone_deep(effect_response));
      utils.info("IN STATE ", from);

      return fsm_state_update;
    }

    function abort_effect_execution_and_transition_to_next_state(/*-OUT-*/fsm_state, internal_event) {
      var fsm_state_update = fsm_state;
      var from = fsm_state_update.internal_state.from;
      // 1. reset effect request state
      fsm_state_update.noop = false; // i.e. pass the trace info forward so the automatic event is taken into account
      fsm_state_update.recoverable_error = undefined;
      fsm_state_update.internal_state = {
        expecting: EXPECTING_INTENT,
        from: from,
        to: from
      };
      fsm_state_update.inner_fsm.model_update = {};
      var effect_execution_state = fsm_state_update.effect_execution_state;
      var effect_request = effect_execution_state.effect_request;
      // 2. send cancel order with current effect request (if any, and there should be one as we await an effect result!!)
      effect_request.command = CANCEL;
      // Set automatic event to replay the event but with internal state EXPECTING INTENT
      fsm_state.automatic_event = internal_event;

      // NOTE : We keep fsm_state_update.event as the event/event data who triggered the effect request
      utils.info("WHEN PREEMPTIVE EVENT ", internal_event.code);
      utils.info("IN STATE ", from);
      utils.log("CANCELLING PENDING EFFECT REQUEST!");
      utils.info("BEING ", effect_request);

      return fsm_state_update;
    }

    function update_trace_mechanism(fsm_state, internal_event) {
      var should_trace = internal_event.payload;
      var is_not_tracing = !fsm_state.is_tracing;
      var trace_update = {};
      // If we have a trace command and we were not already tracing
      if (should_trace && is_not_tracing) {
        trace_update.is_tracing = true;
        trace_update.arr_traces = [];
        // Reminder :
        // Trace :: (Event, State, Model, Optional Time_Info), where
        // Event :: (Event_Type, Event_Data)
        // State :: State_Enum
        // Model :: Serializable
      }
      // TODO : when is tracing stop, I should send a stop signal on a
      if (!should_trace) {
        // TODO : stop tracing, but keep the array of traces intact
        trace_update.is_tracing = false;
      }
      console.log('update_trace_mechanism : exit');

      return trace_update;
    }

    function to_be_decided() {
      console.warn('CASE : received intent while expecting action result : that could very much happen');
      console.warn('TO BE DECIDED WHAT TO DO');
    }

    /////////
    // we gather the state fields interdependencies for the internal controlled states here in a set of impure functions
    function set_internal_state_to_expecting_effect_result(fsm_state, from, to, effect_code, event_data) {
      console.log('set_internal_state_to_expecting_effect_result(fsm_state, from, to, action_seq_handler, event_data)', effect_code, event_data)
      return {
        // no change of the model to reflect, we only received an intent
        //fsm_state.internal_state.is_model_dirty = false;
        internal_state: {
          // new controlled internal state, we received the intent, now we need to execute the corresponding effect
          expecting: EXPECTING_EFFECT_RESULT,
          // when the effect result is received, we need to know the impacted transition
          from: from,
          to: to
        },
        // pass down the effect to execute with its parameters
        effect_request: effect_code,
        payload: event_data,
        // no automatic event, we are sending an effect request
        automatic_event: undefined,
        // no error
        recoverable_error: undefined
      }
    }

    function set_internal_state_to_transition_error(fsm_state, event, event_data, from, to, error_msg) {
      return {
        internal_state: {
          // There is no transition associated to that event, we wait for another event
          expecting: EXPECTING_INTENT,
          // from and to are only used to keep track of the transition state for the ACTION_RES internal state
          from: from,
          to: to
        },
        // error to signal
        recoverable_error: {
          error: error_msg,
          event: event,
          event_data: event_data,
          resulting_state: get_current_state(fsm_state),
          timestamp: utils.get_timestamp()
        },
        // no automatic event here
        automatic_event: undefined,
        // no effect to execute
        effect_request: undefined,
        effect_execution_state: undefined,
        payload: undefined
      }
    }

    // update in place fsm_state.hash_states
    function transition_to_next_state(fsm_state, from, to) {
      var hash_states = fsm_state.inner_fsm.hash_states;
      //      var from = fsm_state.internal_state.from;
      //      var to = fsm_state.internal_state.to;

      // Leave the current state
      // CONTRACT : we leave the state only if the effect for the transition is successful
      // This is better than backtracking or having the fsm stay in an undetermined state
      leave_state(from, hash_states);
      var next_state = get_next_state(to, hash_states);

      // ...and enter the next state (can be different from `to` if we have nesting state group)
      var state_to = hash_states[next_state];
      state_to.active = true;
      hash_states[INITIAL_STATE_NAME].current_state_name = next_state;
      utils.info("AND TRANSITION TO STATE", next_state);
    }

    return {
      states: fsm_internal_states,
      events: fsm_internal_events,
      transitions: fsm_internal_transitions
    }
  }

  ///////
  // Helpers
  /**
   * Side-effects :
   * - modifies `hash_states`
   * - emits an `last_seen_from_state` event
   * @param {State} from
   * @param hash_states
   * @returns -
   */
  function leave_state(from, /*-OUT-*/hash_states) {
    // NOTE : model is passed as a parameter for symetry reasons, no real use for it so far
    var state_from = hash_states[from];
    var state_from_name = state_from.name;

    // Set the `last_seen_state` property in the object representing that state's state (!)...
    state_from.history.last_seen_state = state_from_name;
    state_from.active = false;
    console.log("left state", utils.wrap(from));

    // ... and emit the change event for the parents up the hierarchy to update also their last_seen_state properties
    // This updating solution is preferred to an imperative solution, as it allows not to think too much
    // about how to go up the hierarchy
    // There is no big difference also, as by default subject emits synchronously their values to all subscribers.
    // The difference in speed should be neglectable, and anyways it is not expected to have large state chart depths
    // BUT it also means that we cannot have this function be pure and return an object representing the fsm's update
    state_from.emit_last_seen_state_event({
      event_emitter_name: state_from_name,
      last_seen_state_name: state_from_name
    });
  }

  /**
   * Side-effects :
   * - modifies `hash_states`
   * @param {State} to
   * @param hash_states
   * @throws
   * @returns {State} next state name
   */
  function get_next_state(to, hash_states) {
    // Enter the target state
    var state_to_name;
    // CASE : history state (H)
    if (typeof(to) === 'function') {
      state_to_name = utils.get_fn_name(to);

      var target_state = hash_states[state_to_name].history.last_seen_state;
      state_to_name = target_state
        // CASE : history state (H) && existing history, target state is the last seen state
        ? target_state
        // CASE : history state (H) && no history (i.e. first time state is entered), target state is the entered state
        : state_to_name;
    }
    // CASE : normal state
    else if (to) {
      state_to_name = to;
    }
    else {
      throw 'enter_state : unknown case! Not a state name, and not a history state to enter!'
    }
    return state_to_name;
  }

  function get_current_state(fsm_state) {
    return fsm_state.inner_fsm.hash_states[INITIAL_STATE_NAME].current_state_name;
  }

  function get_event_handler(fsm_state, event) {
    var hash_states = fsm_state.inner_fsm.hash_states;
    var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
    return hash_states[current_state][event.code];
  }

  function process_automatic_events(state_name, is_auto_state, is_init_state, previously_processed_event_data) {
    var current_state = state_name;
    // Two cases here:
    // 1. Init handlers, when present on the current state, must be acted on immediately
    // This allows for sequence of init events in various state levels
    // For instance, L1: init -> L2:init -> L3:init -> L4: stateX
    // In this case event_data will carry on the data passed on from the last event (else we loose the model?)
    // 2. transitions with no events associated, only conditions (i.e. transient states)
    if (is_auto_state[current_state]) {
      // CASE : transient state with no triggering event, just conditions
      var auto_event = is_init_state[current_state] ? EV_CODE_INIT : EV_CODE_AUTO;
      return {
        code: auto_event,
        payload: previously_processed_event_data
      }
    }
    else {
      // CASE : nothing special to do, no automatic events to execute
      return undefined;
    }
  }


  return {
    get_internal_sync_fsm: get_internal_sync_fsm,
    get_current_state: get_current_state
  }
}
