define(function (require) {
    var utils = require('utils');
    var Err = require('custom_errors');
    var synchronous_fsm = require('synchronous_standard_fsm');

    QUnit.module("evaluate_internal_transitions(fsm_internal_states, arr_transitions, fsm_state, internal_event)", {
    });

    // SKIPPED
    // E2. `arr_transitions` which is not one of the expected type (i.e. not array of transitions, not transition, but truthy)

    ////////
    // GROUP : edge cases

    // SUBGROUP : type contract
    // T1. Falsy value for array of transitions
    // GIVEN an `arr_transitions` which is falsy
    // WHEN calling `evaluate_internal_transitions`
    // THEN throws exception
    QUnit.test("Falsy value for array of transitions", function (assert) {
        var fsm_internal_states = {}; // Reminder : UNUSED FOR NOW
        var fsm_state = {field: 'value'};
        var internal_event = {};
        var arr_transitions = undefined;

        assert.throws(
            utils.defer_fn(synchronous_fsm.evaluate_internal_transitions,
                [fsm_internal_states, arr_transitions, fsm_state, internal_event]),
            "throws exception when called with falsy value for the array of transitions"
        );
    });

    // SUBGROUP : exceptions
    // E1. No predicate satisfied while evaluating transitions
    // GIVEN :
    // - an internal event, a `fsm_state` value
    // - an `arr_transitions` :: Transition, such that the internal event do not satisfy any predicate defined in
    // the given transitions
    // WHEN calling `evaluate_internal_transitions`
    // THEN throws exception

    QUnit.test("Transition evaluation", function (assert) {
        var fsm_internal_states = {}; // Reminder : UNUSED FOR NOW
        var fsm_state = {field: 'field value'};
        var internal_event = {event: 'event value'};
        var arr_transitions = {
            predicate: utils.always(false),
            action: utils.identity,
            to: 'irrelevant here'
        };

        assert.throws(
            utils.defer_fn(synchronous_fsm.evaluate_internal_transitions,
                [fsm_internal_states, arr_transitions, fsm_state, internal_event]),
            "throws exception when it cannot find a valid transition (none of the transition predicates were fulfilled)"
        );
    });

    ////////
    // GROUP : main cases

    // M1. Correct transition evaluated, ordering of predicate evaluation, action execution
    // GIVEN :
    // - an internal event, a `fsm_state` value
    // - an `arr_transitions` of type Array<Transition> such that the transition index 0 has a fulfilled predicate
    //   with the given value of `fsm_state` and the internal event
    // WHEN calling `evaluate_internal_transitions`
    // THEN it evaluates to :
    // - error : undefined
    // - next_state : the corresponding next state for the transition at index 0
    // - updated_fsm_state : the corresponding return value of the executed action for the transition at index 0

    // M2. Ordering of predicate evaluation
    // GIVEN :
    // - an internal event, a `fsm_state` value
    // - an `arr_transitions` of type Array<Transition> such that :
    //   - the transition index 0 has NOT a fulfilled predicate
    //   - the transition index 1 has a fulfilled predicate
    //   with the given value of `fsm_state` and the internal event
    // WHEN calling `evaluate_internal_transitions`
    // THEN it evaluates to :
    // - error : undefined
    // - next_state : the corresponding next state for the transition at index 1
    // - updated_fsm_state : the corresponding return value of the executed action for the transition at index 1

    // M3. Action execution
    // GIVEN (M1 | M2)
    // WHEN calling `evaluate_internal_transitions`
    // THEN the action is called with the `fsm_state` and `internal_event` as parameters in that order

    QUnit.test("Transition evaluation - order of evaluation - action execution", function (assert) {
        var fsm_internal_states = {}; // Reminder : UNUSED FOR NOW
        var fsm_state = {field: 'field value'};
        var internal_event = {event: 'event value'};
        var hash_actions = {
            action: utils.identity
        };
        var hash_actions_bis = {
            action: utils.identity
        };
        var spy_actions = sinon.spy(hash_actions, 'action');
        var arr_transitions_0 = [
            {
                predicate: utils.always(false),
                action: utils.identity,
                to: 'irrelevant here'
            },
            {
                predicate: utils.always(true),
                action: hash_actions.action,
                to: 'destination state'
            }
        ];
        var expected_ordering_0 = {
            updated_fsm_state: fsm_state,
            next_state: 'destination state',
            error: undefined
        };
        var arr_transitions_1 = [
            {
                predicate: utils.always(true),
                action: hash_actions_bis.action,
                to: 'first possible destination state'
            },
            {
                predicate: utils.always(true),
                action: utils.identity,
                to: 'second possible destination state'
            }
        ];
        var expected_ordering_1 = {
            updated_fsm_state: fsm_state,
            next_state: 'first possible destination state',
            error: undefined
        };

        assert.deepEqual(
            synchronous_fsm.evaluate_internal_transitions(fsm_internal_states, arr_transitions_1, fsm_state, internal_event),
            expected_ordering_1,
            'Evaluates predicates in index order'
        );
        assert.deepEqual(
            synchronous_fsm.evaluate_internal_transitions(fsm_internal_states, arr_transitions_0, fsm_state, internal_event),
            expected_ordering_0,
            'Executes the action corresponding to the first predicate which is fulfilled'
        );
        assert.equal(spy_actions.called && spy_actions.calledWith(fsm_state, internal_event),
            true,
            'Action is called with the model and the event as parameters (in that order)'
        );
        assert.equal(true, true,
            'returns {updated_fsm_state: result of action, next_state: as defined per the transition, error: undefined}');
    });

    // M4. Action throwing an exception, transition passed directly as an object (vs. in an array)
    // GIVEN :
    // - an internal event, a `fsm_state` value
    // - an `arr_transitions` of type Transition such that the transition has a fulfilled predicate
    // - an action which throws an exception
    // WHEN calling `evaluate_internal_transitions`
    // THEN it evaluates to :
    // - error : the error returned by the action call
    // - next_state : undefined
    // - updated_fsm_state : `fsm_state`

    QUnit.test("Transition evaluation - action execution - execution error", function (assert) {
        var fsm_internal_states = {}; // Reminder : UNUSED FOR NOW
        var fsm_state = {field: 'field value'};
        var internal_event = {event: 'event value'};
        var arr_transitions = {
            predicate: utils.always(true),
            action: function () {
                throw 'anything';
            },
            to: 'irrelevant here'
        };
        var error = Err.tryCatch(arr_transitions.action)();

        assert.deepEqual(
            synchronous_fsm.evaluate_internal_transitions(fsm_internal_states, arr_transitions, fsm_state, internal_event),
            {
                updated_fsm_state: fsm_state,
                next_state: undefined,
                error: error
            },
            'returns {error : the error, next_state: undefined, updated_fsm_state : unmodified fsm_state}'
        );
    });


});

