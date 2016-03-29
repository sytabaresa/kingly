/**
 * Created on 7/03/16.
 */
define(function (require) {
    var utils = require('utils');
    var Err = require('custom_errors');
    var fsm = require('asynchronous_fsm');

    // state machine definition
    // state (model) initial object with internal_state expecting
    // merged_labelled_input

    //

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
        var ehfsm = fsm.make_fsm(state_chart, undefined); // intent$ is undefined here as we will simulate events
        ehfsm.start();
        // ehfsm.start_trace(); // TODO: before or after??
        // NOTE : The init event is sent automatically AND synchronously so we can put the stop trace right after
        // ehfsm.stop_trace();
        ehfsm.trace$.subscribe(function async_test(arr_traces) {
            assert.deepEqual(arr_traces, [], 'Starting the state machine sends an INIT event to the top-level state. The defined transition for that event is taken.')
        });
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
