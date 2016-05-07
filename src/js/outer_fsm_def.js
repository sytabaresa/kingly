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
  // The following three are events for the inner fsm
  var EV_CODE_TRACE = constants.EV_CODE_TRACE;
  var EV_CODE_AUTO = constants.EV_CODE_AUTO;
  var EV_CODE_INIT = constants.EV_CODE_INIT;
  var INITIAL_STATE_NAME = constants.INITIAL_STATE_NAME;
  // Action-handler-related constants
  var PURE_ACTION_HANDLER = constants.PURE_ACTION_HANDLER;
  var EVENT_HANDLER_RESULT = constants.EVENT_HANDLER_RESULT;

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
        action: update_model_and_send_effect_request, // TODO : update the logic
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
        predicate: utils.not(has_event_handler),
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
        // CASE : the effect could not be executed satisfactorily
        predicate: is_effect_error,
        action: set_internal_state_to_expecting_intent_but_reporting_effect_error,
        to: EXPECTING_INTENT
      },
      {
        // CASE : effect was executed correctly
        predicate: utils.always(true),
        action: _transition_to_next_state,
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
        predicate: utils.always(true),
        action: to_be_decided
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

    function is_effect_error(fsm_state, internal_event) {
      var effect_res = internal_event;
      return effect_res instanceof Error;
    }

    function is_trace_event(fsm_state, internal_event) {
      return internal_event.code === EV_CODE_TRACE;
    }

    ////////////
    // Actions
    function update_model_with_pure_action_result(fsm_state, internal_event) {
      // CASE : There is a transition associated to that event :
      // - no effect has to be executed
      // - a pure update of the inner FSM model has to be performed
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
      var effect_res = undefined; // In that branch case, we do not have an effect result to process
      var index = 0; // In that branch case, we do not have an array of action, so index is 0

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
      var automatic_event = process_automatic_events(
          next_state,
          fsm_state.inner_fsm.is_auto_state,
          fsm_state.inner_fsm.is_init_state,
          previously_processed_event_data);

      var action_seq_handler_result = action_seq_handler(model, event_data, effect_res, index);
      var effect_struct = action_seq_handler_result.effect_req;
      if (utils.is_null(effect_struct) || utils.is_undefined(effect_struct)) {
        // case pure action handler as expected
        var model_update = action_seq_handler_result.model_update;
        return get_pure_action_outer_fsm_model_update(automatic_event, model_update, from, to, internal_event);
      }
      else {
        // pathological case, we supposedly have a pure action handler, and yet that handler returns an effect request
        throw 'update_model_with_pure_action_result : action handler should not return an effect request!'
      }
    }

    function update_model_and_send_effect_request(fsm_state, internal_event) {
      // CASE : There is a transition associated to that event :
      // - some effects have to be executed
      // - before effect request take place, a pure update of the inner FSM model has to be performed

      var event_data = internal_event.payload;
      var model = fsm_state.inner_fsm.model;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var current_state = get_current_state(fsm_state);
      var event_handler = get_event_handler(fsm_state, internal_event);
      var event_handler_result = event_handler(model, event_data, current_state);
      var predicate = event_handler_result.predicate;
      var action_seq_handler = event_handler_result.action_seq_handler;
      var from = event_handler_result.from;
      var to = ['-',event_handler_result.to,'-']; // wrap the target state to indicate it is pending
      var previously_processed_event_data = fsm_state.event ? fsm_state.event.payload : undefined;
      var effect_res = undefined; // In that branch case, we do not have an effect result to process
      var index = 0; // In that branch case, we do not have an array of action, so index is 0

      utils.assert_custom_type(event_handler_result, EVENT_HANDLER_RESULT);

      utils.info("WHEN EVENT ", internal_event.code);
      utils.info("IN STATE ", from);
      utils.log("found event handler!");
      utils.info("WITH model, event data BEING ", model, event_data);
      utils.info("CASE : " + (predicate
              ? "predicate " + predicate.name + " for transition is fulfilled"
              : "automatic transition"));

      // Update fsm state
      var action_seq_handler_result = action_seq_handler(model, event_data, effect_res, index);
      var model_update = action_seq_handler_result.model_update;
      var effect_req = action_seq_handler_result.effect_req;
      if (utils.is_null(effect_req) || utils.is_undefined(effect_req)) {
        throw 'update_model_and_send_effect_request : if an effectful handler is used, there has to be an effect to execute!'
      } else {
        return get_effectful_action_outer_fsm_model_update(effect_req, model_update, from, to, internal_event);
        // TODO : automatic event makes sense here? no, it is when I have a next state to go to
        // CONTRACT : Automatic actions with no events and only conditions are not allowed in nesting state (aka grouping state)
      }

    }

    function get_effectful_action_outer_fsm_model_update(effect_req, model_update, from, to, internal_event){
      return {
        // set the automatic event if any (will be undefined if there is none)
        automatic_event: undefined,
        // serves as a trace of the event which provoked the transition
        event: internal_event,
        // model has been modified
        internal_state: {
          is_model_dirty: true,
          // but we remain in the internal state EXPECTING_INTENT as there are automatic events
          // to process. Those events come through the intent$ channel, like other user-originated
          // events.
          expecting: EXPECTING_EFFECT_RESULT,
          // Reminder : the `to` state is wrapped with some character to indicate that the transition is pending
          from: from,
          to: to
        },
        // update model private props which are computed properties based on `fsm_state`
        inner_fsm: {
          model: model_update
        },
        // no effect request to be made
        effect_req: effect_req,
        payload: undefined, // TODO : deprecated - remove at some point
        // TODO : define format of effect_req and also effect factory
        // no error
        recoverable_error: undefined
      }
    }

    function update_internals_with_effect_code(fsm_state, internal_event) {
      // CASE : There is a transition associated to that event : an effect has to be executed
      // Reminder : When there is no action defined in the transition, we set the effect to identity

      utils.log("found event handler!");
      utils.info("WHEN EVENT ", internal_event.code);
      utils.info("with payload ", internal_event.payload);

      var event = internal_event.code;
      var event_data = internal_event.payload;
      var model = fsm_state.inner_fsm.model;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
      var event_handler = hash_states[current_state][event];
      var effect_struct = event_handler(model, event_data, current_state);
      var effect_code = effect_struct.action_seq_handler;
      var from = effect_struct.from;
      var to = effect_struct.to;

      return get_pure_action_outer_fsm_model_update(/*OUT*/fsm_state, from, to, undefined, model_update);
    }

    function emit_no_guard_satisfied_recoverable_error(fsm_state, internal_event) {
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

      return set_internal_state_to_transition_error(/*OUT*/fsm_state, event, event_data, from, to, error_msg);
    }

    function emit_only_warning(fsm_state, internal_event) {
      // TODO : think about options for the warning (error?exception?)
      console.warn('received effect result while waiting for intent');
      return {
        // no updates
      };
    }

    function emit_no_transition_recoverable_error(fsm_state, internal_event) {
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

      return set_internal_state_to_transition_error(/*OUT*/fsm_state, event, event_data, from, to, error_msg);
    }

    function set_internal_state_to_expecting_intent_but_reporting_effect_error(fsm_state, internal_event) {
      // Pass the whole error, not just the error message in that case
      var error = internal_event; // case `effect_res` instanceof Error
      var event = 'effect_res';
      var event_data = undefined; // undefined because effect_res returned error, not data
      // TODO : what to do in that case?
      // - have a generic nested state for handling error?
      // - require user to have specific transitions for handling error?
      //   + that means that the effect_res must be passed to the condition handler...
      //   + best is probably in the transition definition to define an error transition
      //     associated to an error event
      // - fail silently and remain in the same state?
      //   + in that case, we still have to change the internal state to NOT expecting effect_res
      // - fail abruptly with a fatal error passed to a global error handler?
      console.error(error);
      console.error(error.stack);
      // For now:
      // - we do not change state and remain in the current state, waiting for another intent
      // - but we do not update the model
      console.log("Received effect_res", error);

      return set_internal_state_to_expecting_intent_but_reporting_action_error_(/*OUT*/fsm_state, event, event_data, error);
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
          // set to true when we need to pass meta data of internal state
          is_model_dirty: true,
          // new controlled internal state, we received the intent, now we need to execute the corresponding effect
          expecting: EXPECTING_EFFECT_RESULT,
          // when the effect result is received, we need to know the impacted transition
          from: from,
          to: to
        },
        // pass down the effect to execute with its parameters
        effect_req: effect_code,
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
          // set `is_model_dirty` to true as we have a new model to pass down stream
          is_model_dirty: true,
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
        effect_req: undefined,
        payload: undefined
      }
    }

    function get_pure_action_outer_fsm_model_update(automatic_event, model_update, from, to, internal_event) {
      return {
        // set the automatic event if any (will be undefined if there is none)
        automatic_event: automatic_event,
        // serves as a trace of the event which provoked the transition
        event: internal_event,
        // model has been modified
        internal_state: {
          is_model_dirty: true,
          // but we remain in the internal state EXPECTING_INTENT as there are automatic events
          // to process. Those events come through the intent$ channel, like other user-originated
          // events.
          expecting: EXPECTING_INTENT,
          // EXPECTING_INTENT internal state does not make use of from and to
          from: from,
          to: to
        },
        // update model private props which are computed properties based on `fsm_state`
        inner_fsm: {
          model: model_update
        },
        // no effect request to be made
        effect_req: undefined,
        payload: undefined,
        // no error
        recoverable_error: undefined
      }
    }

    function set_internal_state_to_expecting_intent_but_reporting_action_error_(fsm_state, event, event_data, error) {
      return {
        // there was an error while executing the effect request
        recoverable_error: {
          error: error,
          event: event,
          event_data: event_data,
          resulting_state: get_current_state(fsm_state),
          timestamp: utils.get_timestamp()
        },
        // but the model was not modified
        internal_state: {
          is_model_dirty: false,
          // so we remain in the internal state EXPECTING_INTENT to receive other events
          expecting: EXPECTING_INTENT,
          // EXPECTING_INTENT internal state does not make use of from and to
          from: undefined,
          to: undefined
        },
        // no automatic event
        automatic_event: undefined,
        // no effect request to be made
        effect_req: undefined,
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

    function _transition_to_next_state(fsm_state, internal_event) {
      var effect_res = internal_event;
      var hash_states = fsm_state.inner_fsm.hash_states;
      var from = fsm_state.internal_state.from;
      var to = fsm_state.internal_state.to;
      var model_update = utils.clone_deep(effect_res);
      var previously_processed_event_data = fsm_state.payload;

      console.log("Received effect_res", effect_res);

      // Leave the current state
      // CONTRACT : we leave the state only if the effect for the transition is successful
      // This is better than backtracking or having the fsm stay in an undetermined state
      leave_state(from, hash_states);
      var next_state = get_next_state(to, hash_states);

      // send the AUTO event to trigger transitions which are automatic :
      // - transitions without events
      // - INIT events
      var automatic_event = process_automatic_events(
          next_state,
          fsm_state.inner_fsm.is_auto_state,
          fsm_state.inner_fsm.is_init_state,
          previously_processed_event_data);


      // TODO
      // analyze the need for model.is_dirty as I now have model_diff (difference will be meta data on the model)

      var fsm_update = get_pure_action_outer_fsm_model_update(/*OUT*/fsm_state, automatic_event, model_update);

      // ...and enter the next state (can be different from `to` if we have nesting state group)
      // TODO : put that in fsm_update too!!
      var state_to = hash_states[next_state];
      state_to.active = true;
      hash_states[INITIAL_STATE_NAME].current_state_name = next_state;

      utils.info("RESULTING IN MODEL UPDATE : ", model_update);

      return fsm_update;
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
   * @param from
   * @param hash_states
   * @returns -
   */
  function leave_state(from, /*OUT*/hash_states) {
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
   * @param to
   * @param hash_states
   * @throws
   * @returns {String} next state name
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

