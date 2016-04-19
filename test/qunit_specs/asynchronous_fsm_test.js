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

    QUnit.module("process_fsm_internal_transition(internal_fsm_def)(fsm_state, merged_labelled_input)", {
        // NOTE : this is a curried function to which parameters are applied
        // We test the curried function by running through a set of parameters
    });

    ////////
    // GROUP : Basic transition mechanism
    // SUBGROUP : Standard features

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

    QUnit.test("Basic transition mechanism", function (assert) {
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
        var action_list = [set_dummy_field(assert, done), set_dummy_field_to_false, set_dummy_field_to_true];
        var action_struct = fsm_helpers.make_action_DSL(action_list);
        var action_enum = action_struct.action_enum;
        var action_hash = action_struct.action_hash;
        var spy_actions = sinon.spy(action_hash, 'set_dummy_field');
        var transitions = [
            {from: states.NOK, to: states.A, event: events[EV_CODE_INIT]},
            {from: states.A, to: states.B, event: events.EVENT1},
            {from: states.B, to: states.C, event: events.EVENT2, predicate: utils.always(true)},
            {from: states.C, event: events.EVENT2, guards: [
                {predicate: has_dummy_field, to: states.D, action: action_enum.set_dummy_field_to_true},
                {predicate: has_not_dummy_field, to: states.C, action: action_enum.set_dummy_field}
            ]},
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

        var ehfsm = fsm.make_fsm(state_chart, undefined); // intent$ is undefined here as we will simulate events
        ehfsm.model_update$.subscribe(function (model_update) {
            console.log('model update', model_update);
        }); // We also have to subscribe to the external dataflow
        ehfsm.fsm_state$.subscribe(function (fsm_state) {
            console.log('fsm_state', utils.clone_deep(fsm_state));
        });
        ehfsm.start_trace(); // NOTE : must be before the start call to also include the INIT event
        ehfsm.start(); // `start` initiates the inner dataflow subscription
        // NOTE : The init event is sent automatically AND synchronously so we can put the stop trace right after
        ehfsm.trace$.subscribe(function async_test(arr_traces_with_ts) {
            var arr_traces = remove_timestamp_array_traces(arr_traces_with_ts);
            console.log('arr_traces', arr_traces);

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
            assert.deepEqual(true, true, 'That INIT event has the initial value of the model as event data');
            assert.deepEqual(true, true, 'falsy initial model are dealt with as empty objects');
            assert.deepEqual(true, true, 'model is decorated with extra meta properties (__error, __event. __event_data, __from, __internal_state, __to');

            // T2. No transition exists for that event
            // WHEN after starting the statechart, event 'dummy' is sent
            // THEN :
            //   - event is ignored (no effect)
            //   - recoverable error is generated in the outer fsm and visible in traces
            //   - model is updated (only internals!!)
            //   - the inner FSM current state remains the same
            //
            var expected_no_event_handler_trace = {
                "model": {},
                "model_update": {},
                "recoverable_error": {
                    "error": "There is no transition associated to that event!",
                    "event": "dummy",
                    "event_data": "dummy",
                    "resulting_state": "A"
                }
            };
            assert.deepEqual(arr_traces[1], expected_no_event_handler_trace, 'If an event is triggered, and there is no transition defined for that event in the current state of the state machine, the event is ignored, and a recoverable error is reported.');
            assert.deepEqual(true, true, 'The resulting state in case of such recoverable error will be the same as prior the error.');

            // T3. Transition with one guard and no action
            // WHEN after starting the statechart, event `event1` is sent
            // THEN :
            //   - it should transition to B
            //   - model is unchanged
            //
            var expected_transition_to_B_trace = {
                "event": {
                    "code": "EVENT1",
                    "payload": {}
                },
                "model": {},
                "model_update": {},
                "resulting_state": "B"
            };
            assert.deepEqual(arr_traces[2], expected_transition_to_B_trace, 'If an event is triggered, and there is a transition defined for that event in the current state of the state machine, that transition is taken. If no action is specified, the model is kept unchanged.');

            // T4. Transition with one guard satisfied and no action
            // WHEN after starting the statechart, event `event2` is sent
            // THEN :
            //   - it should transition to C
            //   - model is unchanged
            //
            var expected_transition_to_C_with_guard_trace = {
                "event": {
                    "code": "EVENT2",
                    "payload": {}
                },
                "model": {},
                "model_update": {},
                "resulting_state": "C"
            };
            assert.deepEqual(arr_traces[3], expected_transition_to_C_with_guard_trace, 'When a guard is specified, and satisfied, the corresponding transition is taken');

            // T5. Transition with one guard satisfied, and one action
            // WHEN after starting the statechart, event `event2` is sent with event data 24
            // THEN :
            //   - it should transition to C
            //   - it should modify model according to the action defined (model' = {dummy_field: 24})
            //   - the action should be called with the parameters (inner fsm model : {}, event payload : 24)
            //
            var expected_transition_to_C_with_guard_trace_2 = {
                "event": {
                    "code": "EVENT2",
                    "payload": 24
                },
                "model": {
                    "dummy_field": 24
                },
                "model_update": {
                    "dummy_field": 24
                },
                "resulting_state": "C"
            };
            var model_intermediary_value = expected_transition_to_C_with_guard_trace_2.model;
            assert.deepEqual(arr_traces[4], expected_transition_to_C_with_guard_trace_2, 'When a guard is specified, and satisfied, the corresponding action is executed and leads to the corresponding model update');
            console.log('expected_transition_to_D_with_guard_trace :: spy called with', spy_actions.firstCall.args);
            // NOTE!! testing is complicated by the fact that currently the model is being updated in place
            // TODO : find a better long-term solution (if possible without recurring to immutable)


            // T6. Transition with one guard satisfied, and one action
            // WHEN after starting the statechart, event `event2` is sent with no event data
            // THEN :
            //   - it should transition to D
            //   - it should modify model according to the action defined (model' = {dummy_field: true})
            //   - the action should be called with the parameters (inner fsm model : {dummy_field: 24}, event payload : undefined)
            //
            var expected_transition_to_D_no_guard_trace = {
                "event": {
                    "code": "EVENT2",
                    "payload": undefined
                },
                "model": {
                    "dummy_field": true
                },
                "model_update": {
                    "dummy_field": true
                },
                "resulting_state": "D"
            };
            assert.deepEqual(arr_traces[5], expected_transition_to_D_no_guard_trace, 'All specified guards are evaluated till one is satisfied, then the corresponding action is executed and leads to the corresponding model update');

            // T8. Transition for event defined, but no guard satisfied when event occurs
            // WHEN after starting the statechart, event `event3` is sent with no event data
            // THEN :
            //   - it should emit recoverable error
            //   - it should not update the model except meta data
            //   - no actions is executed
            //   - state should remain the same
            var expected_error_one_predicate_must_be_satisfied = {
                "model": {
                    "dummy_field": true
                },
                model_update: {},
                "recoverable_error": {
                    "error": "No transition found while processing the event EVENT3 while transitioning from state D .\n It is possible that no guard predicates were fulfilled.",
                    "event": "EVENT3",
                    "event_data": undefined,
                    "resulting_state": "D"
                }
            };
            assert.deepEqual(arr_traces[6], expected_error_one_predicate_must_be_satisfied, 'If an event handler is defined for a state, that event occurs, but none of the guards specified is fulfilled, then a recoverable error is generated, model is not updated, and the state remsins the same.');
            // TODO : review how effect_res error are handled. In principle, error_res instanceof Error, and should be catched somewhere action_result

            done();
        });

        // Sequence of testing events
        exec_on_tick(ehfsm.send_event, 10)(DUMMY, DUMMY);
        exec_on_tick(ehfsm.send_event, 30)(events.EVENT1, {});
        exec_on_tick(ehfsm.send_event, 50)(events.EVENT2, {});
        exec_on_tick(ehfsm.send_event, 70)(events.EVENT2, DUMMY_EVENT_DATA_VALUE);
        exec_on_tick(ehfsm.send_event, 90)(events.EVENT2);
        exec_on_tick(ehfsm.send_event, 110)(events.EVENT3);
        exec_on_tick(ehfsm.stop_trace, 130)();

        // END
    });

    ////////
    // GROUP : Basic transition mechanism
    // SUBGROUP : Order of execution of predicates
    // - if applicable vs. statechart spec, 2 transitions exist for that event, both have guards, first guard false, second guard true :
    //   - it is the action corresponding to the second guard which is selected (CONTRACT - ORDER OF EXECUTION OF PREDICATES)
    //   - but both guards are executed, the first first ( returns false) the second second (returns true)
    //   -

    QUnit.skip("Basic transition mechanism - Predicate execution order", function (assert) {

    });

    // TODO : fatal errors must be caught in an error handler or with an error transition
    //        tests can then be made on that error handler - this is the most robust and simple approach
    // TODO : recoverable errors must be passed to data structures and keep the state machine alive
    QUnit.skip("Error management", function (assert) {
        // Actions
        function throw_dummy_error(model, event_payload) {
            throw DUMMY_ERROR;
        }

        ////////
        // GIVEN a chart spec :
        // no state hierarchy
        // model0 :: {}
        // state definition :: {A: '', B: ''}
        // event enumeration :: ['event1']
        // action list :: [throw_dummy_error]
        // transition definition ::
        // - NOK : INIT -> A
        // - A : event1 -> B : throw dummy error
        //
        // T7. Transition for event defined, no guards, but action returns error
        // WHEN after starting the statechart, event `event1` is sent with no event data
        // THEN :
        //   - it should emit fatal error
        //   - it should trigger the appropriate error handler
        //   - state should remain the same
    });

    ////////
    // GROUP : History mechanism
    // - Depth of history arrows, transition to state with no previous history
    //   - root < A < B < (C, D), with tr(root->A, INIT), tr(A->B.H, INIT), tr(B->C, INIT)
    //   - root < A < B < (C, D), with tr(root->A, INIT), tr(A->A.H, INIT), tr(B->C, INIT),
    //   - root < A < B < C < (D, E), with tr(root->A, INIT), tr(A->C.H, INIT), tr(B->C, INIT), tr(C->D, INIT)
    //   + In all cases, this is the INIT transition which should be taken (by contract there is one)
    // - Depth of history arrows, transition to state with previous history
    //   - root < A < B < (C, D), with tr(root->A, INIT), tr(A->B.H, INIT), tr(B->C, INIT), tr(C->D, EV1), tr(D->A, EV2)
    //   + SHOULD go to B.H i.e. D
    //   - root < A < B < (C, D), C < (E, F), D < (G, H)
    //       . with tr(root->A, INIT), tr(A->B, INIT), tr(B->C, INIT), tr(C->E, INIT), tr(D->G, INIT)
    //       . with tr(E->G, EV1), tr(G->C, EV2)
    //       . with tr(E->B.H, EV3)
    //       + SHOULD go to E
    //   -

    QUnit.skip("History transition mechanism", function (assert) {

    });

    ////////
    // GROUP : Nesting
    // - Entry into nesting states -> INIT transitions
    // - Entry into nesting states with history -> did in HISTORY MECHANISM
    // - Exit from nesting states -> exit from the nested state to the destination state

    QUnit.skip("Nested state mechanism", function (assert) {

    });

    ////////
    // GROUP : Chart specification format
    // Validity of state chart definition
    // - TO CONTINUE WITH THE IMPLEMENTED FEATURES OF THE EXTENDED HIERARCHICAL STATE MACHINE
    // - MODEL
    // - model cannot be undefined, if empty then {}
    // - ACTIONS
    // - CANNOT have an action for the first INIT event, as this is how the initial model is set in the FSM
    // CONTRACT : action codes MUST NOT be false or falsy
    // - all actions must be functions and have a name
    // - no two actions can have the same name
    // - NESTING STATES
    // - there has to be an INIT event at the top level chart (otherwise don't know which state to start)
    // - initial state is set in stone and is NOK the state of which all states are children
    // CONTRACT : init events only acceptable in nesting state (aka grouping state)
    // NOTE : enforced via in_auto_state only true for grouping state
    // CONTRACT : Automatic actions with no events and only conditions are not allowed in nesting state (aka grouping state)
    // NOTE : That would lead to non-determinism if A < B < C and both A and B have such automatic actions
    // CONTRACT : every nesting state MUST have at MAX ONE init transition
    // CONTRACT : if there is a transition with destination a nesting state (standard or history), that nesting state much
    // have an init transition defined
    // - HISTORY MECHANISM
    // CONTRACT : no transition from the history state (history state is only a target state)
    // CONTRACT : history mechanism can only be used in connection with nesting states
    // CONTRACT : nesting states
    // - TRANSITIONS
    // CONTRACT : various guards on the same transitions must be passed in the same array (allows to specify order easily)
    // CONTRACT
    // - if applicable vs. statechart spec, 2 transitions exist for that event, with no guards :
    //   - design error!! (CHECK THE CODE TO SEE WHAT ARE THE MODIFICATIONS)
    // - if applicable vs. statechart spec, 2 transitions exist for that event, one with guard, other with no guards :
    //   - design error!! (CHECK THE CODE TO SEE WHAT ARE THE MODIFICATIONS)
    QUnit.skip("Chart specification format", function (assert) {

    });


    // SUBGROUP : ...
    // T1. ...
    // GIVEN ...
    // WHEN ...
    // THEN ...

});

