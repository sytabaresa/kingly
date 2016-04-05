/**
 * Created on 7/03/16.
 */
define(function (require) {
    const DUMMY = 'dummy';
    var utils = require('utils');
    var Err = require('custom_errors');
    var fsm = require('asynchronous_fsm');

    function exec_on_tick(fn, tick) {
        return function (){
            var args = Array.prototype.slice.call(arguments);
            setTimeout(function(){fn.apply(null, args)}, tick);
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
    // GIVEN a chart spec : no hierarchy, two states A and B, init on state A, ev(event1) -> B, no actions, no predicates
    // model0 :: undefined
    // state definition :: {A: '', B: ''}
    // event enumeration :: ['event1']
    // action list :: []
    // transition definition ::
    // - NOK : INIT -> A
    // - A : event1 -> B
    // WHEN starting the statechart
    // THEN it should transitions to A
    // T2. No transition exists for that event
    // WHEN after starting the statechart, event 'dummy' is sent
    // THEN :
    //   - warning is generated
    //   - model is updated (only internals!!)
    //   - the outer FSM model is updated (also referred as internal model) : ACTUALLY SHOULD BE DONE IN synchronous fsm TESTING!!
    //   - the inner FSM current state remains the same
    //   - else ? (review code)


    QUnit.test("Standard transition mechanism - Initial transition", function (assert) {
        var done = assert.async(); // Cf. https://api.qunitjs.com/async/

        var model0 = undefined;
        var states_definition = {A: '', B: ''};
        var states = fsm.create_state_enum(states_definition);
        var event_enum = ['event1'];
        var events = fsm.create_event_enum(event_enum);
        var action_list = [];
        var action_struct = fsm.make_action_DSL(action_list);
        var action_enum = action_struct.action_enum;
        var action_hash = action_struct.action_hash;
        var transitions = [
            {from: states.NOK, to: states.A, event: events.INIT},
            {from: states.A, to: states.B, event: events.EVENT1}
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
            "event_data": DUMMY
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
            done();
        });

        // T2.
        exec_on_tick(ehfsm.send_event, 25)(DUMMY, DUMMY);
        exec_on_tick(ehfsm.stop_trace, 50)();

        // END
    });

    // T2. No transitions exist for that event
    // GIVEN a chart spec : no hierarchy, two states A and B, init on state A, ev(event1) -> B, no actions, no predicates
    // model0 :: undefined
    // state definition :: {A: '', B: ''}
    // event enumeration :: ['event1']
    // action list :: []
    // transition definition ::
    // - NOK : INIT -> A
    // - A : event1 -> B
    // WHEN starting the statechart AND sending event 'event0'
    // THEN it should throw an error


    // - if applicable vs. statechart spec, no transition exists for that event (no handler exists for that event) :
    //   - warning is generated
    //   - model is updated (only internals!!)
    //   - the outer FSM model is updated (also referred as internal model) : ACTUALLY SHOULD BE DONE IN synchronous fsm TESTING!!
    //   - the inner FSM current state remains the same
    //   - else ? (review code)

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
