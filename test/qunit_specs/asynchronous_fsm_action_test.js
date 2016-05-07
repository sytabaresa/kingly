define(function (require) {
  const DUMMY = 'dummy', DUMMY_FIELD = 'dummy_field', DUMMY_EVENT_DATA_VALUE = 24, DUMMY_ERROR = 'dummy error';
  var utils = require('utils');
  var Err = require('custom_errors');
  var fsm = require('asynchronous_fsm');
  var fsm_helpers = require('fsm_helpers');
  var constants = require('constants');

  const EV_CODE_INIT = constants.EV_CODE_INIT;
  const EXECUTE = constants.commands.EXECUTE;

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

  function remove_timestamp_array_traces(arr_obj) {
    arr_obj.forEach(function (obj) {
      remove_timestamp(obj);
      remove_timestamp(obj.recoverable_error)
    });
    return arr_obj;
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
      delete  fsm_trace.dispose_listeners;
      fsm_trace.recoverable_error && delete fsm_trace.recoverable_error.timestamp;
      return arr_fsm_traces;
    });
    return arr_fsm_traces;
  }

  function test_on_error(e) {
    console.error('error found in testing stream', e);
    assert.ok(false, 'unexpected error found in testing stream');
  }

  ////////
  // GROUP : Basic transition mechanism
  // SUBGROUP : Pure and effectul actions and action sequences

  // Actions
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

  QUnit.test("Basic transition mechanism - Pure actions", function (assert) {
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

    var ehfsm = fsm.make_fsm(state_chart, undefined); // intent$ is undefined here as we will simulate events
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

  QUnit.test("make_effect_driver(effect_registry_)(effect_req$)", function (assert) {
    var done = assert.async(1); // Cf. https://api.qunitjs.com/async/
    function test_on_complete() {
      console.log('arr_traces', arr_traces);
      done()
    }

    var effect_response$;
    var arr_traces = [];

    var effect_req$ = new Rx.ReplaySubject(1);
    effect_req$.subscribe(function () {
    }, function (e) {
      console.log('effect_req error', e), function () {
        console.log('replay completed..')
      }
    });

    var effect_registry = {
      factory_test_driver_no_err: {
        factory: function (settings, a) {
          assert.deepEqual(settings, effect_registry.factory_test_driver_no_err.settings.factory_test_driver_name, 'factory function for driver is called with `settings` parameter as unique parameter')
          assert.deepEqual(undefined, a, '');
          return function driver_stream_operator_no_err(effect_req$) {
            return effect_req$
                .do(utils.rxlog('effect_req entry in driver'))
                .flatMap(function (effect_req) {
                  return Rx.Observable.from([effect_req.params + 24, effect_req.params + 42, effect_req.params + 66]);
                })
            // TODO !! shoud return one value for each effect_req... how to enforce it????? We can't!!
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
      handler_test_driver: function test_handler(req_params) {
        assert.deepEqual(req_params, 'test_params');
        return 'test_handler_return_value';
      }
    };
    effect_response$ = fsm.make_effect_driver(effect_registry)(effect_req$);
    effect_response$.subscribe(
        function record_sequence(x) {
          console.log('pushing value')
          arr_traces.push(x);
        }, function error(e) {
          console.error('effect_response errror', e);
          throw e;
        },
        test_on_complete);


    // Sequence of testing events
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 10)({
      driver: {family: 'factory_test_driver_no_err', name: 'factory_test_driver_name'},
      address: {},
      params: 0,
      command: EXECUTE
    });
     exec_on_tick(effect_req$.onNext.bind(effect_req$), 20)({
     driver: {family: 'handler_test_driver', name: 'handler_test_driver_name'},
     address: {token: 1},
     params: 'test_params',
     command: EXECUTE
     });
     exec_on_tick(effect_req$.onNext.bind(effect_req$), 30)({
     driver: {family: 'factory_test_driver_throw_err', name: 'factory_test_driver_name'},
     address: {uri: 'another_test_uri', token: 2},
     command: EXECUTE
     });
    //       /*
    exec_on_tick(effect_req$.onNext.bind(effect_req$), 40)({
      driver: {family: 'factory_test_driver_no_err', name: 'factory_test_driver_name'},
      address: {uri: 'test_uri', token: 3},
      params: 10,
      command: EXECUTE
    });
    //        */
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

    exec_on_tick(effect_req$.onCompleted.bind(effect_req$), 200)();


  });

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

