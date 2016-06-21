// TODO : add the weak abortion feature? unless it can be simulated with standard statechart?//        for instance, action = http request, and cancel event in same state, no need for weak abortion
// TODO : reopen the possibility for drivers to return several responses, all of which will be passed to the same model update : get a special type for this type of return value
//        example of application is if one wants to execute several HTTP requests and update the model as it goes
//        in the current model, effects are executed sequentially
// TODO : add new feature : actions can send events - first design it
// TODO : function de/serialize -> allow to save and recreate the state of the FSM
// TODO : write documentation in readme.md - argue use case for HFSM, give roadmap
// TODO : DSL
// TODO : write program which takes a transition specifications and draw a nice graph out of it with yed or else
// TODO : think about the concurrent states (AND state
// NOTE : AND states gives problems of processing events (an action_res can be received by several states)
//        so 1 AND state could have received its action result and move on, while the second is still waiting for an action res to come...
// TODO : entry and exit actions?? annoying as it forces to add up more intermediate state in the internal state machine
// discarded : add the possibility to add conditions one by one on a given transition (preprocessing the array beforehand?)
//             Better to have them in one place to avoid logical mistakes due to order of predicates
// nice to have : abstract the tree traversal for the build states part
// nice to have : switch internal state machine to synchronous state machine?? I'd say yes
// nice to have : Add termination connector (T)?

// TERMINOLOGY
// Reminder : there are two kinds of intents : user generated intent, and program generated intent
// Reminder : there are two kinds of sources : intents and effect responses (or results, terminology still in flux)
// Terminology :
// - thereafter we refer by FSM (or inner FSM) the finite state machine whose specs is passed as parameter to the state machine
// builder
// - we refer by internal/outer FSM the finite state machine used to build the state machine builder

// NOTE : Dead states:
// - Possible if automatic actions (no events) with conditions always true. If there is not another condition which at some
// point is set to false, we have an infinite loop (a very real one which could monopolize the CPU if all actions are synchronous)
// - To break out of it, maybe put a guard that if we remain in the same state for X steps, transition automatically (to error or else)

// Implementation contracts
// CONTRACT : Actions cannot return an object of type error if not error (check code again)
// CONTRACT : event handlers and predicates MUST be pure (they will be executed several times with the same input)
// CONTRACT : guards/predicates cannot throw (not detected for now, but I should try to catch it and emit fatal error)
// CONTRACT : some events are reserved init,auto,and another one
// CONTRACT : in automatic events, the event data is carried over with the automatic event

// Serialization mechanism :
// - Model should come with a serialize method
// - Internal model should come with a serialize method
// - How to serialize the states?? the states should be reproducible via calling the build_states function and then
//   - serialize the inner parameters
// This will allow to save a copy of a state machine and its state for testing.

// CONTRACT : the fsm, after emitting an effect request, blocks till it received the corresponding effect response

define(function (require) {
  var utils = require('utils');
  var Err = require('custom_errors');
  var Rx = require('rx');
  var _ = require('lodash');
  var synchronous_fsm = require('synchronous_standard_fsm');
  var outer_fsm_def = require('outer_fsm_def');
  var constants = require('constants');
  var fsm_helpers = require('fsm_helpers');

  return require_async_fsm(synchronous_fsm, outer_fsm_def, fsm_helpers, Rx, Err, utils, constants);
});

function require_async_fsm(synchronous_fsm, outer_fsm_def, fsm_helpers, Rx, Err, utils, constants) {

  // CONSTANTS
  var STATE_PROTOTYPE_NAME = constants.STATE_PROTOTYPE_NAME;
  var ACTION_IDENTITY = constants.ACTION_IDENTITY;
  var INITIAL_STATE_NAME = constants.INITIAL_STATE_NAME;
  var EV_CODE_TRACE = constants.EV_CODE_TRACE;
  var EV_CODE_AUTO = constants.EV_CODE_AUTO;
  var EV_CODE_INIT = constants.EV_CODE_INIT;
  var EV_INTENT = constants.EV_INTENT;
  var EV_EFFECT_RES = constants.EV_EFFECT_RES;
  var EV_TRACE = constants.EV_TRACE;
  var PURE_ACTION_HANDLER = constants.PURE_ACTION_HANDLER;
  var ACTION_SEQUENCE_HANDLER = constants.ACTION_SEQUENCE_HANDLER;
  var EVENT_HANDLER_RESULT = constants.EVENT_HANDLER_RESULT;
  var ACTION_HANDLER_IDENTITY = constants.ACTION_HANDLER_IDENTITY;
  var COMMAND_EXECUTE = constants.commands.EXECUTE;
  var COMMAND_CANCEL = constants.commands.CANCEL;
  var COMMAND_IGNORE = constants.commands.IGNORE;
  var EFFECT_HANDLER = constants.EFFECT_HANDLER;
  var DRIVER_REGISTRY = constants.DRIVER_REGISTRY;
  var EFFECT_RESPONSE = constants.EFFECT_RESPONSE;
  var INTENT = constants.INTENT;
  var TRACE_INTENT = constants.TRACE_INTENT;
  var LAST_EFFECT_REQUEST = constants.LAST_EFFECT_REQUEST;
  var EXPECTING_INTENT = constants.EXPECTING_INTENT;

  function make_intent(code, payload) {
    return {code: code, payload: payload}
  }

  /**
   * Processes the hierarchically nested states and returns miscellaneous objects derived from it:
   * `is_group_state` : {Object<String,Boolean>} Hash whose properties (state names) are matched with whether that state is a nested state
   * `hash_states` : Hierarchically nested object whose properties are the nested states.
   * - Nested states inherit (prototypal inheritance) from the containing state.
   * - Holds a `history` property which holds a `last_seen_state` property which holds the latest state for that hierarchy group
   *   For instance, if A < B < C and the state machine leaves C for a state in another branch,
   *   then `last_seen_state` will be set to C for A, B and C
   * - Holds an `active` property which is not so useful so far, and which signal whether the state is active (current) or not
   * - Tthe root state (NOK) is added to the whole hierarchy, i.e. all states inherit from the root state
   * `states` {Object<String,Boolean>} : Hash which maps every state name with itself
   * `states.history` {Object<String,Function>} : Hash which maps every state name with a function whose name is the state name
   * @param states
   * @returns {{hash_states: {}, is_group_state: {}}}
   */
  function build_nested_state_structure(states_) {
    var root_name = 'State';
    var last_seen_state_event_emitter = new Rx.Subject();
    var hash_states = {};
    var last_seen_state_listener_disposables = [];
    var is_group_state = {};

    // Add the starting state
    var states = {nok: states_};

    ////////
    // Helper functions
    function add_last_seen_state_listener(child_name, parent_name) {
      last_seen_state_listener_disposables.push(
        last_seen_state_event_emitter.subscribe(function (x) {
          var event_emitter_name = x.event_emitter_name;
          var last_seen_state_name = x.last_seen_state_name;
          if (event_emitter_name === child_name) {
            console.log(['last seen state set to', utils.wrap(last_seen_state_name), 'in', utils.wrap(parent_name)].join(" "));
            hash_states[parent_name].history.last_seen_state = last_seen_state_name;
          }
        }));
    }

    function dispose_listeners() {
      last_seen_state_listener_disposables.forEach(function (disposable) {
        disposable.dispose();
      });
      last_seen_state_event_emitter.dispose();
    }

    function build_state_reducer(states, curr_constructor) {
      Object.keys(states).forEach(function (state_name) {
        var state_config = states[state_name];
        var curr_constructor_new;

        // The hierarchical state mechanism is implemented by reusing the standard Javascript prototypal inheritance
        // If A < B < C, then C has a B as prototype which has an A as prototype
        // So when an event handler (transition) is put on A, that event handler will be visible in B and C
        hash_states[state_name] = new curr_constructor();
        hash_states[state_name].name = state_name;
        var parent_name = hash_states[state_name].parent_name = utils.get_fn_name(curr_constructor);
        hash_states[state_name].root_name = root_name;
        hash_states[state_name].history = {last_seen_state: null};
        hash_states[state_name].active = false;

        // Set up the listeners for propagating the last seen state up the prototypal chain
        // Prototypal inheritance only works in one direction, we need to implement the other direction by hand
        // if A < B < C is a state hierarchy, to implement correctly the history mechanism, we need the last seen state
        // to be the same throughout the whole hierarchy. Prototypal inheritance does not help here as it works in
        // the opposite direction.
        // So we resort to an event emitter (here an RxJS subject) which connect C and B, B and A.
        // When state C is abandoned, then it updates it `last_seen_state` property and emits a change event,
        // B is subscribed to it, and updates its property and emits a change.
        // A is subscribed to B changes, so that the change event is propagated recursively up the hierarchy.
        // This is a reactive mechanim which is simpler that the interactive one where you adjust the whole hierarchy
        // when state C is abandoned.
        add_last_seen_state_listener(state_name, parent_name);

        if (typeof(state_config) === 'object') {
          is_group_state[state_name] = true;
          eval(['curr_constructor_new = function', state_name, '(){}'].join(" "));
          curr_constructor_new.name = state_name;
          curr_constructor_new.prototype = hash_states[state_name];
          build_state_reducer(state_config, curr_constructor_new);
        }
      })
    }

    function State() {
      this.history = {last_seen_state: null};
    }

    // The `emit_last_seen_state_event` is set on the State object which is inherited by all state objects, so it can be
    // called from all of them when a transition triggers a change of state
    State.prototype = {
      emit_last_seen_state_event: function (x) {
        last_seen_state_event_emitter.onNext(x);
      },
      current_state_name: INITIAL_STATE_NAME
    };

    hash_states[INITIAL_STATE_NAME] = new State();
    hash_states[STATE_PROTOTYPE_NAME] = new State();

    build_state_reducer(states, State);

    return {
      hash_states: hash_states,
      is_group_state: is_group_state,
      dispose_listeners: dispose_listeners
    };
  }

  function compute_fsm_initial_state(statechart) {
    // Create the nested hierarchical
    var states = statechart.state_hierarchy;
    var events = statechart.events;
    var special_actions = {identity: ACTION_HANDLER_IDENTITY};
    var transitions = statechart.transitions;
    var hash_states_struct = build_nested_state_structure(states);
    // {Object<state_name,boolean>}, allows to know whether a state is a group of state or not
    var is_group_state = hash_states_struct.is_group_state;
    var hash_states = hash_states_struct.hash_states;
    var dispose_listeners = hash_states_struct.dispose_listeners;

    // {Object<state_name,boolean>}, allows to know whether a state has a init transition defined
    var is_init_state = get_init_transitions(transitions);

    // {Object<state_name,boolean>}, allows to know whether a state has an automatic transition defined
    var is_auto_state = get_auto_states(transitions, events, is_group_state, is_init_state);

    set_event_handlers(transitions, /*-OUT-*/hash_states, special_actions);

    var model_0 = statechart.model || {};

    return {
      noop: false,
      inner_fsm: {
        model: utils.clone_deep(model_0), // clone the initial value of the model
        hash_states: hash_states,
        is_init_state: is_init_state, // TODO : refactor to init state hash?
        is_auto_state: is_auto_state,
        is_group_state: is_group_state
      },
      internal_state: {
        expecting: constants.EXPECTING_INTENT,
        from: INITIAL_STATE_NAME,
        to: undefined
      },
      effect_execution_state: undefined,
      recoverable_error: undefined,
      // TODO : add fatal_error : undefined // NOTE : that means updating all the tests...
      automatic_event: undefined,
      event: undefined,
      dispose_listeners: dispose_listeners
    };

    function get_init_transitions(transitions) {
      var is_init_state = {};
      transitions.forEach(function (transition) {
        var from = transition.from;
        var event = transition.event;

        // CASE : transition has a init event
        // NOTE : there should ever only be one, but we don't enforce it for now
        if (event === EV_CODE_INIT) {
          is_init_state[from] = true;
        }
      });
      return is_init_state;
    }

    function get_auto_states(transitions, events, is_group_state, is_init_state) {
      return transitions.reduce(function (is_auto_state, transition) {
        var from = transition.from;
        var event = transition.event;

        // ERROR CASE : state found in transition but cannot be found in the events passed as parameter
        // NOTE : this is probably all what we need the events variable for
        if (event && !(event in events)) throw 'unknow event (' + event + ') found in state machine definition!';
        // CASE : automatic transitions : no events - likely a transient state with only conditions
        if (!event) {
          event = EV_CODE_AUTO;
          is_auto_state[from] = true;
        }
        // CASE : automatic transitions : init event automatically fired upon entering a grouping state
        if (is_group_state[from] && is_init_state[from]) {
          is_auto_state[from] = true;
        }
        return is_auto_state;
      }, {});
    }

    function set_event_handlers(transitions, /*-OUT-*/hash_states, special_actions) {
      // nice to have : for specifying statechart actions, the best would be to use a synchronous generator
      //                i.e. a function which receives values through `send` and synchronously returns the next item
      //                or signals completion
      var reduce_fn_no_predicate = function (from, to) {
        return function default_predicate() {
          return utils.new_typed_object(
            {action_seq_handler: undefined, from: from, to: to, predicate: undefined},
            EVENT_HANDLER_RESULT)
        }
      }

      transitions.forEach(function (transition) {
        // console.log("Processing transition:", transition);
        var from = transition.from, to = transition.to;
        var action = transition.action;
        var preemptive = transition.preemptive;
        var event = transition.event || EV_CODE_AUTO;

        // CONTRACT : `conditions` property used for array of conditions, otherwise `condition` property is used
        var arr_predicate = transition.guards || transition.predicate;
        // CASE : ZERO OR ONE condition set
        if ((arr_predicate && !arr_predicate.forEach) || !arr_predicate) arr_predicate = [
          {predicate: arr_predicate, to: to, action: action, preemptive: preemptive}
        ];

        var from_proto;
        from_proto = hash_states[from];

        //console.log("This is transition for event:", event);
        //console.log("Predicates:", arr_predicate);

        from_proto[event] = arr_predicate.reduce(function (acc, guards, index) {
          var condition_checking_fn = (function (guards) {
            var condition_suffix = '';
            // We add the `current_state` because the current state might be different from the `from` field here
            // This is the case for instance when we are in a substate, but through prototypal inheritance it is
            // the handler of the prototype which is called
            var condition_checking_fn = function (model_, event_data, current_state) {
              from = current_state || from;
              var predicate = guards.predicate;
              condition_suffix = predicate ? '_checking_condition_' + index : '';
              var to = guards.to;
              if (!predicate || predicate(model_, event_data)) {
                // CASE : condition for transition is fulfilled so we can associate an action handler...
                var action = guards.action;
                var has_syntax_error = false;
                var return_value = utils.new_typed_object({
                    action_seq_handler: utils.is_function(action)
                      // CASE : just an action function passed : it MUST be a pure action
                      ? make_action_handler_from_pure_action_handler(action)
                      // CASE : an array of action is passed : it MUST be a sequence of effectful actions
                      : (utils.is_array(action) && action.length > 0)
                      ? make_action_sequence_handler_from_effectful_action_array(action)
                      : utils.is_undefined(action)
                      // CASE : I have a condition which is fulfilled but no action
                      // so, the model does not change, but the transition should happen
                      ? make_action_handler_from_pure_action_handler(special_actions.identity)// TODO : update special_actions.identity (to pass in constants by the way)
                      // CASE : syntax error, action does not have one of the authorized value/type
                      : (has_syntax_error = true, undefined),
                    predicate: predicate, // passed only for logging/tracing purposes
                    from: from,
                    to: to,
                    is_preemptive: !!guards.preemptive
                    // TODO add is_preemptive_event :: boolean (default false)
                  },
                  EVENT_HANDLER_RESULT);
                if (has_syntax_error) {
                  throw 'syntax error, action does not have one of the authorized value/type'
                } else {
                  return return_value;
                }
              }
              else {
                // CASE : condition for transition is not fulfilled
                console.log("CASE : "
                  + (predicate ? "predicate " + predicate.name + " for transition NOT fulfilled..."
                    : "no predicate"));
                return utils.new_typed_object(
                  {action_seq_handler: undefined, predicate: undefined, from: from, to: to},
                  EVENT_HANDLER_RESULT)
              }
            };
            condition_checking_fn.displayName = from + condition_suffix;
            return condition_checking_fn;
          })(guards);

          return function arr_predicate_reduce_fn(model_, event_data, current_state) {
            var condition_checked = acc(model_, event_data, current_state);
            return condition_checked.action_seq_handler
              ? condition_checked
              : condition_checking_fn(model_, event_data, current_state);
          }
        }, reduce_fn_no_predicate);
      });
    }
  }

  /**
   * Lifts a pure action (i.e. model update) into a sequence handler
   * @param {Function} action. Where action :: model -> event_data -> model_update
   * @returns {Function}
   */
  function make_action_handler_from_pure_action_handler(action) {
    utils.assert_signature('make_action_handler_from_pure_action_handler :: function', arguments);
    // Reminder : pure actions (model updates) cannot throw, i.e. any error occurring is not catched (fatal error)
    return utils.new_typed_object(
      function make_action_handler_from_pure_action_handler(model, event_data, effect_res, index) {
        // TODO : when types are defined, adjust the signature
        utils.assert_signature('make_action_handler_from_pure_action_handler :: object -> * -> ?object -> ?number', arguments);
        return {
          model_update: action(model, event_data),
          effect_request: undefined
        };
      },
      PURE_ACTION_HANDLER)
  }

  /**
   * Lifts a sequence of effectful actions into a sequence handler
   * @param {Array<Function>} arr_actions. Where action :: model -> event_data -> effect_res -> (model_update, effect_request)
   * @returns {Function}
   */
  function make_action_sequence_handler_from_effectful_action_array(arr_actions) {
    /**
     * @type Action_Handler
     */
    var action_sequence_handler = function action_sequence_handler_from_effectful_action_array(model, event_data, effect_res, index) {
      return arr_actions[index](model, event_data, effect_res);
    };
    action_sequence_handler.effect_number = arr_actions.length - 1;
    return utils.new_typed_object(action_sequence_handler, ACTION_SEQUENCE_HANDLER);
  }

  function outer_fsm_write_trace(traceS, /*-OUT-*/fsm_state, internal_fsm_def, internal_event_type, internal_event, evaluation_result) {
    // This function will update the `fsm_state` variable with trace information if the trace flag is set
    var emit_traces = true;
    var should_trace = fsm_state.is_tracing;
    if (should_trace) {
      // Reminder : Array Trace, where
      // Trace :: (Event, State, Model, Optional Time_Info), where
      // Event :: (Event_Type, Event_Data)
      // State :: State_Enum
      // Model :: Serializable

      // Tracing is complicated by the fact that the trace information which we want and which is that of the
      // specified HFSM is scattered among states of the internal FSM
      // In short, when internal FSM in state :
      // - expecting_intent : we have code and payload corresponding to the intent, with internal_type being 'intent'
      //                      `resulting_state` and `timestamp` being not relevant, together with the model
      //                      which has not been modified yet
      // - expection_action_result :now we have `resulting_state` and `timestamp` relevant and the model too
      // So: depending on the internal state we pick certain fields and accumulate them in a full trace record
      var internal_fsm_events = internal_fsm_def.events;
      var arr_traces = fsm_state.arr_traces;
      var resulting_state = outer_fsm_def.get_current_state(fsm_state);
      var fsm_state_update = evaluation_result.fsm_state_update;
      var model_update = fsm_state_update.inner_fsm ? fsm_state_update.inner_fsm.model : {};
      var recoverable_error = evaluation_result.recoverable_error;

      // We need to clone the model before passing it to the trace, so the trace reflects the value of the model
      // at the moment of the trace (no impact of further modifications to the model)
      // `code` and `resulting_state` and `time_stamp` should not be deep cloned, as they are primitive types
      // Those details are particular to the model, so we have utils.clone_deep using the `clone_deep` model version
      // if it exists
      // NOTE : The model passed here has already been updated previously with model_update
      var model = utils.clone_deep(fsm_state.inner_fsm.model);

      // If we receive a trace event, do not trace it, only trace non-trace event, i.e. intent and effect results
      if (internal_event_type === internal_fsm_events.EV_INTENT) {
        if (recoverable_error) {
          add_trace_record(add_recoverable_error_to_trace_record(model, model_update, recoverable_error),
            /*-OUT-*/arr_traces, traceS, emit_traces);
        }
        else {
          arr_traces.push({
            event: {code: internal_event.code, payload: utils.clone_deep(internal_event.payload)}
          });
        }
      }
      if (internal_event_type === internal_fsm_events.EV_EFFECT_RES) {
        // TODO : deal with error when effect_res
        update_trace_record(complete_trace_record, /*-OUT-*/arr_traces,
          recoverable_error, resulting_state, model, model_update, traceS, emit_traces);
      }
    }

    // arr_traces is modified in place, however we return it just in case we need the value for chaining or else
    return arr_traces;
  }

  function update_trace_record(update_fn, /*-OUT-*/arr_traces, recoverable_error, resulting_state, model, model_update, traceS, emit_traces) {
    emit_traces = (typeof(emit_traces) === 'boolean') ? emit_traces : true;
    var incomplete_record = arr_traces.pop();
    var completed_trace_record = update_fn(incomplete_record, recoverable_error, resulting_state, model, model_update);
    arr_traces.push(completed_trace_record);
    emit_traces && traceS.onNext(arr_traces);
  }

  function add_trace_record(add_fn, /*-OUT-*/arr_traces, traceS, emit_traces) {
    emit_traces = (typeof(emit_traces) === 'boolean') ? emit_traces : true;
    add_fn(/*-OUT-*/arr_traces);
    emit_traces && traceS.onNext(arr_traces);
  }

  function add_recoverable_error_to_trace_record(model, model_update, recoverable_error) {
    return function (/*-OUT-*/arr_traces) {
      arr_traces.push({
        model: utils.clone_deep(model),
        model_update: model_update || {},
        recoverable_error: recoverable_error
      });
      return arr_traces;
    }
  }

  function complete_trace_record(/*-OUT-*/record, recoverable_error, resulting_state, model, model_update) {
    record.resulting_state = resulting_state;
    record.model = model;
    record.model_update = model_update || {};
    record.timestamp = utils.get_timestamp();
    if (recoverable_error) record.recoverable_error = recoverable_error;
    return record;
  }

  /////////
  // Event handler (for all events) for the synchronous state machine which builds the asynchronous state machine

  /**
   * Curried function which takes a state machine definition and returns a function which allow to operate that state machine
   * @param fsm_def {State_Machine_Definition} where
   * - State_Machine_Definition :: Hash {states :: State_Definitions, transitions :: Transitions}, where
   *   - State_Definitions :: Hash { State_Identifier -> State_Definition } where
   *     - State_Identifier :: String
   *     - State_Definition :: Hash { entry :: Function, exit :: Function}
   *     - FOR NOW not used
   *   - Transitions :: Hash { State_Identifier -> Hash { Event_Identifier -> Array<Transition> }} where
   *     - Transition :: Hash {predicate :: T -> E -> Boolean, action :: T -> E -> T, to :: State_Identifier}, where
   *       - E is a type representing an event (also named input symbol in the state machine terminology)
   *       - T is any non-trivial type which represent the data associated with the event
   *
   * @returns {process_fsm_internal_transition}
   * Side-effects :
   * - traceS property updated with the latest value of the array of traces
   */
  function process_fsm_internal_transition(fsm_def, fsm_write_trace, traceS) {
    // NOTE : for this synchronous state machine, the algorithm is pretty simplified :
    // - we do not need to separate action codes and action functions
    // - we do not need to wait for an action to return, as it returns immediately
    // - we removed the need to have an event enumeration by mapping the event object to the event type in one hashmap
    //   (we could actually do that too for the async. case I suppose)
    // -> Hence, all the input necessary to define the synchronous state machine are the states, and the transitions
    //    If we do not have entry/exit actions, we do not even need to hold the state information in one separate
    //    structure
    /**
     * Updates the state machine (available in the currying function closure) state by evaluation the transitions
     * available in the current state vs. the internal event (`merged_labelled_input`) passed as parameter
     * @param fsm_state {T} where :
     * - T represents the extended state (that we will refer to as model for lack a better term)
     *   managed by the internal state machine
     * - Here a `variable :: T` will have the controlled state (i.e. the proper state) of the internal state machine in
     *   `variable.internal_state.expecting`
     *   - This represents the type of input expected by the internal state machine, either effect response or user intent
     *
     * @param merged_labelled_input {Cycle_FSM_Input} where :
     * - Cycle_FSM_Input :: Hash { Event_Identifier -> E }
     * Here, E ::
     * - case Event_Identifier
     *   - 'intent' : Hash {code :: String, payload : Object}
     *   - 'effect_res' : Object
     *
     * Side-effects:
     * - fsm_state is updated according to the inner and outer transition taken
     */
    return function process_fsm_internal_transition(fsm_state, merged_labelled_input) {
      ////////////
      // Helper functions

      ////////////
      //
      var fsm_internal_states = fsm_def.states;
      var fsm_internal_transitions = fsm_def.transitions;
      var fsm_current_internal_state = fsm_state.internal_state.expecting;
      // Event format : {event_type : event}
      // `merged_labelled_input` should only have one key, which is the event type
      var internal_event_type = Object.keys(merged_labelled_input)[0];
      // the actual event has the following shape according to the event type:
      // intent -> {code, payload}, effect_res -> Object
      var internal_event = merged_labelled_input[internal_event_type];

      var evaluation_result = synchronous_fsm.evaluate_internal_transitions(
        fsm_internal_states,
        synchronous_fsm.get_internal_transitions(fsm_internal_transitions, fsm_current_internal_state, internal_event_type),
        /*-OUT-*/fsm_state, internal_event
      );

      if (evaluation_result.fatal_error) {
        throw evaluation_result.fatal_error;
      }
      else {
        var fsm_state_update = evaluation_result.fsm_state_update;
        // Case : no update
        // A value of `undefined` for fsm state update means that we must do nothing (no updates and nothing passed downstream)
        // TODO : review the logic of returning undefined (noop should replace that right?)
        if (utils.is_undefined(fsm_state_update)) return undefined;
        else {
          // Case : update to perform
          update_fsm_state(/*-OUT-*/fsm_state, fsm_state_update);
          fsm_write_trace(traceS, fsm_state, fsm_def, internal_event_type, internal_event, evaluation_result);
        }

        return fsm_state;
      }
    }
  }

  function update_fsm_state(fsm_state, fsm_state_update) {
    // The model is updated through a custom merge algorithm which allows for specifying CRUD operations
    // The rest of fsm_state is updated through extend (replacing entirely existing properties)
    var model = fsm_state.inner_fsm.model;
    var model_update = fsm_state.inner_fsm.model_update || {};
    _.extend(fsm_state, fsm_state_update);
    fsm_state.inner_fsm.model = update_model(model, model_update);
    // TODO : write tests to explain how the update works for the model (property merging)!!
  }

  function update_model(model, model_update) {
    return utils.merge(model, model_update);
  }

  /**
   * TODO : redocument the function
   * - transition format
   *   - events : if not present, then actions become automatic
   *   - condition(s) : if several, pass them in an array (field `conditions`), the order of the array is the order
   *                    of applying the conditions. When a single condition (field `condition`)
   *                    When the first is found true, the sequence of condition checking stops there
   *   - action : function (model, event_data) : model_prime
   *   - from : state from which the described transition operates
   *   - to : target state for the described transition
   * @param statechart
   * @param fsm_uri
   * @param user_generated_intent$
   * @param effect_response$
   * @param program_generated_intent$
   * @param trace_intentS
   * @param debug_intentS
   * @returns {{fsm_state$: Observable, model_update$: Observable, model$: Observable, effect_requests$: Observable, program_generated_intent_req$: Observable, fsm_state_steps$: Observable, trace$: *, dispose_listeners: dispose_listeners}}
   */

  function transduce_fsm_streams(statechart, fsm_uri,
                                 user_generated_intent$, effect_response$, program_generated_intent$, debug_intentS, trace_intentS) {
    //// Helpers
    //
    function new_typed_object(type) {
      return function (x) {
        return utils.new_typed_object(x, type);
      }
    }

    function filter_out_fsm_state_to_skip(fsm_state) {
      return !fsm_state.noop;
    }

    function filter_out_empty_effect_request(fsm_state) {
      return fsm_state.effect_execution_state
        && fsm_state.effect_execution_state.effect_request;
    }

    function enrich_effect_request(acc, /*-OUT-*/fsm_state) {
      var effect_req = fsm_state.effect_execution_state.effect_request;
      var next_token = acc.token++;
      effect_req.address = {
        uri: fsm_uri,
        token: next_token
      };

      return {
        token: next_token,
        effect_request: effect_req //TODO : would be safer to clone deep the request
      };
    }

    function filter_out_empty_model_update(fsm_state) {
      return !utils.is_empty(fsm_state.inner_fsm.model_update);
    }

    // Build the sinks :
    // - there are three source origins:
    //   - intents : they divide into user intents and automatic actions (program generated intents) from the state machine
    //   - effect results : they are the eventual return value from executing effects
    //   - trace : contain the information allowing to toggle the tracing mechanism

    // Traces array, represented as an observable property (behavior)
    // Will be updated whenever the array of traces is updated
    var traceS = new Rx.BehaviorSubject([]);

    var fsm_initial_state = compute_fsm_initial_state(statechart);
    var dispose_listeners = fsm_initial_state.dispose_listeners;
    fsm_initial_state.dispose_listeners = undefined; // We don't delete properties as it supposedly prevent compiler optimizations

    var outer_fsm = outer_fsm_def.get_internal_sync_fsm();

    var merged_labelled_sources$ = Rx.Observable.merge(
      Rx.Observable.merge(user_generated_intent$, program_generated_intent$)
        .map(new_typed_object(INTENT))
        .map(utils.label(EV_INTENT)),
      effect_response$
        .map(new_typed_object(EFFECT_RESPONSE))
        .map(utils.label(EV_EFFECT_RES)),
      debug_intentS,
      trace_intentS
        .map(new_typed_object(TRACE_INTENT))
        .map(utils.label(EV_TRACE))
    )
      .finally(function () {
        console.log('merged_labelled_sources$ terminated!!!!')
      })
      .do(function (x) {
        utils.rxlog(utils.get_label(x))(x[Object.keys(x)[0]]);
      });

    var fsm_state$ = merged_labelled_sources$
      .scan(process_fsm_internal_transition(outer_fsm, outer_fsm_write_trace, traceS), fsm_initial_state)
      .catch(function catch_fsm_state_errors(e) {
        console.error('error while process_fsm_internal_transition', e);
        console.info(e.extended_info);
        console.warn(e.stack);
        return Rx.Observable.throw(e);
      })
      .shareReplay(1);

    var fsm_state_actions$ = fsm_state$
      .filter(filter_out_fsm_state_to_skip);

    // The stream of effect requests
    var effect_requests$ = fsm_state_actions$
      .finally(function () {
        console.log('fsm_state$ terminated!!!!')
      })
      .filter(filter_out_empty_effect_request)
      .scan(enrich_effect_request, {token: 0})
      .pluck('effect_request')
      .filter(utils.identity)
      .do(utils.rxlog('effect request$'))
      .replay(1);

    // The stream of model updates
    // Can be anything that the function `update_model` understands
    var model_update$ = fsm_state_actions$
      .filter(filter_out_empty_model_update)
      .pluck('inner_fsm', 'model_update')
      .startWith(fsm_initial_state.inner_fsm.model)
      .do(utils.rxlog('new model update emitted'));

    // The model passed out by the stream should be read-only.
    // It should also only be passed if it has been updated (i.e. model_update is undefined)
    // Possible downstream write-effects are disarmed by deep cloning.
    // This ensures that the model is modified only here.
    var model$ = fsm_state_actions$
      .filter(filter_out_empty_model_update)
      .pluck('inner_fsm', 'model')
      .map(utils.clone_deep)
      .do(utils.rxlog('new model emitted'));

    // Intents generated internally (automatic actions)
    var program_generated_intent_req$ = fsm_state_actions$
      .filter(utils.get_prop('automatic_event'))
      .pluck('automatic_event')
      .startWith({
        code: EV_CODE_INIT,
        payload: fsm_initial_state.inner_fsm.model
      })
      .do(utils.rxlog('program_generated_intent_req$'))
      .publish();

    var fsm_state_steps$ = fsm_state_actions$
        .filter(function is_expecting_intent(fsm_state) {return fsm_state.internal_state.expecting === EXPECTING_INTENT})
        .do(utils.rxlog('fsm_state_steps$'))
      ;

    return {
      // NOTE : we use replay(1) or shareReplay(1) as there could be several consumers of the APIs subscribing on different ticks
      fsm_state$: fsm_state$, // NOTE : already shared
      model_update$: model_update$.shareReplay(1), // object representing the updates to do on the current model
      model$: model$.shareReplay(1), // the updated model
      effect_requests$: effect_requests$,
      program_generated_intent_req$: program_generated_intent_req$,
      fsm_state_steps$: fsm_state_steps$.shareReplay(1),
      trace$: traceS,
      dispose_listeners: dispose_listeners
    }
  }

  // TODO : check statechart format
  function check_statechart_format(statechart) {
    // TODO
    // - (from, to, event, action) is unique
  }

  function make_fsm(fsm_uri, statechart, user_generated_intent$) {
    var effect_requests_disposable, program_generated_intent_req_disposable;
    var effect_registry = statechart.effect_registry;
    var effect_responseS = new Rx.ReplaySubject(1);
    var program_generated_intentS = new Rx.ReplaySubject(1);
    var trace_intentS = new Rx.ReplaySubject(1);
    var debug_intentS = new Rx.ReplaySubject(1);

    check_statechart_format(statechart);

    var fsm_sinks = transduce_fsm_streams(statechart, fsm_uri,
      user_generated_intent$,
      effect_responseS, program_generated_intentS,
      debug_intentS, trace_intentS
    );
    var trace$ = fsm_sinks.trace$
      .takeUntil(trace_intentS.filter(is_trace_intent_false))
      .finally(utils.rxlog('ending tracing'))
      .share();
    var final_traceS = new Rx.AsyncSubject();
    var dispose_listeners = fsm_sinks.dispose_listeners;

    function start() {
      // TODO : investigate whether I need the connect part. Ideal would be to remove it for generality
      // Connecting requests streams to responses
      effect_requests_disposable = make_effect_driver(effect_registry)(fsm_sinks.effect_requests$)
        .subscribe(effect_responseS);
      program_generated_intent_req_disposable = fsm_sinks.program_generated_intent_req$
        .subscribe(program_generated_intentS);
      fsm_sinks.effect_requests$.connect(); // NOTE : ORDER HERE IS IMPORTANT!!
      fsm_sinks.program_generated_intent_req$.connect();
    }

    function stop() {
      // NOTE : once stopped the state machine cannot be restarted... maybe destroy or dispose is a better name?
      dispose_listeners();
      trace_intentS.onCompleted();
      program_generated_intentS.onCompleted();
      debug_intentS.onCompleted();
      effect_responseS.onCompleted();
      effect_responseS.onCompleted();
    }

    function dispose(disposable, name) {
      if (!Rx.Disposable.isDisposable(disposable)) {
        throw 'dispose : disposable parameter does not have a dispose function?!'
      }
      // Case : disposable is a subject, hence an observer : signal completion to allow downstream streams to finalize cleanly
      disposable.onCompleted && disposable.onCompleted();
      // This allows to cover both subjects and subscriptions disposal
      if (!disposable.isDisposed) {
        console.log('disposing ' + name);
        disposable.dispose();
      }
    }

    // Trace mechanism
    //
    // - Activation and deactivation
    //   The behaviour of the state machine can be traced. This is particularly helpful for testing purposes, but should be
    //   avoided anywhere performance matters, as the tracing slows down the execution of the state machine.
    //   The tracing process is as is :
    //
    //   - activate the trace mechanism : `fsm.start_trace()`
    //     From that moment on, every expected processing step of the state machine will result in a trace record inserted
    //     in a trace array.
    //   - deactivate the trace mechanism : `fsm.stop_trace()`
    //     From that moment on, the state machine is no longer traced on. The state machine produces the array of traces via
    //     an observable which output only one value, and must be subscribed with a trace handler which receive the trace array
    //     : `fsm.trace$.subscribe(trace_handler)`
    //
    // - Event simulation
    //   To have the state machine react to a given event provoked by the user, a helper method is available :
    //   `fsm.send_event :: Event -> ()`
    //   NOTE : When sending sequences of events, be careful to pace them appropriately so the next event comes
    //          after the previous event is finished being processed.
    //
    // - Type information
    // traces :: [Trace] where
    //   Trace :: Hash {event :: Event, model :: Model, resulting_state :: State_Enum, time_stamp :: Date} |
    //            Hash {event :: Event, model :: Model, resulting_state :: State_Enum, recoverable_error :: Recov_Error, time_stamp :: Date}
    //   where :
    //     Event :: Hash {code :: Event_Enum, payload :: Any}
    //     State_Enum :: String_Identifier
    //     Model (implements cloneable, serializable) :: Any
    //     Recov_Error :: Hash {error :: Error, resulting_state :: State_Enum, event :: Event_Enum, event_data :: Any}
    // If no error occured during an execution step of the state machine, Trace format does not have an error field
    // If a recoverable error occured, Trace format does have a `recoverable_error` field
    // If a fatal error occurred, the application is possibly abruptly exited, and no trace records are available at all
    function start_trace() {
      // Sends a program-generated event to start the tracing mechanism
      // Subscribe an async subject to the trace observable so that only one value, the last one is kept
      // That value is the (last) array of traces
      trace_intentS.onNext(make_intent(EV_CODE_TRACE, true));
      trace$
        .catch(function (e) {
          console.error('start_trace : error ', e);
          return Rx.Observable.throw(e);
        })
        .subscribe(final_traceS);
    }

    function stop_trace() {
      trace_intentS.onNext(make_intent(EV_CODE_TRACE, false));
    }

    function is_trace_intent_false(x) {
      return !x.payload;
    }

    function send_event(data) {
      // NOTE : debug_intent must be custom typed and labelled
      var label = utils.get_label(data);
      if ([EV_INTENT, EV_EFFECT_RES, EV_TRACE].indexOf(label) > -1) {
        debug_intentS.onNext(data);
      }
      else {
        throw 'unknown label for event!!'
      }
    }

    return {
      start: start,
      stop: stop,
      model$: fsm_sinks.model$.share(), // defensively share the model in case it is subscribed several times over
      model_update$: fsm_sinks.model_update$.share(),
      fsm_state$: fsm_sinks.fsm_state$,
      fsm_state_steps$: fsm_sinks.fsm_state_steps$,
      trace$: final_traceS, // by subscribing to trace$, only one value will be output, the array of traces recorded
      start_trace: start_trace,
      stop_trace: stop_trace,
      send_event: send_event,
      serialize: utils.nok, // TODO
      deserialize: utils.nok, // TODO
      set_internal_state: fsm_sinks.set_internal_state, // TODO but should be used only for testing
      get_internal_state: fsm_sinks.get_internal_state // TODO but should be used only for testing
    }
  }

  /**
   *
   * @param {Effect_Registry} effect_registry_
   * @returns {Function (Request_Stream) : Response_Stream}
   */
  function make_effect_driver(effect_registry_) {
    ///////////
    // Helpers
    function set_effect_registry_custom_types(effect_registry) {
      var typed_registry = {};
      _.forEach(effect_registry, function (effect_handler_or_driver_registry, driver_family) {
        if (utils.is_function(effect_handler_or_driver_registry)) {
          // Case : effect_handler
          typed_registry[driver_family] = utils.new_typed_object(effect_handler_or_driver_registry, EFFECT_HANDLER);
        }
        else {
          utils.assert_type(effect_handler_or_driver_registry, 'object', {
            message: 'set_effect_registry_custom_types : effect_registry : found an driver_family which is undefined or not an object!',
            extended_info: {effect_registry: effect_registry, driver_family: driver_family}
          });
          var factory = effect_handler_or_driver_registry.factory;
          utils.assert_type(factory, 'function', {
            message: 'set_effect_registry_custom_types : effect_registry : factory for driver family must be a function!',
            extended_info: {
              effect_registry: effect_registry,
              effect_handler_or_driver_registry: effect_handler_or_driver_registry
            }
          });
          var settings_registry = effect_handler_or_driver_registry.settings;
          if (utils.is_undefined(settings_registry)) throw Err.Registry_Error({
            message: 'set_effect_registry_custom_types : effect_registry : no driver settings found for driver family!',
            extended_info: {
              effect_registry: effect_registry,
              driver_family: driver_family
            }
          });
          _.forEach(settings_registry, function (settings, driver_name) {
            utils.assert_type(driver_name, 'string', {
              message: 'set_effect_registry_custom_types : effect_registry : driver name must be a non-empty string!',
              extended_info: {
                effect_registry: effect_registry,
                driver_family: driver_family,
                driver_name: driver_name
              }
            });
          });
          typed_registry[driver_family] = utils.new_typed_object(effect_handler_or_driver_registry, DRIVER_REGISTRY)
        }
      });
      return typed_registry;
    }

    function check_effect_request_format(effect_registry) {
      return function check_effect_request_format(effect_request) {
        if (utils.has_custom_type(effect_request, LAST_EFFECT_REQUEST)) return;
        if (!effect_request) throw Err.Effect_Error({message: 'check_effect_request_format : effect_request cannot be undefined!'});
        if (effect_request && effect_request.command === COMMAND_IGNORE) return;
        if (!effect_request.driver) throw Err.Effect_Error({message: 'check_effect_request_format : driver cannot be undefined!'});
        if (!effect_request.address) throw Err.Effect_Error({message: 'check_effect_request_format : address cannot be undefined!'});
        if (!effect_request.command || [COMMAND_EXECUTE, COMMAND_CANCEL, COMMAND_IGNORE].indexOf(effect_request.command) === -1) {
          throw Err.Effect_Error({message: 'check_effect_request_format : command can only be "execute" or "cancel"!'});
        }
        if (!effect_request.driver.family) throw Err.Effect_Error({message: 'check_effect_request_format : driver family cannot be undefined!'});
        if (!utils.has_custom_type(effect_registry[effect_request.driver.family], EFFECT_HANDLER)) {
          // if not an effect handler, it is a driver, and name must be set to associate the settings
          if (!effect_request.driver.name) throw Err.Effect_Error({message: 'check_effect_request_format : driver names within a driver family must be non-empty strings!'});
        }
      }
    }

    function filter_request_by_driver_family(family, driver_name) {
      return function filter_request_by_driver_family(effect_request) {
        return (effect_request.command !== COMMAND_IGNORE)
          && effect_request.driver.family === family
          && effect_request.driver.name === driver_name
      }
    }

    function filter_out_cancelled_requests(effect_request) {
      return effect_request.command !== COMMAND_CANCEL;
    }

    function get_is_active_driver(hashmap, driver_family, driver_name) {
      return driver_family && driver_name && hashmap[driver_family] && !!hashmap[driver_family][driver_name]
    }

    function set_in_active_drivers(hashmap, driver_family, driver_name, flag) {
      hashmap[driver_family] = hashmap[driver_family] || [];
      hashmap[driver_family][driver_name] = flag;
    }

    function remove_from_active_drivers(hashmap, driver_family, driver_name) {
      hashmap[driver_family][driver_name] = undefined;
    }

    function decorate_result_with_request_info(filtered_effect_request, effect_result) {
      return {
        effect_result: effect_result,
        effect_request: filtered_effect_request
      };
    }

    function filter_out_cancelled_request(decorated_request_info, cancelled_requests) {
      // Edge case : undefined cancelled requests
      if (!cancelled_requests) return undefined;

      // IMPLEMENTATION NOTE : Cancel mechanism
      // If the cancel is received before the result comes : fine
      // If the cancel comes afterward, the effect response might still go through but it should be filtered then
      // downstream by the state machine using the token
      var address = decorated_request_info.effect_request.address;
      var address_uri = address.uri;
      var address_token = address.token;

      // Case : request is NOT cancelled
      // IMPLEMENTATION NOTE : this implementation works because `cancelled_requests` is a de facto observable
      // As a matter of fact, it is passed by reference and updated within the scan (eq. to using a subject)
      // DOCUMENTATION NOTE : token is PER fsm (not per driver), so each request emitted by the fsm has a different token
      // that means address.uri is fsm_uri and address.token is request_uri
      // or uri: {fsm :: string, request :: number}
      return !(cancelled_requests[address_uri] && cancelled_requests[address_uri][address_token])
        ? decorated_request_info
        : undefined
    }

    function enrich_effect_res_error(error, effect_registry, effect_request) {
      error.extended_info = error.extended_info || {};
      error.extended_info.effect_registry = effect_registry;
      error.extended_info.effect_request = effect_request;
    }

    function execute_effect_handler(effect_handler_or_driver_registry, effect_request_params) {
      console.info("THEN : we execute the effect " + effect_handler_or_driver_registry.name);
      return effect_handler_or_driver_registry(effect_request_params);
    }

    function process_effect_request_ignore(effect_driver_state, effect_request) {
      effect_driver_state.effect_response$ = Rx.Observable.return(
        decorate_result_with_request_info(effect_request, {})
      );
      return effect_driver_state;
    }

    /**
     * Side-effects : updates `effect_driver_state.cancelled_requests`
     * @param effect_driver_state
     * @param {Effect_Request} effect_request
     * @returns {*}
     */
    function process_effect_request_cancellation(effect_driver_state, effect_request) {
      /** @type Address_Struct*/
      var address = effect_request.address;
      var address_uri = address.uri;
      var address_token = address.token;

      var cancelled_requests = effect_driver_state.cancelled_requests || {};
      if (!(cancelled_requests[address_uri] && cancelled_requests[address_uri][address_token])) {
        // Case : cancelled command is not already in the cancelled commands structure
        // Add it
        cancelled_requests[address_uri] = cancelled_requests[address_uri] || {};
        cancelled_requests[address_uri][address_token] = {}; // any truthy value here works
      }
      effect_driver_state.effect_response$ = undefined;
      return effect_driver_state;
    }

    /**
     * Side-effects : updates `effect_driver_state.effect_response$`
     * @param effect_driver_state
     * @param {Effect_Request} effect_request
     * @param {Effect_Registry} effect_registry
     * @param {Rx.Observable} effect_requests$
     * @returns {*}
     */
    function process_effect_request_execution(effect_driver_state, effect_registry, effect_request, effect_requests$) {
      var driver = effect_request.driver;
      var effect_request_params = effect_request.params;
      var driver_family = driver.family;
      var driver_name = driver.name;
      var effect_result$ = undefined;
      var active_drivers = effect_driver_state.hashmap;
      var effect_handler_or_driver_registry = effect_registry[driver_family];
      var filtered_effect_requests$ = effect_requests$
          .filter(filter_request_by_driver_family(driver_family, driver_name))
          .filter(filter_out_cancelled_requests)
        ;

      utils.assert_type(driver_family, 'string', {
        message: 'process_effect_request_execution : effect_registry : driver_family must be a string!',
        extended_info: {effect_registry: effect_registry}
      });

      if (utils.has_custom_type(effect_handler_or_driver_registry, EFFECT_HANDLER)) {
        var effect_result = Err.try_catch(execute_effect_handler)(effect_handler_or_driver_registry, effect_request_params);
        // Covers both successful and error-throwing effect execution - the error is encapsulated in the effect result
        // NOTE : !! If the effect handler wants to return an observable, it must encapsulate it
        //        i.e. (in effect handler body) ... return Rx.Observable.return(obs$)
        //        otherwise the `mergeAll` will inline it
        //        This allows for example to use ractive stream adaptor to continously display a stream of values
        effect_result$ = utils.to_observable(effect_result);
      }
      else if (utils.has_custom_type(effect_handler_or_driver_registry, DRIVER_REGISTRY)) {
        // case : effect_request calls for a driver which is defined in the registry AND is dealt with by a stream operator
        var is_active_driver = get_is_active_driver(active_drivers, driver_family, driver_name);
        var factory = effect_handler_or_driver_registry.factory; // NOTE : already type checked
        var driver_setting_registry = effect_handler_or_driver_registry.settings;
        var driver_settings = driver_setting_registry[driver_name]; // NOTE : is allowed to be undefined

        if (!is_active_driver) {
          // Case : driver is not active
          // apply the driver to the effect request sources, filtering for the requests relevant to it
          var effect_driver_operator = Err.try_catch(factory)(driver_settings);
          utils.assert_type(effect_driver_operator, 'function', {
            message: 'process_effect_request_execution : DRIVER_REGISTRY : factories must return a function!',
            extended_info: {effect_registry: effect_registry, effect_driver_operator: effect_driver_operator}
          });

          var effect_res$ = Err.try_catch(effect_driver_operator)(filtered_effect_requests$);
          // Case : driver THROWS an error - whatever kind of error it is, it is returned as error code (no throwing)
          //        to be dealth with upstream (for instance at FSM level)
          //        Driver was not active, and we leave it that way, so it is retried with the next request
          if (effect_res$ instanceof Error) {
            enrich_effect_res_error(/*-OUT-*/effect_res$, effect_registry, effect_request);
            effect_result$ = Rx.Observable.return(Err.Effect_Error(effect_res$));
          }
          else {
            // Case : drivers RETURNS an error or a normal result
            utils.assert_type(effect_res$, 'Observable', {
              message: 'process_effect_request_execution : DRIVER_REGISTRY : factories must return an observable!',
              extended_info: {effect_driver_operator: effect_driver_operator, effect_res$: effect_res$}
            });

            // Set the driver as already active (i.e. dealing with the associated `effect_request` stream)
            set_in_active_drivers(/*-OUT-*/active_drivers, driver_family, driver_name, true);
            effect_result$ = effect_res$
              .do(utils.rxlog('effect_result'))
              .finally(function () {
                // NOTE : driver is terminated after error or graciouly,
                // remove the driver from cache, so it is recreated next time
                // TODO : add a test to
                remove_from_active_drivers(/*-OUT-*/active_drivers, driver_family, driver_name);
              })
              .catch(function catch_effect_driver_errors(e) {
                // NOTE : driver is terminated after error, remove the driver from cache, so it is recreated next time
                remove_from_active_drivers(/*-OUT-*/active_drivers, driver_family, driver_name);
                enrich_effect_res_error(/*-OUT-*/utils.to_error(e), effect_registry, effect_request);
                return Rx.Observable.return(Err.Effect_Error(e));
              });
          }
        }
        else {
          // Case : driver is in cache
          // That means the driver is already set to handle its stream of requests, so there is nothing more to do
        }
      }
      else {
        // case : we don't know what to do with that unknown type
        throw Err.Registry_Error({
          message: 'process_effect_request_execution : effect_handler_or_driver_registry : driver_family has unset or unexpected custom type!',
          extended_info: {effect_handler_or_factory: effect_handler_or_driver_registry}
        });
      }

      // nice to have : have the driver implement a cancel API?? a retry API?? NO FOR NOW
      effect_driver_state.effect_response$ = effect_result$
        ? filtered_effect_requests$
        .zip(effect_result$, decorate_result_with_request_info)
        : undefined;

      return effect_driver_state;
    }

    function compute_effect_res(effect_requests$) {
      return function compute_effect_res(/*-OUT-*/effect_driver_state, effect_request) {
        var driver = effect_request.driver;
        var command = effect_request.command;
        var driver_family = driver.family; // if command is ignore, there is not necessarily a driver field
        var is_execute_command = (command === COMMAND_EXECUTE);
        var is_cancel_command = (command === COMMAND_CANCEL);
        var is_ignore_command = (command === COMMAND_IGNORE);

        // Edge case : effect_request calls for a driver which is not defined in the registry
        if (!is_ignore_command && !(driver_family in effect_registry)) {
          throw new Error('compute_effect_res : driver not defined in effect registry')
        }

        return is_execute_command
          // Case : execute command
          // NOTE : this implementation supposes that a request can be required to be cancelled only after having been requested
          ? process_effect_request_execution(/*-OUT-*/effect_driver_state, effect_registry, effect_request, effect_requests$)
          // Case : cancel command
          // Add the command to the cancelled command hash if not already there
          : is_cancel_command
          ? process_effect_request_cancellation(/*-OUT-*/effect_driver_state, effect_request)
          : is_ignore_command
          ? process_effect_request_ignore(/*-OUT-*/effect_driver_state, effect_request)
          : undefined
      }
    }

    ///////////
    // Body

    // Case : no effect registry : possible as we can have FSM with only pure actions
    var effect_registry = set_effect_registry_custom_types(effect_registry_) || {};
    var effect_driver_initial_state = {
      hashmap: {},
      cancelled_requests: {},
      effect_response$: undefined
    };

    // TODO : cancelled request array is ever growing, find a way to remove cancelled requests from the array (closure)
    return function effect_driver(effect_requests$) {
      var effect_driver_state$ = effect_requests$
        .do(check_effect_request_format(effect_registry)) // throws an exception if wrong format
        .do(utils.rxlog('effect request'))
        .scan(compute_effect_res(effect_requests$), effect_driver_initial_state)
        .do(utils.rxlog('effect driver execution state'))
        .catch(function catch_fatal_errors(e) {
          // Case : recoverable errors are supposed to be caught upstream and returned as error codes
          // Fatal errors are thrown (type contracts, etc.)
          // We catch them here and return them also as error code but with a specific code
          // so the FSM can decide how to react to this type of error
          console.error('catch_fatal_errors', e);
          console.info(e.extended_info);
          console.warn(e.stack);
          return Rx.Observable.return(Err.Fatal_Error(e));
        })
        .share();

      var cancelled_requests$ = effect_driver_state$.pluck('cancelled_requests')
          .filter(utils.identity) // filtering undefined `effect_response` (case : cancel command | error)
          .do(utils.rxlog('cancelled requests'))
        ;

      var effect_response$ = effect_driver_state$
          .pluck('effect_response$')
          .filter(utils.identity) // filtering undefined `effect_response` (case : cancel command | error)
          .mergeAll()
          .do(utils.rxlog('effect response '))
          .withLatestFrom(cancelled_requests$, filter_out_cancelled_request)
          .do(utils.rxlog('filtered effect response'))
          .filter(utils.identity) // filtering out undefined `effect_response` (case : cancel command)
        ;

      return effect_response$;
    };
  }

  return {
    make_fsm: make_fsm,
    make_effect_driver: make_effect_driver,
    transduce_fsm_streams: transduce_fsm_streams,
    process_fsm_internal_transition: process_fsm_internal_transition
  };
}

// Type definitions for actions handlers
/**
 * @typedef {String} State_Name
 */
/**
 * @typedef {*} Effect_Result
 */
/**
 * @typedef {Object} Unaddressed_Effect_Request
 * @property {Driver_Struct} driver
 * @property {*} params
 */
/**
 * @typedef {Rx.Observable<Effect_Request>} Request_Stream
 */
/**
 * @typedef {Rx.Observable<Effect_Response>} Response_Stream
 */
/**
 * @typedef {Object} Effect_Response
 * @property {Effect_Request} effect_request
 * @property {Effect_Result} effect_result
 */
/**
 * @typedef  {Object} Action_Handler_Result
 * @property {*} model_update
 * @property {Unaddressed_Effect_Request} effect_request
 */
/**
 * @typedef  {function (*, *, Effect_Result, Number)} Action_Handler
 * @param {Object} model.
 * @param {Object} event_data.
 * @param {Effect_Result} effect_res.
 * @param {Number} index.
 * @property {Number} effect_number
 */
/**
 * @typedef  {function (*, *)} Pure_Action_Handler
 * @param {Object} model.
 * @param {Object} event_data.
 */
/**
 * @typedef  {function (*, *, Effect_Result)} Effectful_Action_Handler
 * @param {Object} model.
 * @param {Object} event_data.
 * @param {Object} effect_res.
 */

// Typedefs for event handler
/**
 * @typedef  {function (*, *, *)} Event_Handler
 * @param {*} model.
 * @param {*} event_data.
 * @param {*} current_state.
 */
/**
 * @typedef  {Object} Event_Handler_Result
 * @property {Predicate} predicate
 * @property {Action_Handler} action_seq_handler
 * @property {State_Name} from
 * @property {State_Name} to
 *
 */
/**
 * @typedef {function (*,*) : Boolean} Predicate
 * @param {*} model.
 * @param {*} event_data.
 */

// Type definitions for drivers and effect handlers
/**
 * @typedef {String} Driver_Name
 */
/**
 * @typedef {String} Driver_Family_Name
 */
/**
 * @typedef {Object} Driver_Settings
 */
/**
 * @typedef {Object<Driver_Name, Driver_Settings>} Driver_Settings_Registry
 * @dict
 */
/**
 * @typedef {function(Rx.Observable):Rx.Observable} Driver_Operator
 */
/**
 * @typedef {function(Driver_Settings):Driver_Operator} Driver_Factory
 */
/**
 * @typedef {Object} Driver_Registry
 * @property {factory} Driver_Factory
 * @property {settings} Driver_Settings_Registry
 */
/**
 * @typedef {function(effect_request_params : object)} Effect_Handler
 */
/**
 * @typedef {Object<Driver_Family_Name, (Effect_Handler|Driver_Registry)>} Effect_Registry
 * @dict
 */
/**
 * @typedef {Object} Effect_Response
 * @property {Effect_Result} effect_result
 * @property {Effect_Request} effect_request
 */
/**
 * @typedef {Object} Effect_Request
 * @property {String} command
 * @property {Driver_Struct} driver
 * @property {Address_Struct} address
 * @property {*} params
 */
/**
 * @typedef {Object} Driver_Struct
 * @property {String} family
 * @property {String} name
 */
/**
 * @typedef {Object} Address_Struct
 * @property {String} uri
 * @property {Number|String} token
 */
