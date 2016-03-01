// TODO : write documentation in readme.md - argue use case for HFSM, give roadmap
// TODO : write the example properly with requirejs
// TODO : TEST CASE no history (last seen state is null...)
// TODO : test all cases (review code) - for instance action depending on condition
// TODO : add the view (template + enabling disabling of buttons in function of state)
// TODO : add the possibility to add conditions one by one on a given transition (preprocessing the array beforehand?)
// TODO : entry and exit actions?? annoying as it forces to add up more intermediate state in the internal state machine
// TODO : reproduce the problem of cycling and not having a starting with and post on SO
// TODO : maybe remove or optionalize the internal state metadata passing in the model
// TODO : also guard against an action res coming not associated with the action_res we are expecting
//{from: states.cd_loaded_group, to: states.cd_stopped, event: cd_player_events.NEXT_TRACK, condition: is_last_track, action: stop},
//{from: states.cd_loaded_group, to: states.history.cd_loaded_group, event: cd_player_events.NEXT_TRACK, condition: is_not_last_track, action: go_next_track},
////vs. {from: states.cd_loaded_group, to: states.cd_stopped, event: cd_player_events.NEXT_TRACK, conditions: [
////      {condition: is_last_track, to: states.cd_stopped, action: stop},
////      {condition: is_not_last_track, to: states.history.cd_loaded_group, action: go_next_track}
////    ]},
// TODO : Add termination connector (T)?
// TODO : abstract the tree traversal for the build states part
// TODO : externalize action with possibility to wait for values or move on
// TODO : DSL
// TODO : write program which takes a transition specifications and draw a nice graph out of it with yed or else
// TODO : think about the concurrent states (AND state


// CONTRACT : action codes MUST NOT be false or falsy
// CONTRACT : no transition from the history state (history state is only a target state)
// CONTRACT : init events only acceptable in nesting state (aka grouping state)
// NOTE : enforced via in_auto_state only true for grouping state
// CONTRACT : Automatic actions with no events and only conditions are not allowed in nesting state (aka grouping state)
// NOTE : That would lead to non-determinism if A < B < C and both A and B have such automatic actions
// CONTRACT : There MUST be an action in each transition
// CONTRACT :Actions cannot return an object of type error if not error
// NOTE : Dead states:
// - Possible if automatic actions (no events) with conditions always true. If there is not another condition which at some
// point is set to false, we have an infinite loop (a very real one which could monopolize the CPU if all actions are synchronous)
// - To break out of it, maybe put a guard that if we remain in the same state for X steps, transition automatically (to error or else)

// TODO : review cd_player (is there something to eliminate ? it should be independent, we use an API, implementation should not matter)

function require_async_fsm(utils) {

    // CONSTANTS
    const INITIAL_STATE_NAME = 'nok';
    const STATE_PROTOTYPE_NAME = 'State'; // !!must be the function name for the constructor State, i.e. State
    const EXPECTING_INTENT = 'intent';
    const EXPECTING_ACTION_RESULT = 'expecting_action_result';
    const ACTION_IDENTITY = 'identity';

    function make_action_DSL(action_list) {
        // action_list is an array whose entries are actions (functions)
        // Returns :
        // [function my_name(){}] -> action_enum : {my_name: 'my_name'}
        // [function my_name(){}] -> action_hash : {my_name: 0}
        var action_list_min = {identity: utils.identity};
        return action_list.reduce(function build_action_enum(action_struct, action_fn, index) {
            var action_name = action_fn.name;
            // TODO : make and throw an internal app error with some info in it
            if (!action_name) throw 'ERROR : when processing action list, found an action function without a name! (index ' + index + ')'
            action_struct.action_enum[action_name] = action_name;
            action_struct.action_hash[action_name] = action_fn;
            return action_struct;
        }, {action_enum: {}, action_hash: action_list_min});
    }

    /**
     * Takes a list of identifiers (strings), adds init to it, and returns a hash whose properties are the uppercased identifiers
     * For instance :
     * ('edit', 'delete') -> {EDIT: 'EDIT', DELETE : 'DELETE', INIT : 'INIT'}
     * If there is an init in the list of identifiers, it is overwritten
     * RESTRICTION : avoid having init as an identifier
     * @param array_identifiers {Array | arguments}
     * @returns {Object<String,String>}
     */
    function create_event_enum(array_identifiers) {
        array_identifiers = array_identifiers.reduce ? array_identifiers : Array.prototype.slice.call(arguments);
        // NOTE : That will overwrite any other event called init...
        array_identifiers.push('init');
        return array_identifiers.reduce(function (acc, identifier) {
            acc[identifier.toUpperCase()] = identifier.toUpperCase();
            return acc;
        }, {})
    }

    /**
     * Returns the name of the function as taken from its source definition.
     * For instance, function do_something(){} -> "do_something"
     * @param fn {Function}
     * @returns {String}
     */
    function get_fn_name(fn) {
        var tokens =
            /^[\s\r\n]*function[\s\r\n]*([^\(\s\r\n]*?)[\s\r\n]*\([^\)\s\r\n]*\)[\s\r\n]*\{((?:[^}]*\}?)+)\}\s*$/
                .exec(fn.toString());
        return tokens[1];
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
    function build_nested_state_structure(states, Rx) {
        var root_name = 'State';
        var last_seen_state_event_emitter = new Rx.Subject();
        var hash_states = {};
        var last_seen_state_listener_disposables = [];
        var is_group_state = {};

        // Add the starting state
        states = {nok: states};

        ////////
        // Helper functions
        function add_last_seen_state_listener(child_name, parent_name) {
            last_seen_state_listener_disposables.push(
                last_seen_state_event_emitter.subscribe(function (x) {
                    var event_emitter_name = x.event_emitter_name
                    var last_seen_state_name = x.last_seen_state_name;
                    if (event_emitter_name === child_name) {
                        console.log(['last seen state set to', utils.wrap(last_seen_state_name), 'in', utils.wrap(parent_name)].join(" "));
                        hash_states[parent_name].history.last_seen_state = last_seen_state_name;
                    }
                }));
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
                var parent_name = hash_states[state_name].parent_name = get_fn_name(curr_constructor);
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

        // The `emitLastSeenStateEvent` is set on the State object which is inherited by all state objects, so it can be
        // called from all of them when a transition triggers a change of state
        State.prototype = {
            emitLastSeenStateEvent: function (x) {
                last_seen_state_event_emitter.onNext(x);
            },
            current_state_name: INITIAL_STATE_NAME
        };

        hash_states[INITIAL_STATE_NAME] = new State();
        hash_states[STATE_PROTOTYPE_NAME] = new State();

        build_state_reducer(states, State);

        return {
            hash_states: hash_states,
            is_group_state: is_group_state
        };
    }

    /**
     * Returns a hash which maps a state name to :
     * - a string identifier which represents the standard state
     * - a function whose name is the state name to represent the state history (set in the `history` property of the hash)
     * @param states A hash describing a hierarchy of nested states
     * @returns {state_name: {String}, {history: {Function}}}
     */
    function build_state_enum(states) {
        var states_enum = {history: {}};

        // Set initial state
        states_enum.NOK = INITIAL_STATE_NAME;

        function build_state_reducer(states) {
            Object.keys(states).forEach(function (state_name) {
                var state_config = states[state_name];

                states_enum[state_name] = state_name;
                // All history states will be signalled through the history property, and a function instead of a value
                // The function name is the state name whose history is referred to
                var state_name_history_fn;
                eval(['state_name_history_fn = function', state_name, '(){}'].join(" "));
                states_enum.history[state_name] = state_name_history_fn;

                if (typeof(state_config) === 'object') {
                    build_state_reducer(state_config);
                }
            })
        }

        build_state_reducer(states);

        return states_enum;
    }


    function compute_fsm_initial_state(cd_player_state_chart) {
        // Create the nested hierarchical
        var states = cd_player_state_chart.cd_player_states;
        var events = cd_player_state_chart.cd_player_events;
        var special_events = create_event_enum('auto', 'init');
        var special_actions = {identity: ACTION_IDENTITY};// TODO : the identity property should be extracted to a constant for DRY
        var transitions = cd_player_state_chart.cd_player_transitions;
        var hash_states_struct = build_nested_state_structure(states, Rx);
        // {Object<state_name,boolean>}, allows to know whether a state is a group of state or not
        var is_group_state = hash_states_struct.is_group_state;
        var hash_states = hash_states_struct.hash_states;

        // {Object<state_name,boolean>}, allows to know whether a state has a init transition defined
        var is_init_state = get_init_transitions(transitions, special_events);

        // {Object<state_name,boolean>}, allows to know whether a state has an automatic transition defined
        var is_auto_state = get_auto_states(transitions, events, is_group_state, is_init_state, special_events);

        set_event_handlers(transitions, /*OUT*/hash_states, special_events, special_actions);

        return {
            model: utils.clone(cd_player_state_chart.model), // clone the initial value of the model
            special_events: special_events,
            is_init_state: is_init_state,
            is_auto_state: is_auto_state,
            is_group_state: is_group_state,
            hash_states: hash_states,
            internal_state: {
                expecting: EXPECTING_INTENT,
                is_model_dirty: true,
                from: undefined,
                to: undefined
            },
            payload: undefined,
            effect_req: undefined,
            transition_error: false,
            automatic_event: undefined
        };

        function get_init_transitions(transitions, special_events) {
            var is_init_state = {};
            transitions.forEach(function (transition) {
                var from = transition.from;
                var event = transition.event;

                // CASE : transition has a init event
                // NOTE : there should ever only be one, but we don't enforce it for now
                if (event === special_events.INIT) {
                    is_init_state[from] = true;
                }
            });
            return is_init_state;
        }

        function get_auto_states(transitions, events, is_group_state, is_init_state, special_events) {
            return transitions.reduce(function (is_auto_state, transition) {
                var from = transition.from;
                var event = transition.event;

                // ERROR CASE : state found in transition but cannot be found in the events passed as parameter
                // NOTE : this is probably all what we need the events variable for
                if (event && !(event in events)) throw 'unknow event (' + event + ') found in state machine definition!';
                // CASE : automatic transitions : no events - likely a transient state with only conditions
                if (!event) {
                    event = special_events.AUTO;
                    is_auto_state[from] = true;
                }
                // CASE : automatic transitions : init event automatically fired upon entering a grouping state
                if (is_group_state[from] && is_init_state[from]) {
                    is_auto_state[from] = true;
                }
                return is_auto_state;
            }, {});
        }

        function set_event_handlers(transitions, /*OUT*/hash_states, special_events, special_actions) {
            transitions.forEach(function (transition) {
                // console.log("Processing transition:", transition);
                var from = transition.from, to = transition.to;
                var action = transition.action;
                var event = transition.event || special_events.AUTO;

                // CONTRACT : `conditions` property used for array of conditions, otherwise `condition` property is used
                var arr_predicate = transition.conditions || transition.condition;
                // CASE : ZERO OR ONE condition set
                if ((arr_predicate && !arr_predicate.forEach) || !arr_predicate) arr_predicate = [
                    {condition: arr_predicate, to: to, action: action    }
                ];

                var from_proto;
                from_proto = hash_states[from];

                //console.log("This is transition for event:", event);
                //console.log("Predicates:", arr_predicate);

                from_proto[event] = arr_predicate.reduce(function (acc, condition, index) {
                    var action = condition.action;
                    //console.log("Condition:", condition);
                    var condition_checking_fn = (function (condition) {
                        var condition_suffix = '';
                        // We add the `current_state` because the current state might be different from the `from` field here
                        // This is the case for instance when we are in a substate, but through prototypal inheritance it is
                        // the handler of the prototype which is called
                        var condition_checking_fn = function (model_, event_data, current_state) {
                            from = current_state || from;
                            var predicate = condition.condition;
                            condition_suffix = predicate ? '_checking_condition_' + index : '';
                            var to = condition.to;
                            if (!predicate || predicate(model_, event_data)) {
                                // CASE : condition for transition is fulfilled so we can execute the actions...
                                console.info("IN STATE ", from);
                                console.info("WITH model, event data BEING ", model_, event_data);
                                console.info("CASE : "
                                    + (predicate ? "condition " + predicate.name + " for transition is fulfilled"
                                        : "automatic transition"));

                                return action
                                    // allows for chaining and stop chaining condition
                                    ? {effect_code: action, from: from, to: to}
                                    // CASE : I have a condition which is fulfilled but no action
                                    // so, the model does not change, but the transition should happen
                                    : {effect_code: special_actions.identity, from: from, to: to};
                            }
                            else {
                                // CASE : condition for transition is not fulfilled
                                console.log("CASE : "
                                    + (predicate ? "condition " + predicate.name + " for transition NOT fulfilled..."
                                        : "no predicate"));
                                return {effect_code: undefined, from: from, to: to};
                            }
                        };
                        condition_checking_fn.displayName = from + condition_suffix;
                        return condition_checking_fn;
                    })(condition);

                    return function arr_predicate_reduce_fn(model_, event_data, current_state) {
                        var condition_checked = acc(model_, event_data, current_state);
                        return condition_checked.effect_code
                            ? condition_checked // would be the effect code to interpret
                            : condition_checking_fn(model_, event_data, current_state);
                    }
                }, function default_predicate() {
                    return {effect_code: undefined, from: from}
                });
            });
        }
    }

    function update_model(model, model_prime) {
        // For now, very simple update
        // NOTE : could be adapted to use immutable data structure
        // NOTE : Model decorated with state information for tracing and displaying purposes
        return update_model_remove_error_fields(model_prime);
        //        return update_model_with_error(model_prime, undefined, error);
    }

    function update_model_private_props(model, from, to, internal_state) {
        model.__from = from;
        model.__to = to;
        model.__internal_state = internal_state;
        return model;
    }

    function update_model_with_error(model, event, event_data, error_msg) {
        model.__error = error_msg;
        model.__event = event;
        model.__event_data = event_data;
        return model;
    }

    function update_model_remove_error_fields(model) {
        model.__error = undefined;
        model.__event = undefined;
        model.__event_data = undefined;
        return model;
    }

    function leave_state(from, hash_states) {
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
        state_from.emitLastSeenStateEvent({
            event_emitter_name: state_from_name,
            last_seen_state_name: state_from_name
        });
    }

    function enter_next_state(to, hash_states) {
        // Enter the target state
        var state_to;
        var state_to_name;
        // CASE : history state (H)
        if (typeof(to) === 'function') {
            state_to_name = get_fn_name(to);

            var target_state = hash_states[state_to_name].history.last_seen_state;
            state_to_name = target_state
                // CASE : history state (H) && existing history, target state is the last seen state
                ? target_state
                // CASE : history state (H) && no history (i.e. first time state is entered), target state is the entered state
                : state_to_name;
            state_to = hash_states[state_to_name];
        }
        // CASE : normal state
        else if (to) {
            state_to = hash_states[to];
            state_to_name = state_to.name;
        }
        else {
            throw 'enter_state : unknown case! Not a state name, and not a history state to enter!'
        }
        state_to.active = true;
        hash_states[INITIAL_STATE_NAME].current_state_name = state_to_name;

        console.info("AND TRANSITION TO STATE", state_to_name);
        return state_to_name;
    }

    function process_automatic_events(special_events, hash_states, is_auto_state, is_init_state, previously_processed_event_data) {
        var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
        // Two cases here:
        // 1. Init handlers, when present on the current state, must be acted on immediately
        // This allows for sequence of init events in various state levels
        // For instance, L1: init -> L2:init -> L3:init -> L4: stateX
        // In this case event_data will carry on the data passed on from the last event (else we loose the model?)
        // 2. transitions with no events associated, only conditions (i.e. transient states)
        //    In this case, there is no need for event data
        if (is_auto_state[current_state]) {
            // CASE : transient state with no triggering event, just conditions
            var auto_event = is_init_state[current_state] ? special_events.INIT : special_events.AUTO;
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

    /**
     * TODO : document transition mechanism
     * TODO : redocument the function
     * - transition format
     *   - events : if not present, then actions become automatic
     *   - condition(s) : if several, pass them in an array (field `conditions`), the order of the array is the order
     *                    of applying the conditions. When a single condition (field `condition`)
     *                    When the first is found true, the sequence of condition checking stops there
     *   - action : function (model, event_data) : model_prime
     *   - from : state from which the described transition operates
     *   - to : target state for the described transition
     * @param cd_player_state_chart
     * @param intent$
     * @param effect_res$
     * @returns {{fsm_state${Rx.Observable}, effect_req${Rx.Observable}}
 */
    function make_fsm(cd_player_state_chart, intent$, effect_res$, ractive$) {
        var fsm_initial_state = compute_fsm_initial_state(cd_player_state_chart);

        // we gather the state fields interdependencies for the internal controlled states here in a set of impure functions

        function set_internal_state_to_expecting_effect_result(fsm_state, from, to, effect_code, event_data) {
            // no change of the model to reflect, we only received an intent
            //fsm_state.internal_state.is_model_dirty = false;
            fsm_state.internal_state.is_model_dirty = true; // set to true when we need to pass meta data of internal state
            // new controlled internal state, we received the intent, now we need to execute the corresponding effect
            fsm_state.internal_state.expecting = EXPECTING_ACTION_RESULT;
            // when the effect result is received, we need to know the impacted transition
            fsm_state.internal_state.from = from;
            fsm_state.internal_state.to = to;
            // pass down the effect to execute with its parameters
            fsm_state.effect_req = effect_code;
            fsm_state.payload = event_data;
            // no error
            fsm_state.transition_error = false;
        }

        function set_internal_state_to_transition_error(fsm_state, error_msg) {
            // set `is_model_dirty` to true as we have a new model to pass down stream
            fsm_state.internal_state.is_model_dirty = true;
            // new controlled internal state, we received the intent, now we need to execute the corresponding effect
            fsm_state.internal_state.expecting = EXPECTING_INTENT;
            // from and to are only used to keep track of the transition state for the ACTION_RES internal state
            fsm_state.internal_state.from = undefined;
            fsm_state.internal_state.to = undefined;
            // no effect to execute
            fsm_state.effect_req = undefined;
            fsm_state.payload = undefined;
            // error to signal
            fsm_state.transition_error = true;

            console.error(error_msg);
        }

        function set_internal_state_to_expecting_intent(fsm_state, automatic_event) {
            // set the automatic event if any (will be undefined if there is none)
            fsm_state.automatic_event = automatic_event;
            // model has been modified
            fsm_state.internal_state.is_model_dirty = true;
            // but we remain in the internal state EXPECTING_INTENT as there are automatic events
            // to process. Those events come through the intent$ channel, like other user-originated
            // events.
            fsm_state.internal_state.expecting = EXPECTING_INTENT;
            // EXPECTING_INTENT internal state does not make use of from and to
            fsm_state.internal_state.from = undefined;
            fsm_state.internal_state.to = undefined;
            // no effect request to be made
            fsm_state.effect_req = undefined;
            fsm_state.payload = undefined;
            // no error
            fsm_state.transition_error = undefined;
        }

        function set_internal_state_to_expecting_intent_but_reporting_action_error(fsm_state, error) {
            // there was an error while executing the effect request
            fsm_state.transition_error = error;
            // but the model was not modified
            fsm_state.internal_state.is_model_dirty = false;
            // so we remain in the internal state EXPECTING_INTENT to receive other events
            fsm_state.internal_state.expecting = EXPECTING_INTENT;
            // EXPECTING_INTENT internal state does not make use of from and to
            fsm_state.internal_state.from = undefined;
            fsm_state.internal_state.to = undefined;
            // no automatic event
            fsm_state.automatic_event = undefined;
            // no effect request to be made
            fsm_state.effect_req = undefined;
            fsm_state.payload = undefined;

        }

        function process_fsm_internal_transition(fsm_state, merged_labelled_input) {
            var hash_states = fsm_state.hash_states;
            var model = fsm_state.model;
            var from, to;
            var error_msg;
            // this is a flag to indicate that the model has possibly changed
            fsm_state.internal_state.is_model_dirty = false;
            fsm_state.internal_state.transition_error = false;
            fsm_state.automatic_event = undefined;

            switch (Object.keys(merged_labelled_input)[0]) {
                case 'intent' :
                    // 1. First of all, check that this is what we are expecting
                    // In other words, check that the input (event) is compatible with the internal state, so we can
                    // transition internally to the state effect_res
                    if (fsm_state.internal_state.expecting === EXPECTING_INTENT) {
                        // model_prime will need to have a code for errors (intent not allowed in current state for instance)
                        var intent = merged_labelled_input.intent;
                        var event = intent.code;
                        var event_data = intent.payload;
                        console.log("Processing event ", event, event_data);
                        var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
                        var event_handler = hash_states[current_state][event];

                        if (event_handler) {
                            // CASE : There is a transition associated to that event
                            utils.log("found event handler!");
                            console.info("WHEN EVENT ", event);
                            // Reminder : returns false OR an effect code
                            var effect_struct = event_handler(model, event_data, current_state);
                            var effect_code = effect_struct.effect_code;
                            from = effect_struct.from;
                            to = effect_struct.to;

                            if (effect_code) {
                                // CASE : an effect has to be executed
                                // This code path should always be active as when there is no effect, we set effect to identity
                                set_internal_state_to_expecting_effect_result(/*OUT*/fsm_state, from, to, effect_code, event_data);
                                fsm_state.model = update_model_private_props(model, from, to, fsm_state.internal_state.expecting);

                                return fsm_state;
                            }
                            else {
                                // CASE : we don't have a truthy effect code :
                                // - none of the guards were truthy, it is a possibility
                                // So we remain in the same state
                                set_internal_state_to_expecting_intent(fsm_state, undefined);
                                console.warn(['No effect code found while processing the event', event,
                                    'while transitioning from state', from].join(" "));
                                return fsm_state;
                            }
                        }
                        else {
                            // CASE : There is no transition associated to that event from that state
                            // TODO : think more carefully about error management
                            // We keep the internal state `expecting` property the same
                            // However, we update the model to indicate that an error occurred
                            error_msg = 'There is no transition associated to that event!';
                            // we receive an intent but no event handler was found to handle it, we update the model to reflect the error
                            // it will be up to the user to determine what to do with the error
                            fsm_state.model = update_model_private_props(fsm_state.model, current_state, undefined,
                                fsm_state.internal_state.expecting);
                            fsm_state.model = update_model_with_error(fsm_state.model, event, event_data, error_msg);

                            set_internal_state_to_transition_error(/*OUT*/fsm_state, error_msg);

                            return fsm_state;
                        }
                    }
                    else {
                        // TODO : think about options for the warning (error?exception?)
                        // CASE : received effect result while expecting intent : that should NEVER happen
                        // as the fsm is supposed to block waiting for the effect to be executed and return its result
                        console.warn('received effect result while waiting for event');
                        throw 'received effect result while waiting for event';
                    }
                    break;

                case 'effect_res' :
                    // `effect_res` can be any of the basic types, or any object, which includes also being an observable or promise
                    // For now we use ractive, which can receive observable, when used in conjunction with the Rxjs observable plugin
                    // `effect_res` can also be Error type if an error occurred
                    var effect_res = merged_labelled_input.effect_res;
                    var previously_processed_event_data = fsm_state.payload;

                    if (fsm_state.internal_state.expecting === EXPECTING_ACTION_RESULT) {
                        // TODO : also check that I received the right effect  res, so add a code for that expected effect res
                        // CASE : we receive an effect result, and we were expecting it
                        if (effect_res instanceof Error) {
                            var error = effect_res.toString();
                            // CASE : the effect could not be executed satisfactorily
                            // TODO : what to do in that case?
                            // - have a generic nested state for handling error?
                            // - require user to have specific transitions for handling error?
                            //   + that means that the effect_res must be passed to the condition handler...
                            //   + best is probably in the transition definition to define an error transition
                            //     associated to an error event
                            // - fail silently and remain in the same state?
                            //   + in that case, we still have to change the internal state to NOT expecting effect_res
                            // - fail abruptly with a fatal error passed to a global error handler?
                            console.error(effect_res);
                            console.error(effect_res.stack);
                            // For now:
                            // - we do not change state and remain in the current state, waiting for another intent
                            // - but we do not update the model
                            set_internal_state_to_expecting_intent_but_reporting_action_error(/*OUT*/fsm_state, error);
                            return fsm_state;
                        }
                        else {
                            // CASE : effect was executed correctly
                            from = fsm_state.internal_state.from;
                            to = fsm_state.internal_state.to;
                            var model_prime = effect_res;

                            // Leave the current state
                            // CONTRACT : we leave the state only if the effect for the transition is successful
                            // This is better than backtracking or having the fsm stay in an undetermined state
                            leave_state(from, hash_states);

                            // ...and enter the next state (can be different from to if we have nesting state group)
                            var next_state = enter_next_state(to, hash_states);

                            // send the AUTO event to trigger transitions which are automatic :
                            // - transitions without events
                            // - INIT events
                            var automatic_event = process_automatic_events(
                                fsm_state.special_events,
                                hash_states,
                                fsm_state.is_auto_state,
                                fsm_state.is_init_state,
                                previously_processed_event_data);

                            set_internal_state_to_expecting_intent(/*OUT*/fsm_state, automatic_event);

                            // Update the model after entering the next state
                            fsm_state.model = update_model(model, model_prime);
                            fsm_state.model = update_model_private_props(model, from, next_state, fsm_state.internal_state.expecting);

                            console.info("RESULTING IN : ", fsm_state.model);

                            return fsm_state;
                        }
                    }
                    else {
                        // CASE : we receive an effect result, but we were NOT expecting it
                        // TODO : think about options for the warning (error?exception?)
                        console.warn('received intent while waiting for effect result');
                        return fsm_state;
                    }
                    break;

                default :
                    // CASE : mislabelled observables?? should never happened
                    throw 'unknown label for input observable';
                    break;
            }
        }

        var merged_labelled_sources$ = Rx.Observable
            .merge(
            Rx.Observable.concat(
                Rx.Observable.return({
                    intent: {
                        code: fsm_initial_state.special_events.INIT,
                        payload: fsm_initial_state.model
                    }}),
                Rx.Observable.defer(function () {
                    // we have to do this manip. to make sure the template is displayed before extracting the intents
                    return Rx.Observable.merge(intent$, ractive$).map(utils.label('intent'))
                })
            ),
            effect_res$.map(utils.label('effect_res'))
        );
        /*
         intent$.map(utils.label('intent'))
         .startWith({
         intent: {
         code: fsm_initial_state.special_events.INIT,
         payload: fsm_initial_state.model
         }}),
         effect_res$.map(utils.label('action_res'))
         );
         */
        var fsm_state$ = merged_labelled_sources$
            .scan(process_fsm_internal_transition, fsm_initial_state)
            .share()
            .startWith(fsm_initial_state);

        var effect_req$ = fsm_state$
            .filter(function (fsm_state) {
                return fsm_state.effect_req;
            })
            .map(function (fsm_state) {
                return {
                    effect_req: fsm_state.effect_req,
                    model: fsm_state.model,
                    payload: fsm_state.payload
                };
            });

        return {
            fsm_state$: fsm_state$,
            effect_req$: effect_req$
        }
    }

    return {
        make_fsm: make_fsm,
        build_state_enum: build_state_enum,
        create_event_enum: create_event_enum,
        make_action_DSL: make_action_DSL
    }
}
