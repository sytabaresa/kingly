define(function (require) {
  const DUMMY = 'dummy', DUMMY_FIELD = 'dummy_field', DUMMY_EVENT_DATA_VALUE = 24, DUMMY_ERROR = 'dummy error';
  var utils = require('utils');
  var Err = require('custom_errors');
  var fsm = require('asynchronous_fsm');
  var fsm_helpers = require('fsm_helpers');
  var constants = require('constants');

  var EV_CODE_INIT = constants.EV_CODE_INIT;

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

  ////////
  // GROUP : Basic transition mechanism
  // SUBGROUP : Pure and effectul actions and action sequences

  // Actions
  function set_dummy_field(assert, done) {
    return function set_dummy_field(model, event_payload) {
      assert.deepEqual({model: model, ep: event_payload},
          {model: {}, ep: DUMMY_EVENT_DATA_VALUE},
          'Actions are executed with the parameters (model, event_data) in that order');
      done();
      var model_update = {};
      model_update [DUMMY_FIELD] = event_payload;
      return model_update;
    }
  }

  function set_dummy_field_to_false(model, event_payload) {
    var model_update = {};
    model_update [DUMMY_FIELD] = false;
    return model_update;
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

  QUnit.test("Action mechanism - Pure action", function (assert) {
    ////////
    // GIVEN a chart spec :
    // no state hierarchy
    // model0 :: {test_field : 24}
    // state definition :: {A: '', B: ''}
    // event enumeration :: ['event1', 'event2']
    // action list :: []
    // transition definition ::
    // - NOK : INIT -> A
    // - A : event1 -> B : pure action set_dummy_field to true, test_field : 42)
    // - B : event2 / true -> C
    // - C : event2 / ?dummy_field -> D : set field 'dummy_field' to true
    // - C : event2 / !dummy_field -> C : set field 'dummy_field' to event data

    var done = assert.async(); // Cf. https://api.qunitjs.com/async/

    var model0 = undefined;
    var states_definition = {A: '', B: '', C: '', D: '', E: ''};
    var states = fsm_helpers.create_state_enum(states_definition);
    var event_enum = ['event1', 'event2', 'event3'];
    var events = fsm_helpers.create_event_enum(event_enum);
    var action_list = [set_dummy_field(assert, done), set_dummy_field_to_false, set_dummy_field_to_true];
    var action_struct = fsm_helpers.make_action_DSL(action_list);
    var action_enum = action_struct.action_enum;
    var action_hash = action_struct.action_hash;
    var spy_actions = sinon.spy(action_hash, 'set_dummy_field');
    var transitions = [
      {from: states.NOK, to: states.A, event: events[EV_CODE_INIT]},
      {from: states.A, to: states.B, event: events.EVENT1},
      {from: states.B, to: states.C, event: events.EVENT2, predicate: utils.always(true)},
      {
        from: states.C, event: events.EVENT2, guards: [
        {predicate: has_dummy_field, to: states.D, action: action_enum.set_dummy_field_to_true},
        {predicate: has_not_dummy_field, to: states.C, action: action_enum.set_dummy_field}
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
      action_hash: action_hash,
      transitions: transitions
    };
    var arr_fsm_traces = [];

    var ehfsm = fsm.make_fsm(state_chart, undefined); // intent$ is undefined here as we will simulate events
    ehfsm.model_update$.subscribe(function (model_update) {
      console.log('model update', model_update);
    }); // We also have to subscribe to the external dataflow
    ehfsm.fsm_state$
        .finally(function(){console.log('ending test event sequence')})
        .subscribe(function on_next(fsm_state) {
      console.log('fsm_state', utils.clone_deep(fsm_state));
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
    ehfsm.stop();

    function test_on_error(e) {
      console.error('error found in testing stream', e);
      assert.ok(false, 'unexpected error found in testing stream');
    }

    function test_on_complete() {
      // T1. Initial transition
      // WHEN starting the statechart
      // THEN it should transitions to A
      //
      var expected_init_trace = {
        "event": {
          "code": EV_CODE_INIT,
          "payload": {}
        },
        "model": {},
        "model_update": {},
        "resulting_state": "A"
      };
      assert.deepEqual(arr_traces[0], expected_init_trace, 'Starting the state machine sends an INIT event to the top-level state. The defined transition for that event is taken.');

      assert.deepEqual(arr_traces[1], expected_no_event_handler_trace, 'If an event is triggered, and there is no transition defined for that event in the current state of the state machine, the event is ignored, and a recoverable error is reported.');

      done();
    }

    // END
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
// action list :: []
// transition definition ::
// - NOK : INIT -> A
// - A : event1 -> B : pure action set_dummy_field to true, test_field : 42)
// WHEN event1
// THEN
// - fsm_state is correct (model and model_update are in it already)
//   i.e. model -> {dummy : true, test_field : 42}
//        model_update -> {dummy : true, test_field : 42}

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

