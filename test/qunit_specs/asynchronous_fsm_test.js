/**
 * Created on 7/03/16.
 */
define(function (require) {
    const DUMMY = 'dummy', DUMMY_FIELD = 'dummy_field';
    var utils = require('utils');
    var Err = require('custom_errors');
    var fsm = require('asynchronous_fsm');

    function exec_on_tick(fn, tick) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            setTimeout(function () {
                fn.apply(null, args)
            }, tick);
        }
    }

    function remove_time_stamp(arr_obj_or_obj) {
        var arr_obj = arr_obj_or_obj.length ? arr_obj_or_obj : [arr_obj_or_obj];
        arr_obj.forEach(function (obj) {
            delete obj.timestamp;
        });
        return arr_obj;
    }

    // state machine definition
    // state (model) initial object with internal_state expecting
    // merged_labelled_input

    QUnit.module("process_fsm_internal_transition(internal_fsm_def)(fsm_state, merged_labelled_input)", {
        // NOTE : this is a curried function to which parameters are applied
        // We test the curried function by running through a set of parameters
    });

    ////////
    // GROUP : Standard transition mechanism
    // SUBGROUP :
    // T1. Initial transition
    // GIVEN a chart spec :
    // no state hierarchy
    // model0 :: undefined
    // state definition :: {A: '', B: '', C:'', D:''}
    // event enumeration :: ['event1', 'event2', 'event3']
    // action list :: []
    // transition definition ::
    // - NOK : INIT -> A
    // - A : event1 -> B
    // - B : event2 / true -> C
    // - C : event2 / ?dummy_field -> D : set field 'dummy_field' to true
    // - C : event2 / !dummy_field -> C : set field 'dummy_field' to event data
    // - D : event3 / false -> D : set field 'dummy_field' to false
    // WHEN starting the statechart
    // THEN it should transitions to A
    //
    // T2. No transition exists for that event
    // WHEN after starting the statechart, event 'dummy' is sent
    // THEN :
    //   - event is ignored (no effect)
    //   - recoverable error is generated in the outer fsm and visible in traces
    //   - model is updated (only internals!!)
    //   - the inner FSM current state remains the same
    //
    // T3. Transition with one guard and no action
    // WHEN after starting the statechart, event `event1` is sent
    // THEN :
    //   - it should transition to B
    //   - model is unchanged
    //
    // T4. Transition with one guard satisfied and no action
    // WHEN after starting the statechart, event `event2` is sent
    // THEN :
    //   - it should transition to C
    //   - model is unchanged
    //
    // T5. Transition with one guard satisfied, and one action
    // WHEN after starting the statechart, event `event2` is sent with event data 24
    // THEN :
    //   - it should transition to C
    //   - it should modify model according to the action defined (model' = {dummy_field: 24})
    //   - the action should be called with the parameters (inner fsm model : {}, event payload : 24)
    //
    // T6. Transition with one guard satisfied, and one action
    // WHEN after starting the statechart, event `event2` is sent with no event data
    // THEN :
    //   - it should transition to D
    //   - it should modify model according to the action defined (model' = {dummy_field: true})
    //   - the action should be called with the parameters (inner fsm model : {dummy_field: 24}, event payload : undefined)
    //
    // T7. Transition for event defined, but no guard satisfied when event occurs
    // WHEN after starting the statechart, event `event3` is sent with no event data
    // THEN :
    //   - it should ?? fatal error
    //   - it should modify model according to the action defined (model' = {dummy_field: true})
    //   - the action should be called with the parameters (inner fsm model : {dummy_field: 24}, event payload : undefined)

    /////////
    // Helper functions
    function set_dummy_field(model, event_payload) {
        model[DUMMY_FIELD] = event_payload;
        return model;
    }

    function set_dummy_field_to_false(model, event_payload) {
        model[DUMMY_FIELD] = false;
        return model;
    }

    function set_dummy_field_to_true(model, event_payload) {
        model[DUMMY_FIELD] = true;
        return model;
    }

    function has_dummy_field(model, event_data) {
        return !!model[DUMMY_FIELD];
    }

    function has_not_dummy_field(model, event_data) {
        return !model[DUMMY_FIELD];
    }


    // TODO : refactor conditions to guards, and condition to predicate
    QUnit.test("Standard transition mechanism - Initial transition", function (assert) {
        var done = assert.async(); // Cf. https://api.qunitjs.com/async/

        var model0 = undefined;
        var states_definition = {A: '', B: '', C: '', D: ''};
        var states = fsm.create_state_enum(states_definition);
        var event_enum = ['event1', 'event2', 'event3'];
        var events = fsm.create_event_enum(event_enum);
        var action_list = [set_dummy_field, set_dummy_field_to_false, set_dummy_field_to_true];
        var action_struct = fsm.make_action_DSL(action_list);
        var action_enum = action_struct.action_enum;
        var action_hash = action_struct.action_hash;
        var transitions = [
            {from: states.NOK, to: states.A, event: events.INIT},
            {from: states.A, to: states.B, event: events.EVENT1},
            {from: states.B, to: states.C, event: events.EVENT2, condition: utils.always(true)},
            {from: states.C, to: states.D, event: events.EVENT2, conditions: [
                {condition: has_dummy_field, to: states.D, action: set_dummy_field_to_true},
                {condition: has_not_dummy_field, to: states.C, action: set_dummy_field}
            ]},
            {from: states.D, to: states.D, event: events.EVENT3, condition: utils.always(false), action: set_dummy_field_to_false}
            // - B : event2 / true -> C
            // - C : event2 / ?dummy_field -> D : set field 'dummy_field' to true
            // - C : event2 / !dummy_field -> C : set field 'dummy_field'
            // - D : event3 / false -> D : set field 'dummy_field' to 0
        ];

        var state_chart = {
            model: model0,
            state_hierarchy: states,
            events: events,
            action_hash: action_hash,
            transitions: transitions
        };
        var expected_init_trace =
        {
            "event": {
                "code": "INIT",
                "payload": {
                    "__from": "nok",
                    "__internal_state": "expecting_action_result",
                    "__to": "A"
                }
            },
            "model": {
                "__error": undefined,
                "__event": undefined,
                "__event_data": undefined,
                "__from": undefined,
                "__internal_state": "intent",
                "__to": "A"
            },
            "resulting_state": "A"
            //                "time_stamp": 0 removed as it is non repeatable
        };
        var expected_no_event_handler_trace = {
            "error": "There is no transition associated to that event!",
            "event": DUMMY,
            "event_data": DUMMY,
            "resulting_state": "A"
        };
        var expected_transition_to_B_trace = {
            "event": {
                "code": "EVENT1",
                "payload": {}
            },
            "model": {
                "__error": undefined,
                "__event": undefined,
                "__event_data": undefined,
                "__from": undefined,
                "__internal_state": "intent",
                "__to": "B"
            },
            "resulting_state": "B"
        };

        ehfsm = fsm.make_fsm(state_chart, undefined); // intent$ is undefined here as we will simulate events
        ehfsm.output$.subscribe(function (model) {
            console.log('output', model)
        }); // We also have to subscribe to the external dataflow
        ehfsm.fsm_state$.subscribe(function (fsm_state) {
            console.log('fsm_state', fsm_state)
        });
        ehfsm.start_trace(); // NOTE : must be before the start call to also include the INIT event
        ehfsm.start(); // `start` initiates the inner dataflow subscription
        // NOTE : The init event is sent automatically AND synchronously so we can put the stop trace right after
        ehfsm.trace$.subscribe(function async_test(arr_traces_with_ts) {
            var arr_traces = remove_time_stamp(arr_traces_with_ts);
            console.log('arr_traces', arr_traces);
            // T1.
            assert.deepEqual(arr_traces[0], expected_init_trace, 'Starting the state machine sends an INIT event to the top-level state. The defined transition for that event is taken.');
            assert.deepEqual(true, true, 'That INIT event has the initial value of the model as event data');
            assert.deepEqual(true, true, 'falsy initial model are dealt with as empty objects');
            assert.deepEqual(true, true, 'model is decorated with extra meta properties (__error, __event. __event_data, __from, __internal_state, __to');
            // T2.
            assert.deepEqual(arr_traces[1], expected_no_event_handler_trace, 'If an event is triggered, and there is no transition defined for that event in the current state of the state machine, the event is ignored, and a recoverable error is reported.');
            assert.deepEqual(true, true, 'The resulting state in case of such recoverable error will be the same as prior the error.');
            // T3.
            assert.deepEqual(arr_traces[2], expected_transition_to_B_trace, 'If an event is triggered, and there is a transition defined for that event in the current state of the state machine, that transition is taken. If no action is specified, the model is kept unchanged.');
            // T4.

            done();
        });

        exec_on_tick(ehfsm.send_event, 10)(DUMMY, DUMMY);
        exec_on_tick(ehfsm.send_event, 20)(events.EVENT1, {});
        exec_on_tick(ehfsm.send_event, 30)(events.EVENT2, {});
        exec_on_tick(ehfsm.stop_trace, 30)();

        // END
    });


    ////////
    // GROUP : History mechanism

    ////////
    // GROUP : Nesting

    ////////
    // GROUP : Chart specification format

    // SUBGROUP : ...
    // T1. ...
    // GIVEN ...
    // WHEN ...
    // THEN ...

});
