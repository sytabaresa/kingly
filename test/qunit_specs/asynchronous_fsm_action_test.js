define(function (require) {
  const DUMMY = 'dummy', DUMMY_FIELD = 'dummy_field', DUMMY_EVENT_DATA_VALUE = 24, DUMMY_ERROR = 'dummy error';
  var utils = require('utils');
  var Err = require('custom_errors');
  var fsm = require('asynchronous_fsm');
  var fsm_helpers = require('fsm_helpers');
  var constants = require('constants');
  var assert = undefined;

  const EV_CODE_INIT = constants.EV_CODE_INIT;
  const EXECUTE = constants.commands.EXECUTE;
  const CANCEL = constants.commands.CANCEL;
  const EV_INTENT = constants.EV_INTENT;
  const EV_EFFECT_RES = constants.EV_EFFECT_RES;
  const INTENT = constants.INTENT;
  const EFFECT_RESPONSE = constants.EFFECT_RESPONSE;

  // Common set-up
  var states_definition = {A: '', B: '', C: '', D: '', E: ''};
  var states = fsm_helpers.create_state_enum(states_definition);
  var event_enum = ['event1', 'event2', 'event3'];
  var events = fsm_helpers.create_event_enum(event_enum);

  ///////
  // Helpers
  window.onerror = function (msg, url, lineNo, columnNo, error) {
    console.error(error);
    return false;
  };

  function exec_on_tick(fn, tick) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      setTimeout(function () {
        fn.apply(null, args)
      }, tick);
    }
  }

  function remove_timestamp(obj) {
    obj && obj.timestamp && (delete obj.timestamp);
    return obj;
  }

  function clean(arr_fsm_traces) {
    arr_fsm_traces.forEach(function clean_array_traces(fsm_trace) {
      delete fsm_trace.inner_fsm.hash_states;
      delete fsm_trace.inner_fsm.is_auto_state;
      delete fsm_trace.inner_fsm.is_group_state;
      delete fsm_trace.inner_fsm.is_init_state;
      delete fsm_trace.dispose_listeners;
      fsm_trace.recoverable_error && delete fsm_trace.recoverable_error.timestamp;

      var action_seq_handler = fsm_trace.effect_execution_state && fsm_trace.effect_execution_state.action_seq_handler;
      action_seq_handler && (fsm_trace.effect_execution_state.action_seq_handler = action_seq_handler.name);

      clean_error_field(fsm_trace, 'fatal_error');
      clean_error_field(fsm_trace, 'recoverable_error');
    });
    return arr_fsm_traces;

    function clean_error_field(fsm_trace, field) {
      if (fsm_trace[field]) {
        delete fsm_trace[field].detail;
        delete fsm_trace[field].error_code;
        delete fsm_trace[field].is_app_error;
        delete fsm_trace[field].toString;
        fsm_trace[field] = JSON.parse(JSON.stringify(fsm_trace[field]));
      }
    }

  }

  function test_on_error(e) {
    console.error('unexpected error found in testing stream', e);
  }

  /**
   * Starts a state machine test by sending a sequence of events to the state machine defined by a statechart and an uri
   * @param {String} fsm_uri
   * @param statechart
   * @param {function(Array) : function} error_cb Curried function which is passed the array of fsm traces and which is called in case of error in the stream
   * @param {function (Array) : function} complete_cb Curried function which is passed the array of fsm traces and which is called in case of completion of the stream
   * @returns {*}
   */
  function start_ehfsm_test(fsm_uri, statechart, error_cb, complete_cb) {
    var arr_fsm_traces = [];
    var ehfsm = fsm.make_fsm('fsm_uri', statechart, undefined); // intent$ is undefined here as we will simulate events

    ehfsm.fsm_state$
      .finally(function () {
        console.log('ending test event sequence', arr_fsm_traces)
      })
      .catch(function stop_fsm(e) {
        setTimeout(function () { ehfsm.stop()}, 2);
        var fsm_error_state = e.extended_info.fsm_state; // NOTE : by construction all errors have extended_info property
        fsm_error_state.fatal_error = e;
        delete fsm_error_state.fatal_error.extended_info.fsm_state;
        return Rx.Observable.return(fsm_error_state);
      })
      .subscribe(function on_next(fsm_state) {
        console.log('fsm_state...', utils.clone_deep(fsm_state));
        arr_fsm_traces.push(utils.clone_deep(fsm_state));
      }, error_cb(arr_fsm_traces), complete_cb(arr_fsm_traces));
    ehfsm.start(); // `start` initiates the inner dataflow subscription
    // NOTE : The init event is sent automatically AND synchronously so we can put the stop trace right after

    return ehfsm;
  }

  /**
   * IMPORTANT : All effects (or complete steps in the state machine) must take less than 100ms to be executed
   * @param fsm
   * @param {Array} event_sequence
   */
  function send_timed_sequence_and_stop(fsm, event_sequence) {
    if (!utils.is_array(event_sequence)) throw 'send_sequence_and_stop : event sequence must be an array!'
    if (event_sequence.length === 0) throw 'send_sequence_and_stop : event sequence must at least have one event!'

    function stop_fsm() {
      // NOTE !! This leaves Xms for each step to complete
      // This means that if by any chance an effect takes more than Xms to complete,
      // we incorrectly stop the state machine in an intermediary state (i.e. state expecting effect result)
      // So in all tests we must make sure that all effect handlers are taking less than Xms...
      fsm.fsm_state_steps$.debounce(100).take(1).subscribe(console.log.bind(console), utils.noop, stop_fsm);
      function stop_fsm() {
        console.log('send_synchronized_sequence_and_stop: completed');
        fsm.stop();
      }
    }

    // First subscribe to fsm_state_step$ to initiate the data flow prior to sending events
    // Otherwise, we have a bug in the edge case of sending only ONE event
    fsm.fsm_state_steps$.subscribe(utils.noop);

    var max_tick = -1;
    event_sequence.forEach(function (event_definition) {
      var tick = event_definition[0];
      max_tick = Math.max(tick, max_tick);
      var event = event_definition[1];
      exec_on_tick(fsm.send_event, tick)(event);
    });

    // This ensures that the state machine stops always AFTER all events are sent
    exec_on_tick(stop_fsm, max_tick + 100)();
  }

  function send_synchronized_sequence_and_stop(fsm, event_sequence) {
    // NOTE : synchronization is made on fsm_state_steps stream
    if (!utils.is_array(event_sequence)) throw 'send_sequence_and_stop : event sequence must be an array!';
    var event_sequence_length = event_sequence.length;
    if (event_sequence_length === 0) throw 'send_sequence_and_stop : event sequence must at least have one event!';

    Rx.Observable.from(event_sequence)
      .zip(fsm.fsm_state_steps$, utils.identity)
      .subscribe(
      fsm.send_event,
      utils.rxlog('send_synchronized_sequence_and_stop: error'),
      function stop_fsm() {
        function stop_fsm() {
          console.log('send_synchronized_sequence_and_stop: completed');
          fsm.stop();
        }

        fsm.fsm_state_steps$.debounce(100).take(1).subscribe(utils.noop, utils.noop, stop_fsm);
      }
    );
  }

  function make_intent(event_enum, event_data) {
    var obj = {};
    obj[EV_INTENT] = utils.new_typed_object({code: event_enum, payload: event_data}, INTENT);
    return obj;
  }

  function make_effect_response(effect_response) {
    var obj = {};
    obj[EV_EFFECT_RES] = effect_response;
    obj[EV_EFFECT_RES] = utils.new_typed_object(effect_response, EFFECT_RESPONSE);

    return obj;
  }

  ////////
  // GROUP : Basic transition mechanism
  // SUBGROUP : Pure and effectul actions and action sequences

  // Pure Actions
  function set_dummy_field(assert, done) {
    return function set_dummy_field(model, event_payload) {
      assert.deepEqual({model: model, ep: event_payload},
        {model: {}, ep: DUMMY_EVENT_DATA_VALUE},
        'Pure actions are executed with the parameters (model, event_data) in that order');
      done();
      var model_update = {};
      model_update [DUMMY_FIELD] = event_payload;
      return model_update;
    }
  }

  function set_dummy_field_to_true(model, event_payload) {
    var model_update = {};
    model_update [DUMMY_FIELD] = true;
    return model_update;
  }

  // Predicates
  function has_dummy_field(model, event_data) {
    return !!model[DUMMY_FIELD];
  }

  function has_not_dummy_field(model, event_data) {
    return !model[DUMMY_FIELD];
  }

  // Miscellaneous params
  var hash_storage = {};
  var model0 = {key1: 'value'};
  Object.freeze(model0);
  var event_data1 = {event_data: 'value'};
  var params_1 = {key: 'element 1', value: 'value1'};
  var params_2 = {key: 'element 2', value: 'value2'};

  // Action sequence handlers
  function get_test_sequence_handlers(assert) {
    function effect_array_storage_1(model, event_data, effect_res) {
      assert.deepEqual({model: model, event_data: event_data, effect_res: effect_res}, {
        model: model0, event_data: event_data1, effect_res: undefined
      }, 'Effectful actions : effect functions are called with the model, event data, and effect result as parameters.');
      assert.deepEqual(effect_res, undefined, 'Effectful actions : the first effect function is called with no effect result.');
      return {
        model_update: {trace: event_data},
        effect_request: {
          driver: {
            family: 'array_storage',
            name: 'size_5'
          },
          params: 'element 1'
        }
      }
    }

    function effect_array_storage_2(model, event_data, effect_res) {
      // reminder : returns {model_update : , effect_request:}
      var updated_model0 = utils.clone_deep(model0); // !! clone it, as it is reused later on in successive tests
      updated_model0.trace = event_data1;
      var first_effect_result = new Array(5);
      first_effect_result[0] = 'element 1';
      assert.deepEqual(model, updated_model0, 'Effectful actions : the second effect function is called with the updated model from the effect result of the first effect function.');
      assert.deepEqual(effect_res, first_effect_result, 'Effectful actions : the second effect function is called with the effect result of the first effect function.');
      assert.deepEqual(event_data, event_data1, 'Effectful actions : All effect functions are called with the same event data.');
      return {
        model_update: {
          trace: [model.trace, event_data, effect_res]
        },
        effect_request: undefined
      }
    }

    function effect_hash_storage_1(model, event_data, effect_res) {

      return {
        model_update: {
          args_first_call_except_model: [event_data, effect_res],
          hash_storage: utils.clone_deep(hash_storage),
          trace: undefined, // removing previous trace fields
          key1: undefined, // removing previous trace fields
          args_second_call_except_model: undefined // undefining for reuse of the effect function
        },
        effect_request: {
          driver: {family: 'hash_storage'},
          params: {key: 'element 1', value: 'value1'}
        }
      }
    }

    function effect_hash_storage_2(model, event_data, effect_res) {

      return {
        model_update: {
          args_second_call_except_model: [event_data, effect_res],
          hash_storage: utils.clone_deep(hash_storage)
        },
        effect_request: undefined
      }
    }

    return {
      effect_array_storage_1: effect_array_storage_1,
      effect_array_storage_2: effect_array_storage_2,
      effect_hash_storage_1: effect_hash_storage_1,
      effect_hash_storage_2: effect_hash_storage_2
    }
  }

  // Effect registry
  var effect_registry = {
    array_storage: {
      factory: function array_storage_factory(settings) {
        var storage = new Array(settings.size);
        var index = 0;
        return function array_storage_driver(effect_requests$) {
          return effect_requests$
            .do(function store_value(x) {storage[index++] = x.params;})
            .delay(2)
            .map(function () {return storage;})
        }
      },
      settings: {
        size_5: {
          size: 5
        },
        size_10: {
          size: 10
        }
      }
    },
    hash_storage: function hash_storage_handler(req_params) {
      hash_storage [req_params.key] = req_params.value;
      return Rx.Observable.return(hash_storage).delay(1);
    }
  };

  //
  function test_on_error(arr_fsm_traces) {
    return function test_on_error_(e) {
      console.error('test in error', e);
    }
  }

  QUnit.skip("Basic transition mechanism - Pure actions", function test_pure_actions(assert) {
    ////////
    // GIVEN a chart spec :
    // no state hierarchy
    // model0 :: undefined
    // state definition :: {A: '', B: '', C:'', D:'',E:''}
    // event enumeration :: ['event1', 'event2', 'event3']
    // action list :: []
    // transition definition ::
    // - NOK : INIT -> A
    // - A : event1 -> B
    // - B : event2 / true -> C
    // - C : event2 / ?dummy_field -> D : set field 'dummy_field' to true
    // - C : event2 / !dummy_field -> C : set field 'dummy_field' to event data
    // - D : event2 -> D : throw some exception
    // - D : event3 -> E
    // - E : event3 / false -> E : set field 'dummy_field' to false

    var done = assert.async(2); // Cf. https://api.qunitjs.com/async/

    var model0 = undefined;
    var states_definition = {A: '', B: '', C: '', D: '', E: ''};
    var states = fsm_helpers.create_state_enum(states_definition);
    var event_enum = ['event1', 'event2', 'event3'];
    var events = fsm_helpers.create_event_enum(event_enum);
    var transitions = [
      {from: states.NOK, to: states.A, event: events[EV_CODE_INIT]},
      {from: states.A, to: states.B, event: events.EVENT1},
      {from: states.B, to: states.C, event: events.EVENT2, predicate: utils.always(true)},
      {
        from: states.C, event: events.EVENT2, guards: [
        {predicate: has_dummy_field, to: states.D, action: set_dummy_field_to_true},
        {predicate: has_not_dummy_field, to: states.C, action: set_dummy_field(assert, done)}
      ]
      },
      //            {from: states.D, to: states.D, event: events.EVENT2, predicate: utils.always(true), action: action_enum.throw_dummy_error},
      {from: states.D, to: states.E, event: events.EVENT3, predicate: utils.always(false)}
      // - D : event3 / false -> D : set field 'dummy_field' to 0
    ];
    var state_chart = {
      model: model0,
      state_hierarchy: states,
      events: events,
      transitions: transitions
    };
    var arr_fsm_traces = [];

    var ehfsm = fsm.make_fsm('fsm_uri', state_chart, undefined); // intent$ is undefined here as we will simulate events
    ehfsm.model_update$.subscribe(function (model_update) {
      console.warn('model update', model_update);
    }); // We also have to subscribe to the external dataflow
    ehfsm.fsm_state$
      .finally(function () {
        console.log('ending test event sequence', arr_fsm_traces)
      })
      .subscribe(function on_next(fsm_state) {
        console.log('fsm_state...', utils.clone_deep(fsm_state));
        arr_fsm_traces.push(utils.clone_deep(fsm_state));
      }, test_on_error, test_on_complete);
    ehfsm.start(); // `start` initiates the inner dataflow subscription
    // NOTE : The init event is sent automatically AND synchronously so we can put the stop trace right after

    // Sequence of testing events
    exec_on_tick(ehfsm.send_event, 10)(DUMMY, DUMMY);
    exec_on_tick(ehfsm.send_event, 30)(events.EVENT1, {});
    exec_on_tick(ehfsm.send_event, 50)(events.EVENT2, {});
    exec_on_tick(ehfsm.send_event, 70)(events.EVENT2, DUMMY_EVENT_DATA_VALUE);
    exec_on_tick(ehfsm.send_event, 90)(events.EVENT2);
    exec_on_tick(ehfsm.send_event, 110)(events.EVENT3);
    exec_on_tick(ehfsm.stop, 130)();

    function test_on_complete() {
      // T1. Initial transition
      // WHEN starting the statechart
      // THEN it should transitions to A
      //
      clean(arr_fsm_traces);

      var expected_init_trace = {
        automatic_event: undefined,
        effect_req: undefined,
        event: {
          "code": EV_CODE_INIT,
          "payload": {}
        },
        inner_fsm: {
          "model": {}
        },
        internal_state: {
          expecting: "intent",
          from: "nok",
          is_model_dirty: true,
          to: "A"
        },
        model_update: {},
        payload: undefined,
        recoverable_error: undefined
      };
      assert.deepEqual(arr_fsm_traces[0], expected_init_trace, 'Starting the state machine sends an INIT event to the top-level state. The defined transition for that event is taken.');
      assert.deepEqual(true, true, 'That INIT event has the initial value of the model as event data');
      assert.deepEqual(true, true, 'falsy initial model are dealt with as empty objects');

      // T2. No transition exists for that event
      // WHEN after starting the statechart, event 'dummy' is sent
      // THEN :
      //   - event is ignored (no effect)
      //   - recoverable error is generated in the outer fsm and visible in traces
      //   - model is updated (only internals!!)
      //   - the inner FSM current state remains the same
      //
      var expected_no_event_handler_trace = {
        automatic_event: undefined,
        effect_req: undefined,
        event: {
          "code": EV_CODE_INIT,
          "payload": {}
        },
        inner_fsm: {
          "model": {}
        },
        internal_state: {
          expecting: "intent",
          from: "A",
          is_model_dirty: true,
          to: "A"
        },
        model_update: {},
        payload: undefined,
        "recoverable_error": {
          "error": "There is no transition associated to that event!",
          "event": "dummy",
          "event_data": "dummy",
          "resulting_state": "A"
        }
      };
      assert.deepEqual(arr_fsm_traces[1], expected_no_event_handler_trace, 'If an event is triggered, and there is no transition defined for that event in the current state of the state machine, the event is ignored, and a recoverable error is reported.');
      assert.deepEqual(true, true, 'The resulting state in case of such recoverable error will be the same as prior the error.');

      // T3. Transition with one guard and no action
      // WHEN after starting the statechart, event `event1` is sent
      // THEN :
      //   - it should transition to B
      //   - model is unchanged
      //
      var expected_transition_to_B_trace = {
        automatic_event: undefined,
        effect_req: undefined,
        event: {
          "code": "EVENT1",
          "payload": {}
        },
        inner_fsm: {
          "model": {}
        },
        internal_state: {
          expecting: "intent",
          from: "A",
          is_model_dirty: true,
          to: "B"
        },
        model_update: {},
        payload: undefined,
        recoverable_error: undefined
      };
      assert.deepEqual(arr_fsm_traces[2], expected_transition_to_B_trace, 'If an event is triggered, and there is a transition defined for that event in the current state of the state machine, that transition is taken. If no action is specified, the model is kept unchanged.');

      // T4. Transition with one guard satisfied and no action
      // WHEN after starting the statechart, event `event2` is sent
      // THEN :
      //   - it should transition to C
      //   - model is unchanged
      //
      var expected_transition_to_C_with_guard_trace = {
        automatic_event: undefined,
        effect_req: undefined,
        event: {
          "code": "EVENT2",
          "payload": {}
        },
        inner_fsm: {
          "model": {}
        },
        internal_state: {
          expecting: "intent",
          from: "B",
          is_model_dirty: true,
          to: "C"
        },
        model_update: {},
        payload: undefined,
        recoverable_error: undefined
      };
      assert.deepEqual(arr_fsm_traces[3], expected_transition_to_C_with_guard_trace, 'When a guard is specified, and satisfied, the corresponding transition is taken');

      // T5. Transition with one guard satisfied, and one action
      // WHEN after starting the statechart, event `event2` is sent with event data 24
      // THEN :
      //   - it should transition to C
      //   - it should modify model according to the action defined (model' = {dummy_field: 24})
      //   - the action should be called with the parameters (inner fsm model : {}, event payload : 24)
      //
      var expected_transition_to_C_with_guard_trace_2 = {
        automatic_event: undefined,
        effect_req: undefined,
        event: {
          "code": "EVENT2",
          "payload": 24
        },
        inner_fsm: {
          model: {
            dummy_field: 24
          },
        },
        internal_state: {
          expecting: "intent",
          from: "C",
          is_model_dirty: true,
          to: "C"
        },
        model_update: {
          dummy_field: 24
        },
        payload: undefined,
        recoverable_error: undefined
      };
      assert.deepEqual(arr_fsm_traces[4], expected_transition_to_C_with_guard_trace_2, 'When a guard is specified, and satisfied, the corresponding action is executed and leads to the corresponding model update');

      // T6. Transition with one guard satisfied, and one action
      // WHEN after starting the statechart, event `event2` is sent with no event data
      // THEN :
      //   - it should transition to D
      //   - it should modify model according to the action defined (model' = {dummy_field: true})
      //   - the action should be called with the parameters (inner fsm model : {dummy_field: 24}, event payload : undefined)
      //
      var expected_transition_to_D_no_guard_trace = {
        automatic_event: undefined,
        effect_req: undefined,
        "event": {
          "code": "EVENT2",
          "payload": undefined
        },
        inner_fsm: {
          "model": {
            "dummy_field": true
          },
        },
        internal_state: {
          expecting: "intent",
          from: "C",
          is_model_dirty: true,
          to: "D"
        },
        "model_update": {
          "dummy_field": true
        },
        payload: undefined,
        recoverable_error: undefined
      };
      assert.deepEqual(arr_fsm_traces[5], expected_transition_to_D_no_guard_trace, 'All specified guards are evaluated till one is satisfied, then the corresponding action is executed and leads to the corresponding model update');

      // T8. Transition for event defined, but no guard satisfied when event occurs
      // WHEN after starting the statechart, event `event3` is sent with no event data
      // THEN :
      //   - it should emit recoverable error
      //   - it should not update the model except meta data
      //   - no actions is executed
      //   - state should remain the same
      var expected_error_one_predicate_must_be_satisfied = {
        automatic_event: undefined,
        effect_req: undefined,
        "event": {
          "code": "EVENT2",
          "payload": undefined
        },
        inner_fsm: {
          "model": {
            "dummy_field": true
          }
        },
        internal_state: {
          expecting: "intent",
          from: "D",
          is_model_dirty: true,
          to: "D"
        },
        model_update: {},
        payload: undefined,
        "recoverable_error": {
          "error": "No transition found while processing the event EVENT3 while transitioning from state D .\n It is possible that no guard predicates were fulfilled.",
          "event": "EVENT3",
          "event_data": undefined,
          "resulting_state": "D"
        }
      };
      assert.deepEqual(arr_fsm_traces[6], expected_error_one_predicate_must_be_satisfied, 'If an event handler is defined for a state, that event occurs, but none of the guards specified is fulfilled, then a recoverable error is generated, model is not updated, and the state remains the same.');

      done();
    }

    // END
  });

  QUnit.skip("make_effect_driver(effect_registry_)(effect_request$)", function (assert) {
    var done = assert.async(2); // Cf. https://api.qunitjs.com/async/
    var effect_response$;
    var arr_traces = [];

    var effect_req$ = new Rx.ReplaySubject(1);
    effect_req$.subscribe(function () {
    }, function (e) {
      console.log('effect_request error', e), function () {
        console.log('replay completed..')
      }
    });

    var effect_registry = {
      factory_test_driver_no_err: {
        factory: function (settings, a) {
          assert.deepEqual(settings, effect_registry.factory_test_driver_no_err.settings.factory_test_driver_name, 'factory function for driver is called with `settings` as first parameter')
          assert.deepEqual(undefined, a, '- That `settings` is also the only parameter passed to the factory function.');
          return function driver_stream_operator_no_err(effect_req$) {
            return effect_req$
              .do(utils.rxlog('effect_request entry in driver'))
              .flatMap(function (effect_req) {
                return Rx.Observable.from([effect_req.params + 24, effect_req.params + 42, effect_req.params + 66]);
              })
          }
        },
        settings: {
          factory_test_driver_name: {key: 'value'}
        }
      },
      factory_test_driver_throw_err: {
        factory: function (settings, a) {
          return function factory_test_driver_throw_err(effect_req$) {
            throw (new Error('factory_test_driver_throw_err rerr!'));
          }
        },
        settings: {
          factory_test_driver_name: {key: 'value'}
        }
      },
      factory_test_driver_returns_err: {
        factory: function (settings, a) {
          return function factory_test_driver_returns_err(effect_req$) {
            return Rx.Observable.throw(new Error('factory_test_driver_returns_err error!'));
          }
        },
        settings: {
          factory_test_driver_name: {key: 'value'}
        }
      },
      factory_test_driver_with_later_err_with_state: {
        factory: function (settings, a) {
          // could be for instance connection to a database or getting an handle on a file
          // but here just a counter
          var stateful_property = 0;
          return function driver_stream_operator_no_err(effect_req$) {
            return effect_req$
              .map(function (effect_req) {
                if (stateful_property > 1) throw 'factory_test_driver_with_later_err_with_state provoked error'
                return effect_req.params + ++stateful_property;
              })
          }
        },
        settings: {
          factory_test_driver_name: {key: 'value'}
        }
      },
      handler_test_driver_no_err: function test_handler_no_err(req_params) {
        assert.deepEqual(req_params, 'test_params',
          'Effects can be managed through regular functions called error handlers. They have the following signature `req_params -> effect_result`. ' +
          'They receive as first parameter the property `params` of the corresponding effect request.');
        return 'test_handler_return_value';
      },
      handler_test_driver_with_err: function test_handler_with_err(req_params) {
        throw 'test_handler_with_err error!'
      },
      handler_test_driver_no_err_returns_observable: function test_handler_no_err_returns_observable(req_params) {
        var observable$ = Rx.Observable.return(req_params).delay(100).concat(Rx.Observable.return(req_params + 10));
        return Rx.Observable.from([observable$, 2000]);
      },
      handler_test_driver_takes_long_time: function handler_test_driver_takes_long_time(req_params) {
        return Rx.Observable.from([req_params]).delay(200);
      },
    };
    effect_response$ = fsm.make_effect_driver(effect_registry)(effect_req$);
    effect_response$.subscribe(
      function record_sequence(x) {
        arr_traces.push(x);
      }, function error(e) {
        console.error('effect_response errror', e);
        throw e;
      },
      test_on_complete);


    // Sequence of testing events
    // Execute requests
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 10)({
      driver: {family: 'factory_test_driver_no_err', name: 'factory_test_driver_name'},
      address: {},
      params: 0,
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 20)({
      driver: {family: 'handler_test_driver_no_err', name: 'handler_test_driver_name'},
      address: {token: 1},
      params: 'test_params',
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 30)({
      driver: {family: 'factory_test_driver_throw_err', name: 'factory_test_driver_name'},
      address: {uri: 'another_test_uri', token: 2},
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 40)({
      driver: {family: 'factory_test_driver_no_err', name: 'factory_test_driver_name'},
      address: {uri: 'test_uri', token: 3},
      params: 10,
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 50)({
      driver: {family: 'factory_test_driver_returns_err', name: 'factory_test_driver_name'},
      address: {uri: 'yet_another_test_uri', token: 4},
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 60)({
      driver: {family: 'factory_test_driver_no_err', name: 'factory_test_driver_name'},
      address: {uri: 'test_uri', token: 5},
      params: 20,
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 70)({
      driver: {family: 'factory_test_driver_with_later_err_with_state', name: 'factory_test_driver_name'},
      address: {uri: 'test_uri', token: 6},
      params: 0,
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 80)({
      driver: {family: 'factory_test_driver_with_later_err_with_state', name: 'factory_test_driver_name'},
      address: {uri: 'test_uri', token: 7},
      params: 10,
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 90)({
      driver: {family: 'factory_test_driver_with_later_err_with_state', name: 'factory_test_driver_name'},
      address: {uri: 'test_uri', token: 8},
      params: 20,
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 100)({
      driver: {family: 'factory_test_driver_with_later_err_with_state', name: 'factory_test_driver_name'},
      address: {uri: 'test_uri', token: 9},
      params: 30,
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 110)({
      driver: {family: 'handler_test_driver_with_err', name: 'handler_test_driver_with_err'},
      address: {uri: 'test_uri', token: 10},
      params: 'does not matter',
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 120)({
      driver: {family: 'handler_test_driver_no_err_returns_observable', name: 'any name is fine'},
      address: {uri: 'test_uri', token: 11},
      params: 100,
      command: EXECUTE
    });

    // Cancel requests
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 130)({
      driver: {family: 'handler_test_driver_takes_long_time', name: 'any name is fine'},
      address: {uri: 'test_uri', token: 12}, // this one we do cancel
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 130)({
      driver: {family: 'handler_test_driver_takes_long_time', name: 'any name is fine'},
      address: {uri: 'test_uri', token: 13}, // this one we do not cancel
      command: EXECUTE
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 150)({
      driver: {family: 'handler_test_driver_takes_long_time', name: 'any name is fine'},
      address: {uri: 'test_uri', token: 1200}, // NOTE : token not emitted, this is cancel for non-existing request
      command: CANCEL
    });
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 140)({
      driver: {family: 'handler_test_driver_takes_long_time', name: 'any name is fine'},
      address: {uri: 'test_uri', token: 12},
      command: CANCEL
    });

    // Gather test results
    exec_on_tick(effect_req$.onCompleted.bind(effect_req$), 400)();

    // Actual testing
    function test_on_complete() {
      console.log('arr_traces', arr_traces);
      // 2. Test creation command
      // 2.a. normal function
      // 2.a.1. successful exec
      assert.deepEqual(arr_traces[1], {
          "effect_request": {
            "address": {"token": 1},
            "command": "command_execute",
            "driver": {"family": "handler_test_driver_no_err", "name": "handler_test_driver_name"},
            "params": "test_params"
          },
          "effect_result": "test_handler_return_value"
        },
        ['For effect handlers\' return value: ',
          'If `effect_result` is a Promise, the resolved value is passed as effect result. ',
          'If `effect_result` is an observable, the first value emitted by this observable is passed as effect_result. ',
          'If any other types, the value returned by the handler is passed as `effect_result` ',
          'It results from this that it is possible to pass an observable as effect result by wrapping it in another observable.'].join('\n')
      );
      // 2.a.1.1 effect handler returning an observable as effect result
      arr_traces[11].effect_result.toArray().subscribe(function (x) {
        assert.deepEqual(x, [100, 110],
          'Effect handlers : To return an observable as an effect result, wrap that observable into another observable. i.e. `return Rx.Observable.return(obs$)`'
        );
        assert.deepEqual(x, [100, 110],
          'Effect handlers : If `effect_result` is an observable, the first value emitted by this observable is passed as effect_result. ');
        done();
      });

      // 2.a.2. error exec
      assert.deepEqual(arr_traces[1], {
          "effect_request": {
            "address": {"token": 1},
            "command": "command_execute",
            "driver": {"family": "handler_test_driver_no_err", "name": "handler_test_driver_name"},
            "params": "test_params"
          },
          "effect_result": "test_handler_return_value"
        },
        ['When an effect handler is interrupted with an error, an `AppError`, with subtype Effect_Error, is returned as the effect result'].join('\n')
      );

      // 2.b. drivers (stream operators)
      // 2.b.1. successful exec
      // 2.b.1.1. one/several requests on same driver
      assert.ok(true, 'When a driver is specified to handle requests and is instantiated, it receives all the requests destined to it (i.e. with matching (family, name))');
      assert.deepEqual(
        {1: arr_traces[0], 2: arr_traces[3], 3: arr_traces[5]},
        {
          "1": {
            "effect_request": {
              "address": {},
              "command": "command_execute",
              "driver": {"family": "factory_test_driver_no_err", "name": "factory_test_driver_name"},
              "params": 0
            },
            "effect_result": 24
          },
          "2": {
            "effect_request": {
              "address": {"token": 3, "uri": "test_uri"},
              "command": "command_execute",
              "driver": {"family": "factory_test_driver_no_err", "name": "factory_test_driver_name"},
              "params": 10
            },
            "effect_result": 42
          },
          "3": {
            "effect_request": {
              "address": {"token": 5, "uri": "test_uri"},
              "command": "command_execute",
              "driver": {"family": "factory_test_driver_no_err", "name": "factory_test_driver_name"},
              "params": 20
            },
            "effect_result": 66
          }
        },
        'There should be only one result value for one request value. If there are more, only the first result will be used.');

      assert.equal(arr_traces[8].effect_result instanceof Error, true,
        'When a driver ends because of error or other standard termination, subsequent requests will recreate the driver'
      );
      assert.deepEqual({1: arr_traces[6].effect_result, 2: arr_traces[7].effect_result, 4: arr_traces[9].effect_result},
        {1: 1, 2: 12, 4: 31}, ''
      );

      // 2.b.2 early normal termination and recreation
      // TODO : add a test for driver ending prematurely but with normal termination not error termination

      // 2.b.2. error exec
      var returned_error = arr_traces[8].effect_result;
      assert.deepEqual(returned_error instanceof Err.AppError && returned_error.name === 'Effect_Error',
        true,
        'When a driver is interrupted with an error, that driver is terminated and an `AppError`, with subtype Effect_Error, is returned as the effect result');

      // 3. Test cancellation command
      // 3a. canceling request made
      // 3b. canceling request not made
      // 3c. emitting same request but with different token
      assert.deepEqual(arr_traces.length, 13,
        'Requests marked as cancelled are cancelled, according to the `address` property of the effect request. Non-cancelled requests are not cancelled.'
      );

      done();
    }
  });

  QUnit.test("Basic transition mechanism - Effectful actions - 1 or several effects", function test_effectful_actions(assert) {
    var test_sequence_handlers = get_test_sequence_handlers(assert);
    var effect_array_storage_1 = test_sequence_handlers.effect_array_storage_1;
    var effect_array_storage_2 = test_sequence_handlers.effect_array_storage_2;
    var effect_hash_storage_1 = test_sequence_handlers.effect_hash_storage_1;
    var effect_hash_storage_2 = test_sequence_handlers.effect_hash_storage_2;

    var transitions = [
      {from: states.NOK, to: states.A, event: events[EV_CODE_INIT]},
      {from: states.A, to: states.B, event: events.EVENT1, action: [effect_array_storage_1, effect_array_storage_2]},
      {
        from: states.B,
        to: states.A,
        event: events.EVENT2,
        action: [effect_hash_storage_1, effect_hash_storage_2, effect_array_storage_1]
      },
      {from: states.B, to: states.B, event: events.EVENT3, action: [effect_hash_storage_1, effect_hash_storage_2]},
    ];

    var state_chart = {
      model: model0,
      state_hierarchy: states,
      events: events,
      effect_registry: effect_registry,
      transitions: transitions
    };

    var done = assert.async(1); // Cf. https://api.qunitjs.com/async/

    // T1-3
    function test_on_complete(arr_fsm_traces) {
      return function test_on_complete() {
        // T1. Effectful actions/action sequences - Action with one effect
        // WHEN starting the statechart, and sending EVENT1
        // THEN
        // - on start, it should transition to A
        // - on EVENT1, it should transition to B
        // - the right effect handlers are called in right order with the right parameters
        // - model and model update fields are updated correctly
        // - no (recoverable or fatal) errors are generated
        // - no automatic events are generated

        clean(arr_fsm_traces);

        var expected_init_trace = [
          {
            "noop": false,
            "automatic_event": undefined,
            "effect_execution_state": undefined,
            "recoverable_error": undefined,
            "inner_fsm": {"model": {"key1": "value"}, "model_update": {}},
            "internal_state": {"expecting": "intent", "from": "nok", "to": "A"},
            "event": {"code": "init", "payload": {"key1": "value"}, "__type": ["intent"]}
          }, {
            "noop": false,
            "automatic_event": undefined,
            "recoverable_error": undefined,
            "inner_fsm": {
              "model": {"key1": "value", "trace": {"event_data": "value"}},
              "model_update": {"trace": {"event_data": "value"}}
            },
            "internal_state": {"expecting": "expecting_action_result", "from": "A", "to": "-B-"},
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "index": 0,
              "effect_request": {
                "driver": {"family": "array_storage", "name": "size_5"},
                "params": "element 1",
                "command": "command_execute",
              },
              "has_more_effects_to_execute": true
            },
            "event": {"code": "EVENT1", "payload": {"event_data": "value"}, "__type": ["intent"]}
          }, {
            "noop": false,
            "automatic_event": undefined,
            "recoverable_error": undefined,
            "inner_fsm": {
              "model": {
                "key1": "value",
                "trace": [{"event_data": "value"}, {"event_data": "value"}, ["element 1", undefined, undefined, undefined, undefined]]
              },
              "model_update": {"trace": [{"event_data": "value"}, {"event_data": "value"}, ["element 1", undefined, undefined, undefined, undefined]]}
            },
            "internal_state": {"expecting": "expecting_action_result", "from": "A", "to": "-B-"},
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "index": 1,
              "effect_request": {"command": "command_ignore", "driver": {}},
              "has_more_effects_to_execute": false
            },
            "event": {"code": "EVENT1", "payload": {"event_data": "value"}, "__type": ["intent"]}
          }, {
            "noop": false,
            "automatic_event": undefined,
            "recoverable_error": undefined,
            "effect_execution_state": undefined,
            "inner_fsm": {
              "model": {
                "key1": "value",
                "trace": [{"event_data": "value"}, {"event_data": "value"}, ["element 1", undefined, undefined, undefined, undefined]]
              },
              "model_update": undefined
            },
            "internal_state": {"expecting": "intent", from: "A", "to": "B"},
            "event": {"code": "EVENT1", "payload": {"event_data": "value"}, "__type": ["intent"]}
          }];
        var expected_2_effects_success_trace = [
          {
            "noop": false,
            "automatic_event": undefined,
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "effect_request": {
                "command": "command_execute", "driver": {"family": "hash_storage"},
                "params": {"key": "element 1", "value": "value1"}
              },
              "has_more_effects_to_execute": true,
              "index": 0
            },
            "event": {
              "__type": ["intent"],
              "code": "EVENT3",
              "payload": {}
            },
            "inner_fsm": {
              "model": {
                "args_first_call_except_model": [{}, undefined],
                "args_second_call_except_model": undefined,
                "hash_storage": {},
                "key1": undefined,
                "trace": undefined
              },
              "model_update": {
                "args_first_call_except_model": [{}, undefined],
                "args_second_call_except_model": undefined,
                "hash_storage": {},
                "key1": undefined, "trace": undefined
              }
            },
            "internal_state": {
              "expecting": "expecting_action_result",
              "from": "B",
              "to": "-B-"
            },
            "recoverable_error": undefined
          },
          {
            "noop": false,
            "automatic_event": undefined,
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "effect_request": {"command": "command_ignore", "driver": {}},
              "has_more_effects_to_execute": false,
              "index": 1
            },
            "event": {
              "__type": ["intent"],
              "code": "EVENT3",
              "payload": {}
            },
            "inner_fsm": {
              "model": {
                "args_first_call_except_model": [{}, undefined],
                "args_second_call_except_model": [{}, {"element 1": "value1"}],
                "hash_storage": {"element 1": "value1"},
                "key1": undefined,
                "trace": undefined
              },
              "model_update": {
                "args_second_call_except_model": [{}, {"element 1": "value1"}],
                "hash_storage": {"element 1": "value1"}
              }
            },
            "internal_state": {
              "expecting": "expecting_action_result",
              "from": "B",
              "to": "-B-"
            },
            "recoverable_error": undefined
          },
          {
            "noop": false,
            "automatic_event": undefined,
            "effect_execution_state": undefined,
            "event": {
              "__type": ["intent"],
              "code": "EVENT3",
              "payload": {}
            },
            "inner_fsm": {
              "model": {
                "args_first_call_except_model": [{}, undefined],
                "args_second_call_except_model": [{}, {"element 1": "value1"}],
                "hash_storage": {"element 1": "value1"},
                "key1": undefined,
                "trace": undefined
              },
              "model_update": undefined
            },
            "internal_state": {
              "expecting": "intent",
              "from": "B",
              "to": "B"
            },
            "recoverable_error": undefined
          }
        ];
        var expected_error_trace = [
          {
            "noop": false,
            "automatic_event": undefined,
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "effect_request": {
                "command": "command_execute",
                "driver": {"family": "hash_storage"},
                "params": {"key": "element 1", "value": "value1"}
              },
              "has_more_effects_to_execute": true,
              "index": 0
            },
            "event": {
              "__type": ["intent"],
              "code": "EVENT2",
              "payload": {"event_data": "value"}
            },
            "inner_fsm": {
              "model": {
                "args_first_call_except_model": [{"event_data": "value"}, undefined],
                "args_second_call_except_model": undefined,
                "hash_storage": {"element 1": "value1"},
                "key1": undefined,
                "trace": undefined
              },
              "model_update": {
                "args_first_call_except_model": [{"event_data": "value"}, undefined],
                "args_second_call_except_model": undefined,
                "hash_storage": {"element 1": "value1"},
                "key1": undefined,
                "trace": undefined
              }
            },
            "internal_state": {
              "expecting": "expecting_action_result",
              "from": "B",
              "to": "-A-"
            },
            "recoverable_error": undefined
          },
          {
            "noop": true,
            "automatic_event": undefined,
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "effect_request": {
                "address": {"token": 0, "uri": "fsm_uri"},
                "command": "command_execute",
                "driver": {"family": "hash_storage"},
                "params": {"key": "element 1", "value": "value1"}
              },
              "has_more_effects_to_execute": true,
              "index": 0
            },
            "event": {
              "__type": ["intent"],
              "code": "EVENT2",
              "payload": {"event_data": "value"}
            },
            "fatal_error": {
              "extended_info": {
                "effect_number": 2,
                "executed_action": "update_model_and_send_effect_request",
                "index": 1
              },
              "message": "Unexpected end of effect requests, expected 2, encountered end of effects at index 1",
              "name": "Effect_Error"
            },
            "inner_fsm": {
              "model": {
                "args_first_call_except_model": [{"event_data": "value"}, undefined],
                "args_second_call_except_model": undefined,
                "hash_storage": {"element 1": "value1"},
                "key1": undefined,
                "trace": undefined
              },
              "model_update": {
                "args_first_call_except_model": [{"event_data": "value"}, undefined],
                "args_second_call_except_model": undefined,
                "hash_storage": {"element 1": "value1"},
                "key1": undefined,
                "trace": undefined
              }
            },
            "internal_state": {
              "expecting": "expecting_action_result",
              "from": "B",
              "to": "-A-"
            },
            "recoverable_error": undefined
          }
        ];
        var arr_fsm_traces_1 = arr_fsm_traces.slice(0, 4);
        var arr_fsm_traces_2 = arr_fsm_traces.slice(4, 7);
        var arr_fsm_traces_3 = arr_fsm_traces.slice(7, 9);

        assert.deepEqual(arr_fsm_traces_1, expected_init_trace, 'Effectful actions : The state machine and model is updated as the result of both effect results and pure updates set in the effect handler logic.');
        // T2. Effectful actions/action sequences - Action with two effects
        assert.deepEqual(arr_fsm_traces_2, expected_2_effects_success_trace, [
          'Effectful actions :',
          'There must be a number of effects in relation with the length of the array passed to specify a sequence of effects.',
          'Effects are executed as long as there is non-empty effect request returned by the effect sequence handler.'].join(' \n'));

        // T3. Effectful actions/action sequences - Action with two effects - but on effect handler does not return an effect request
        assert.deepEqual(arr_fsm_traces_3, expected_error_trace, [
          'Effectful actions :',
          'There must be a number of effects in relation with the length of the array passed to specify a sequence of effects.',
          'If there are less or more effects than expected, a fatal error is issued which contains the current (hence not updated) state of the state machine'].join(' \n'));

        done();
      }
    }

    var ehfsm = start_ehfsm_test('fsm_uri', state_chart, test_on_error, test_on_complete);
    send_synchronized_sequence_and_stop(ehfsm, [
      make_intent(events.EVENT1, event_data1),
      make_intent(events.EVENT3, {}),
      make_intent(events.EVENT2, event_data1)
    ]);
  });

  QUnit.test("Basic transition mechanism - Effectful actions - unexpected effect result", function test_effectful_actions(assert) {
    var test_sequence_handlers = get_test_sequence_handlers(assert);
    var effect_array_storage_1 = test_sequence_handlers.effect_array_storage_1;
    var effect_array_storage_2 = test_sequence_handlers.effect_array_storage_2;
    var effect_hash_storage_1 = test_sequence_handlers.effect_hash_storage_1;
    var effect_hash_storage_2 = test_sequence_handlers.effect_hash_storage_2;

    var transitions = [
      {from: states.NOK, to: states.A, event: events[EV_CODE_INIT]},
      {from: states.A, to: states.B, event: events.EVENT1, action: [effect_array_storage_1, effect_array_storage_2]},
      {
        from: states.B,
        to: states.A,
        event: events.EVENT2,
        action: [effect_hash_storage_1, effect_hash_storage_2, effect_array_storage_1]
      },
      {from: states.B, to: states.B, event: events.EVENT3, action: [effect_hash_storage_1, effect_hash_storage_2]},
    ];

    var state_chart = {
      model: model0,
      state_hierarchy: states,
      events: events,
      effect_registry: effect_registry,
      transitions: transitions
    };

    var done = assert.async(1); // Cf. https://api.qunitjs.com/async/

    // T4. Receiving unexpected effect result
    /** @type Effect_Response*/
    var fake_effect_response_token = {
      effect_result: {},
      effect_request: {
        command: EXECUTE,
        driver: {
          family: 'array_storage',
          name: 'size_5'
        },
        params: 'element 1',
        address: {
          uri: 'fsm_uri2', // same fsm id, so the request must be rejected based on the token
          token: 2000 // non-emitted token
        }
      }
    };
    var fake_effect_response_uri = {
      effect_result: {},
      effect_request: {
        command: EXECUTE,
        driver: {
          family: 'array_storage',
          name: 'size_5'
        },
        params: 'element 1',
        address: {
          uri: 'fsm', // wrong fsm uri, so the request must be rejected based on uri
          token: 0 // emitted token
        }
      }
    };

    var ehfsm = start_ehfsm_test('fsm_uri2', state_chart, test_on_error, test_on_complete);

    send_timed_sequence_and_stop(ehfsm, [
      [10, make_intent(events.EVENT1, event_data1)],
      [10, make_effect_response(fake_effect_response_uri)],
      [11, make_effect_response(fake_effect_response_token)],
    ]);

    function test_on_complete(arr_fsm_traces) {
      return function test_on_complete() {
        clean(arr_fsm_traces);
        var expected_trace = [
          {
            "automatic_event": undefined,
            "recoverable_error": undefined,
            "effect_execution_state": undefined,
            "inner_fsm": {"model": {"key1": "value"}, "model_update": {}},
            "internal_state": {"expecting": "intent", "from": "nok", "to": "A"},
            "event": {"code": "init", "payload": {"key1": "value"}, "__type": ["intent"]},
            "noop": false
          }, {
            "automatic_event": undefined,
            "recoverable_error": undefined,
            "inner_fsm": {
              "model": {"key1": "value", "trace": {"event_data": "value"}},
              "model_update": {"trace": {"event_data": "value"}}
            },
            "internal_state": {"expecting": "expecting_action_result", "from": "A", "to": "-B-"},
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "index": 0,
              "effect_request": {
                "driver": {"family": "array_storage", "name": "size_5"},
                "params": "element 1",
                "command": "command_execute"
              },
              "has_more_effects_to_execute": true
            },
            "event": {"code": "EVENT1", "payload": {"event_data": "value"}, "__type": ["intent"]},
            "noop": false
          }, {
            "automatic_event": undefined,
            "inner_fsm": {
              "model": {"key1": "value", "trace": {"event_data": "value"}},
              "model_update": {"trace": {"event_data": "value"}}
            },
            "internal_state": {"expecting": "expecting_action_result", "from": "A", "to": "-B-"},
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "index": 0,
              "effect_request": {
                "driver": {"family": "array_storage", "name": "size_5"},
                "params": "element 1",
                "command": "command_execute",
                "address": {"uri": "fsm_uri", "token": 0}
              },
              "has_more_effects_to_execute": true
            },
            "recoverable_error": {
              "name": "SM_Error",
              "message": "warning_received_unexpected_effect_result",
              "extended_info": {
                "effect_result": {
                  "effect_result": {},
                  "effect_request": {
                    "command": "command_execute",
                    "driver": {"family": "array_storage", "name": "size_5"},
                    "params": "element 1",
                    "address": {"uri": "fsm", "token": 0}
                  },
                  "__type": ["effect_response"]
                }
              }
            },
            "event": {"code": "EVENT1", "payload": {"event_data": "value"}, "__type": ["intent"]},
            "noop": true
          }, {
            "automatic_event": undefined,
            "inner_fsm": {
              "model": {"key1": "value", "trace": {"event_data": "value"}},
              "model_update": {"trace": {"event_data": "value"}}
            },
            "internal_state": {"expecting": "expecting_action_result", "from": "A", "to": "-B-"},
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "index": 0,
              "effect_request": {
                "driver": {"family": "array_storage", "name": "size_5"},
                "params": "element 1",
                "command": "command_execute",
                "address": {"uri": "fsm_uri", "token": 0}
              },
              "has_more_effects_to_execute": true
            },
            "recoverable_error": {
              "name": "SM_Error",
              "message": "warning_received_unexpected_effect_result",
              "extended_info": {
                "effect_result": {
                  "effect_result": {},
                  "effect_request": {
                    "command": "command_execute",
                    "driver": {"family": "array_storage", "name": "size_5"},
                    "params": "element 1",
                    "address": {"uri": "fsm_uri2", "token": 2000}
                  },
                  "__type": ["effect_response"]
                }
              }
            },
            "event": {"code": "EVENT1", "payload": {"event_data": "value"}, "__type": ["intent"]},
            "noop": true
          }, {
            "automatic_event": undefined,
            "recoverable_error": undefined,
            "inner_fsm": {
              "model": {
                "key1": "value",
                "trace": [{"event_data": "value"}, {"event_data": "value"}, ["element 1", undefined, undefined, undefined, undefined]]
              },
              "model_update": {"trace": [{"event_data": "value"}, {"event_data": "value"}, ["element 1", undefined, undefined, undefined, undefined]]}
            },
            "internal_state": {"expecting": "expecting_action_result", "from": "A", "to": "-B-"},
            "effect_execution_state": {
              "action_seq_handler": "action_sequence_handler_from_effectful_action_array",
              "index": 1,
              "effect_request": {"command": "command_ignore", "driver": {}},
              "has_more_effects_to_execute": false
            },
            "event": {"code": "EVENT1", "payload": {"event_data": "value"}, "__type": ["intent"]},
            "noop": false
          }, {
            "automatic_event": undefined,
            "recoverable_error": undefined,
            "effect_execution_state": undefined,
            "inner_fsm": {
              "model": {
                "key1": "value",
                "trace": [{"event_data": "value"}, {"event_data": "value"}, ["element 1", undefined, undefined, undefined, undefined]]
              },
              "model_update": undefined
            },
            "internal_state": {"expecting": "intent", "from": "A", "to": "B"},
            "event": {"code": "EVENT1", "payload": {"event_data": "value"}, "__type": ["intent"]},
            "noop": false
          }
        ];
        assert.deepEqual(arr_fsm_traces, expected_trace, 'If an effect result is received by the state machine while it is expecting an effect result, and the generating effect request does not correspond to the expected one, a recoverable error is generated. The model is not updated, and the state machine remains in the same state.');
        done();
      };
    }
  });

  QUnit.test("Basic transition mechanism - Effectful actions - effect result while expecting intent", function test_effectful_actions(assert) {
    var test_sequence_handlers = get_test_sequence_handlers(assert);
    var effect_array_storage_1 = test_sequence_handlers.effect_array_storage_1;
    var effect_array_storage_2 = test_sequence_handlers.effect_array_storage_2;
    var effect_hash_storage_1 = test_sequence_handlers.effect_hash_storage_1;
    var effect_hash_storage_2 = test_sequence_handlers.effect_hash_storage_2;

    var transitions = [
      {from: states.NOK, to: states.A, event: events[EV_CODE_INIT]},
      {from: states.A, to: states.B, event: events.EVENT1, action: [effect_array_storage_1, effect_array_storage_2]},
      {
        from: states.B,
        to: states.A,
        event: events.EVENT2,
        action: [effect_hash_storage_1, effect_hash_storage_2, effect_array_storage_1]
      },
      {from: states.B, to: states.B, event: events.EVENT3, action: [effect_hash_storage_1, effect_hash_storage_2]},
    ];

    var state_chart = {
      model: model0,
      state_hierarchy: states,
      events: events,
      effect_registry: effect_registry,
      transitions: transitions
    };

    var done = assert.async(1); // Cf. https://api.qunitjs.com/async/

    // T5. Receiving effect result while expecting intent
    /** @type Effect_Response*/
    var fake_effect_response_token = {
      effect_result: {},
      effect_request: {
        command: EXECUTE,
        driver: {
          family: 'array_storage',
          name: 'size_5'
        },
        params: 'element 1',
        address: {
          uri: 'fsm_uri2', // same fsm id, so the request must be rejected based on the token
          token: 2000 // non-emitted token
        }
      }
    };
    var fake_effect_response_uri = {
      effect_result: {},
      effect_request: {
        command: EXECUTE,
        driver: {
          family: 'array_storage',
          name: 'size_5'
        },
        params: 'element 1',
        address: {
          uri: 'fsm', // wrong fsm uri, so the request must be rejected based on uri
          token: 0 // emitted token
        }
      }
    };

    var ehfsm = start_ehfsm_test('fsm_uri2', state_chart, test_on_error, test_on_complete);

    send_timed_sequence_and_stop(ehfsm, [
      [9, make_effect_response(fake_effect_response_token)],
    ]);

    function test_on_complete(arr_fsm_traces) {
      return function test_on_complete() {
        clean(arr_fsm_traces);
        var expected_trace = [
          {
            "automatic_event": undefined,
            "effect_execution_state": undefined,
            "recoverable_error": undefined,
            "noop": false,
            "inner_fsm": {"model": {"key1": "value"}, "model_update": {}},
            "internal_state": {"expecting": "intent", "from": "nok", "to": "A"},
            "event": {"code": "init", "payload": {"key1": "value"}, "__type": ["intent"]}
          }, {
            "automatic_event": undefined,
            "effect_execution_state": undefined,
            "noop": true,
            "inner_fsm": {"model": {"key1": "value"}, "model_update": {}},
            "internal_state": {"expecting": "intent", "from": "nok", "to": "A"},
            "recoverable_error": {
              "name": "SM_Error",
              "message": "received effect result while waiting for intent",
              "extended_info": {
                "effect_result": {
                  "effect_result": {},
                  "effect_request": {
                    "command": "command_execute",
                    "driver": {"family": "array_storage", "name": "size_5"},
                    "params": "element 1",
                    "address": {"uri": "fsm_uri2", "token": 2000}
                  },
                  "__type": ["effect_response"]
                }
              }
            },
            "event": {"code": "init", "payload": {"key1": "value"}, "__type": ["intent"]}
          }
        ];
        assert.deepEqual(arr_fsm_traces, expected_trace, 'If the state machine receives an effect result while it was expecting an intent, a recoverable error is generated, and the machine remains in the same state, with no update on the model.');
        done();
      };
    }

  });

  // T5. Effect error - error handler (effect throws)
  // T6. Effect error - no error handler (effect throws)

  // TODO
  // 1. Effectful actions/action sequences                              //
  // 1.a. Action with one effect                                        //
  // 1.a.1 model is updated twice correctly                             //
  // 1.a.2 inner and outer state are changed accordingly                //
  // 1.a.3 effect is executed                                           //
  // 1.a.3.1 action is executed with the right arguments                //
  // 1.a.3.2 the right effect is executed                               //
  // 1.b. Action with two effects
  // 1.c. Receiving an effect result which is not expected
  // 1.d. Effect error
  // 1.d.1 Effect error - no error handler
  // 1.d.2 Effect error - error handler
  // TODO : check statechart format
  // TODO : regression testing - remove skip from other tests - remove traces altogether??
  // TODO : write an adapter for model_update -> ractive, because ractive.set expect a path - TEST traversal library
  // TODO : test the update (model merge) functionality with arrays and objects (array-array are merged, but object-array is assigned)


  // SUBGROUP : ...
  // T1. ...
  // GIVEN ...
  // WHEN ...
  // THEN ...

});

////////
// GIVEN a chart spec :
// no state hierarchy
// model0 :: {test_field : 24}
// state definition :: {A: '', B: ''}
// event enumeration :: ['event1']
// action list :: [set_dummy to true]
// transition definition ::
// - NOK : INIT -> A
// - A : event1 -> A : [set_dummy to true, effect EFF MAJ w/ payload {pay:'load'}]
// WHEN event1
// THEN
// - fatal error : EFF MAJ must be followed by another entry (update, EFF.NONE)
// - fsm_state is correct (fatal error)
//   i.e. model -> {test_field : 24}
//        model_update -> {}

////////
// GIVEN a chart spec :
// no state hierarchy
// model0 :: {test_field : 24}
// state definition :: {A: '', B: ''}
// event enumeration :: ['event1']
// action list :: [set_dummy to true, set_test]
// transition definition ::
// - NOK : INIT -> A
// - A : event1 -> A : [set_dummy to true, effect EFF MAJ w/ payload {pay:'load'}, set_test : 42, EFF.NONE]
// WHEN event1
// THEN
// - fatal error : EFF MAJ must be followed by another entry (update, EFF.NONE)
// - fsm_state is correct (model and model_update are in it already)
//   i.e. 1. model -> {test_field : 24}
//           model_update -> undefined
//   i.e. 2. model -> {test_field : 24, dummy : true}
//           model_update -> {dummy : true}
//           misc. internal state and other fields
//   i.e. 2. model -> {test_field : 42, dummy : true}
//           model_update -> {test_field : 42}
//           misc. internal state and other fields
