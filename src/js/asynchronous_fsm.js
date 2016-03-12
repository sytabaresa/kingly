// TODO : check if fsm is multi-instances (i.e. new instance every time, no shared data)
// TODO : check that the action_res received is the action_res expected i.e. keep action_req at hand, and send action_req with action_res
//        also, give a unique ID (time+counter) to the request - so modify to_observable or add a function after it
// TODO : write documentation in readme.md - argue use case for HFSM, give roadmap
// TODO : add the possibility to add conditions one by one on a given transition (preprocessing the array beforehand?)
// TODO : entry and exit actions?? annoying as it forces to add up more intermediate state in the internal state machine
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
// TODO : DSL
// TODO : write program which takes a transition specifications and draw a nice graph out of it with yed or else
// TODO : think about the concurrent states (AND state
// NOTE : AND states gives problems of processing events (an action_res can be received by several states)
//        so 1 AND state could have received its action result and move on, while the second is still waiting for an action res to come...


// NOTE : Dead states:
// - Possible if automatic actions (no events) with conditions always true. If there is not another condition which at some
// point is set to false, we have an infinite loop (a very real one which could monopolize the CPU if all actions are synchronous)
// - To break out of it, maybe put a guard that if we remain in the same state for X steps, transition automatically (to error or else)

// Implementation contracts
// CONTRACT :Actions cannot return an object of type error if not error (check code again)
// CONTRACT : event handlers MUST be pure (they will be executed several times with the same input)

// Behavioural contracts
// Reminder : there are two kinds of intents : user generated intent, and program generated intent
// Reminder : there are two kinds of sources : intents and effect responses (or results, terminology still in flux)
// Terminology :
// - thereafter we refer by FSM (or inner FSM) the finite state machine whose specs is passed as parameter to the state machine
// builder
// - we refer by internal/outer FSM the finite state machine used to build the state machine builder
//
// CONTRACT : on receiving an intent:
// - if applicable vs. statechart spec, no transition exists for that event (no handler exists for that event) :
//   - warning is generated
//   - model is updated (only internals!!)
//   - the outer FSM model is updated (also referred as internal model) : ACTUALLY SHOULD BE DONE IN synchronous fsm TESTING!!
//   - the inner FSM current state remains the same
//   - else ? (review code)
// - if applicable vs. statechart spec, 1 transition exists for that event, with no guard :
//   - the corresponding action is executed with the parameters (CHECK IN THE CODE)
//   - the result of that action is found in field (CHECK THE CODE) of the return value of the makeFSM function
// - if applicable vs. statechart spec, 2 transitions exist for that event, with no guards :
//   - design error!! (CHECK THE CODE TO SEE WHAT ARE THE MODIFICATIONS)
// - if applicable vs. statechart spec, 2 transitions exist for that event, one with guard, other with no guards :
//   - design error!! (CHECK THE CODE TO SEE WHAT ARE THE MODIFICATIONS)
// - if applicable vs. statechart spec, 2 transitions exist for that event, both have guards, first guard false, second guard true :
//   - it is the action corresponding to the second guard which is selected (CONTRACT - ORDER OF EXECUTION OF PREDICATES)
//   - but both guards are executed, the first first ( returns false) the second second (returns true)
// CONTRACT : If there is no action specified for a transition, the identity action is used
// - if applicable vs. statechart spec, 1 transition exist for that event, no guard, no action :
//   - the FSM transitions to the next state, the model is not changed, the special action identity is executed
//   -
// TODO : add history mechanism testing, main case and edge case (no history yet, do like init)
// TODO : add hierarchical state entry testing (automatic events)
// TODO : add new feature : actions can send events - first design it

//   - CF. OTHER TESTS TO SEE WHAT MODEL MODIFICATIONS ARE, AND STATE MODIFICATIONS ARE
// - TO CONTINUE WITH THE IMPLEMENTED FEATURES OF THE EXTENDED HIERARCHICAL STATE MACHINE
//
//

// CONTRACT : the fsm, after emitting an effect request, blocks till it received the corresponding effect response
// TODO : have another format for effect responses?? so the user cannot have events that could be mistaken for effect responses
// We already have a different format as those events comes from another channel. That channel has to be hidden to avoid
// having other agents sending effect_res to it!! and the internal details not disclosed (in the public documentation)


// Validity of state chart definition
// CONTRACT : action codes MUST NOT be false or falsy
// CONTRACT : no transition from the history state (history state is only a target state)
// CONTRACT : init events only acceptable in nesting state (aka grouping state)
// NOTE : enforced via in_auto_state only true for grouping state
// CONTRACT : Automatic actions with no events and only conditions are not allowed in nesting state (aka grouping state)
// NOTE : That would lead to non-determinism if A < B < C and both A and B have such automatic actions
// CONTRACT : every state MUST have only one init transition
// CONTRACT : various guards on the same transitions must be passed in the same array (allows to specify order easily)


define(function (require) {
    var utils = require('utils');
    var Err = require('custom_errors');
    var Rx = require('rx');
    var _ = require('lodash');
    var synchronous_fsm = require('synchronous_standard_fsm');

    return require_async_fsm(synchronous_fsm, Rx, Err, utils);
});

function require_async_fsm(synchronous_fsm, Rx, Err, utils) {

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
    function build_nested_state_structure(states) {
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
                    var event_emitter_name = x.event_emitter_name;
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
    function create_state_enum(states) {
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
        var special_actions = {identity: ACTION_IDENTITY};
        var transitions = cd_player_state_chart.cd_player_transitions;
        var hash_states_struct = build_nested_state_structure(states);
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
                                utils.info("IN STATE ", from);
                                utils.info("WITH model, event data BEING ", model_, event_data);
                                utils.info("CASE : "
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

    /**
     * Side-effects :
     * - modifies `hash_states`
     * - emits an `last_seen_from_state` event
     * @param from
     * @param hash_states
     * @returns -
     */
    function leave_state(from, /*OUT*/hash_states) {
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
        state_from.emit_last_seen_state_event({
            event_emitter_name: state_from_name,
            last_seen_state_name: state_from_name
        });
    }

    /**
     * Side-effects :
     * - modifies `hash_states`
     * @param to
     * @param hash_states
     * @throws
     * @returns {String} next state name
     */
    function enter_next_state(to, /*OUT*/hash_states) {
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

        utils.info("AND TRANSITION TO STATE", state_to_name);
        return state_to_name;
    }

    function get_next_state(to, hash_states) {
        // Enter the target state
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
        }
        // CASE : normal state
        else if (to) {
            state_to_name = to;
        }
        else {
            throw 'enter_state : unknown case! Not a state name, and not a history state to enter!'
        }

        utils.info("AND TRANSITION TO STATE", state_to_name);
        return state_to_name;
    }

    function process_automatic_events(state_name, special_events, hash_states, is_auto_state, is_init_state, previously_processed_event_data) {
        var current_state = state_name;
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
     */
    function process_fsm_internal_transition(fsm_def) {
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
            // intent -> {code, payload}, action_res -> Object
            var internal_event = merged_labelled_input[internal_event_type];

            var evaluation_result = synchronous_fsm.evaluate_internal_transitions(
                fsm_internal_states,
                synchronous_fsm.get_internal_transitions(fsm_internal_transitions, fsm_current_internal_state, internal_event_type),
                /*OUT*/fsm_state, internal_event
            );
            if (evaluation_result.error) {
                throw evaluation_result.error;
            }
            else {
                return synchronous_fsm.update_next_internal_state(/*OUT*/evaluation_result.updated_fsm_state, evaluation_result.next_state);
            }
        }
    }

    function get_internal_sync_fsm() {
        ////////////
        // Define the (synchronous standard finite) state machine for the state machine maker (!)
        ////////////
        // States
        var fsm_internal_states = {};
        fsm_internal_states[EXPECTING_INTENT] = {entry: undefined, exit: undefined};
        fsm_internal_states[EXPECTING_ACTION_RESULT] = {entry: undefined, exit: undefined};
        // Transitions
        var fsm_internal_transitions = {};
        fsm_internal_transitions[EXPECTING_INTENT] = {
            intent: [
                {
                    // CASE : There is a transition associated to that event
                    predicate: has_event_handler_and_has_effect_code,
                    action: update_internals_with_effect_code,
                    to: EXPECTING_ACTION_RESULT
                },
                {
                    // CASE : we don't have a truthy effect code :
                    // - none of the guards were truthy, it is a possibility
                    // So we remain in the same state
                    predicate: has_event_handler_and_has_not_effect_code,
                    action: emit_warning,
                    to: EXPECTING_INTENT
                },
                {
                    // CASE : There is no transition associated to that event from that state
                    predicate: has_not_event_handler,
                    action: update_model_with_warning,
                    to: EXPECTING_INTENT // should not matter as we throw an exception
                }
            ],
            effect_res: [// TODO : remove array to test the arraize function
                {
                    // CASE : we receive an effect result, but we were NOT expecting it
                    predicate: utils.always(true), // predicate satisfied
                    action: emit_only_warning,
                    to: EXPECTING_INTENT // remain in same state
                }
            ]
        };
        fsm_internal_transitions[EXPECTING_ACTION_RESULT] = {
            effect_res: [
                {
                    // CASE : the effect could not be executed satisfactorily
                    predicate: is_effect_error,
                    action: set_internal_state_to_expecting_intent_but_reporting_action_error,
                    to: EXPECTING_INTENT
                },
                {
                    // CASE : effect was executed correctly
                    predicate: utils.always(true),
                    action: transition_to_next_state,
                    to: EXPECTING_INTENT
                }
            ],
            intent: {
                // CASE : received effect result while expecting intent : that should NEVER happen
                // as the fsm is supposed to block waiting for the effect to be executed and return its result
                predicate: utils.always(true),
                action: throw_received_unexpected_effect_result_exception
            }
        };

        ////////////
        // Predicates
        function has_event_handler(fsm_state, internal_event) {
            var event = internal_event.code;
            var hash_states = fsm_state.hash_states;
            var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
            return !!hash_states[current_state][event];
        }

        function has_effect_code(fsm_state, internal_event) {
            var event = internal_event.code;
            var event_data = internal_event.payload;
            var model = fsm_state.model;
            var hash_states = fsm_state.hash_states;
            var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
            var event_handler = hash_states[current_state][event];
            return has_event_handler(fsm_state, internal_event)
                && event_handler(model, event_data, current_state).effect_code;
        }

        function has_event_handler_and_has_effect_code(fsm_state, internal_event) {
            return has_event_handler(fsm_state, internal_event) && has_effect_code(fsm_state, internal_event);

        }

        function has_event_handler_and_has_not_effect_code(fsm_state, internal_event) {
            return has_event_handler(fsm_state, internal_event) && !has_effect_code(fsm_state, internal_event);
        }

        function has_not_event_handler(fsm_state, internal_event) {
            return !has_event_handler(fsm_state, internal_event);
        }

        function is_effect_error(fsm_state, internal_event) {
            var effect_res = internal_event;
            return effect_res instanceof Error;
        }

        ////////////
        // Actions
        function update_internals_with_effect_code(fsm_state, internal_event) {
            // CASE : There is a transition associated to that event : an effect has to be executed
            // Reminder : When there is no action defined in the transition, we set the effect to identity

            utils.log("found event handler!");
            utils.info("WHEN EVENT ", internal_event.code);
            utils.info("with payload ", internal_event.payload);

            var event = internal_event.code;
            var event_data = internal_event.payload;
            var model = fsm_state.model;
            var hash_states = fsm_state.hash_states;
            var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
            var event_handler = hash_states[current_state][event];
            var effect_struct = event_handler(model, event_data, current_state);
            var effect_code = effect_struct.effect_code;
            var from = effect_struct.from;
            var to = effect_struct.to;

            set_internal_state_to_expecting_effect_result(/*OUT*/fsm_state, from, to, effect_code, event_data);

            return fsm_state;
        }

        function emit_warning(fsm_state, internal_event) {
            var event = internal_event.code;
            var event_data = internal_event.payload;
            var model = fsm_state.model;
            var hash_states = fsm_state.hash_states;
            var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
            var event_handler = hash_states[current_state][event];
            var effect_struct = event_handler(model, event_data, current_state);
            var from = effect_struct.from;

            set_internal_state_to_expecting_intent(fsm_state, undefined);
            console.warn(['No effect code found while processing the event', event,
                'while transitioning from state', from].join(" "));
            return fsm_state;
        }

        function emit_only_warning(fsm_state, internal_event) {
            // TODO : think about options for the warning (error?exception?)
            console.warn('received effect result while waiting for intent');
            return fsm_state;
        }

        function update_model_with_warning(fsm_state, internal_event) {
            // CASE : There is no transition associated to that event from that state
            // TODO : think more carefully about error management : have an optional parameter to decide behaviour?
            // We keep the internal state `expecting` property the same
            // However, we update the model to indicate that an error occurred
            // it will be up to the user to determine what to do with the error
            var event = internal_event.code;
            var event_data = internal_event.payload;
            var hash_states = fsm_state.hash_states;
            var current_state = hash_states[INITIAL_STATE_NAME].current_state_name;
            var error_msg = 'There is no transition associated to that event!';
            fsm_state.model = update_model_private_props(fsm_state.model, current_state, undefined,
                fsm_state.internal_state.expecting);
            fsm_state.model = update_model_with_error(fsm_state.model, event, event_data, error_msg);

            utils.info("WHEN EVENT ", event);
            console.error(error_msg);

            set_internal_state_to_transition_error(/*OUT*/fsm_state, error_msg);

            return fsm_state;
        }

        function set_internal_state_to_expecting_intent_but_reporting_action_error(fsm_state, internal_event) {
            var effect_res = internal_event;
            var error = effect_res.toString();
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
            console.log("Received effect_res", effect_res);

            set_internal_state_to_expecting_intent_but_reporting_action_error_(/*OUT*/fsm_state, error);
            return fsm_state;
        }

        /////////
        // we gather the state fields interdependencies for the internal controlled states here in a set of impure functions
        function set_internal_state_to_expecting_effect_result(fsm_state, from, to, effect_code, event_data) {
            // no change of the model to reflect, we only received an intent
            //fsm_state.internal_state.is_model_dirty = false;
            fsm_state.internal_state.is_model_dirty = true; // set to true when we need to pass meta data of internal state
            // new controlled internal state, we received the intent, now we need to execute the corresponding effect
            fsm_state.internal_state.expecting = EXPECTING_ACTION_RESULT;
            // no automatic event, we are sending an effect request
            fsm_state.automatic_event = undefined;
            // when the effect result is received, we need to know the impacted transition
            fsm_state.internal_state.from = from;
            fsm_state.internal_state.to = to;
            // pass down the effect to execute with its parameters
            fsm_state.effect_req = effect_code;
            fsm_state.effect_payload = event_data; // TODO change name to effect_payload to avoid confusion with payload of non-internal events
            // no error
            fsm_state.transition_error = false;
            // update model private props which are computed properties based on `fsm_state`
            fsm_state.model = update_model_private_props(fsm_state.model, fsm_state.internal_state.from, fsm_state.internal_state.to, fsm_state.internal_state.expecting);
        }

        function set_internal_state_to_transition_error(fsm_state, error_msg) {
            // set `is_model_dirty` to true as we have a new model to pass down stream
            fsm_state.internal_state.is_model_dirty = true;
            // There is no transition associated to that event, we wait for another event
            fsm_state.internal_state.expecting = EXPECTING_INTENT;
            // no automatic event here
            fsm_state.automatic_event = undefined;
            // from and to are only used to keep track of the transition state for the ACTION_RES internal state
            fsm_state.internal_state.from = undefined;
            fsm_state.internal_state.to = undefined;
            // no effect to execute
            fsm_state.effect_req = undefined;
            fsm_state.effect_payload = undefined;
            // error to signal
            fsm_state.transition_error = true;
            // update model private props which are computed properties based on `fsm_state`
            // Nice to have : a computed property library like Ampersand&State or Mobx could help, maybe later
            // NOTE : note that we adjust the model private `to` and `from` to the failed transition (we could not go to the `to`)
            // and the view displays `to` as the State, so as we remain in the same state the `to` is `from`
            fsm_state.model = update_model_private_props(fsm_state.model, fsm_state.model.__from, fsm_state.model.__from, fsm_state.internal_state.expecting);
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
            fsm_state.effect_payload = undefined;
            // no error
            fsm_state.transition_error = undefined;
            // update model private props which are computed properties based on `fsm_state`
            fsm_state.model = update_model_private_props(fsm_state.model, fsm_state.internal_state.from, fsm_state.model.__to, fsm_state.internal_state.expecting);
        }

        function set_internal_state_to_expecting_intent_but_reporting_action_error_(fsm_state, error) {
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
            fsm_state.effect_payload = undefined;
            // update model private props which are computed properties based on `fsm_state`
            fsm_state.model = update_model_private_props(fsm_state.model, fsm_state.internal_state.from, fsm_state.model.__to, fsm_state.internal_state.expecting);
        }

        function transition_to_next_state(fsm_state, internal_event) {
            var effect_res = internal_event;
            var hash_states = fsm_state.hash_states;
            var from = fsm_state.internal_state.from;
            var to = fsm_state.internal_state.to;
            var model = fsm_state.model;
            var model_prime = effect_res;
            var previously_processed_event_data = fsm_state.effect_payload;

            console.log("Received effect_res", effect_res);

            // Leave the current state
            // CONTRACT : we leave the state only if the effect for the transition is successful
            // This is better than backtracking or having the fsm stay in an undetermined state
            leave_state(from, hash_states);
            var next_state = get_next_state(to, hash_states);

            // send the AUTO event to trigger transitions which are automatic :
            // - transitions without events
            // - INIT events
            var automatic_event = process_automatic_events(
                next_state,
                fsm_state.special_events,
                hash_states,
                fsm_state.is_auto_state,
                fsm_state.is_init_state,
                previously_processed_event_data);

            // Update the model before entering the next state...
            fsm_state.model = update_model(model, model_prime);            // TODO : have it automatically computed as this is an equality for all times
            fsm_state.model = update_model_private_props(fsm_state.model, from, next_state, fsm_state.internal_state.expecting);

            set_internal_state_to_expecting_intent(/*OUT*/fsm_state, automatic_event);

            // ...and enter the next state (can be different from `to` if we have nesting state group)
            var state_to = hash_states[next_state];
            state_to.active = true;
            hash_states[INITIAL_STATE_NAME].current_state_name = next_state;

            utils.info("RESULTING IN : ", fsm_state.model);

            return fsm_state;
        }

        function throw_received_unexpected_effect_result_exception(fsm_state, internal_event) {
            // TODO : think about options for the warning (error?exception?)
            console.warn('received effect result while waiting for event');
            throw 'received effect result while waiting for event';
        }

        return {
            states: fsm_internal_states,
            transitions: fsm_internal_transitions
        }
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
     * @param cd_player_state_chart
     * @param user_generated_intent$
     * @param effect_res$
     * @param program_generated_intent$
     * @returns {{fsm_state${Rx.Observable}, effect_req${Rx.Observable}}
 */
    function transduce_fsm_streams(cd_player_state_chart, user_generated_intent$, effect_res$, program_generated_intent$) {
        // TODO update return value of transduce_fsm_streams and definition parameters and body:
        // output$, set_internal_state, get_internal_state
        var fsm_initial_state = compute_fsm_initial_state(cd_player_state_chart);

        var internal_fsm_def = get_internal_sync_fsm();

        var merged_labelled_sources$ = Rx.Observable.merge(
            Rx.Observable
                .merge(user_generated_intent$, program_generated_intent$)
                .map(utils.label('intent')),
            effect_res$.map(utils.label('effect_res')))
            .do(utils.rxlog('merge labelled sources'));

        var fsm_state$ = merged_labelled_sources$
            .scan(process_fsm_internal_transition(internal_fsm_def), fsm_initial_state)
            .shareReplay(1)
            .do(utils.rxlog('fsm state$'))


        var effect_req$ = fsm_state$
            .filter(function (fsm_state) {
                return fsm_state.effect_req;
            })
            .map(function (fsm_state) {
                return {
                    effect_req: fsm_state.effect_req,
                    model: fsm_state.model,
                    payload: fsm_state.effect_payload
                };
            })
            .do(utils.rxlog('effect req$'))
            .publish();

        // The output symbol stream
        var state$ = fsm_state$
                .filter(function filter_in_new_model(fsm_state) {
                    return fsm_state.internal_state.is_model_dirty;
                })
                .map(function (fsm_state) {
                    return fsm_state.model;
                })
                .startWith(fsm_initial_state)
                .do(utils.rxlog('new model emitted'))
            ;

        var program_generated_intent_req$ = fsm_state$
            .filter(utils.get_prop('automatic_event'))
            .map(utils.get_prop('automatic_event'))
            .startWith({
                code: fsm_initial_state.special_events.INIT,
                payload: fsm_initial_state.model
            })
            .do(utils.rxlog('program_generated_intent_req$'))
            .publish();

        return {
            fsm_state$: fsm_state$,
            state$: state$,
            effect_req$: effect_req$,
            program_generated_intent_req$: program_generated_intent_req$
        }
    }

    function make_fsm(cd_player_state_chart, user_generated_intent$) {
        var effect_req_disposable, program_generated_intent_req_disposable;
        var effect_resS = new Rx.ReplaySubject(1), program_generated_intentS = new Rx.ReplaySubject(1);
        var effect_hash = cd_player_state_chart.action_hash;
        var fsm_sinks = transduce_fsm_streams(cd_player_state_chart, user_generated_intent$, effect_resS, program_generated_intentS);

        function start() {
            // Connecting requests streams to responses
            effect_req_disposable = make_effect_handler_operator(effect_hash)(fsm_sinks.effect_req$)
                .subscribe(effect_resS);
            program_generated_intent_req_disposable = fsm_sinks.program_generated_intent_req$
                .subscribe(program_generated_intentS);
            fsm_sinks.program_generated_intent_req$.connect();
            fsm_sinks.effect_req$.connect();
        }

        function stop() {
            dispose(effect_req_disposable);
            dispose(program_generated_intent_req_disposable);
        }

        function dispose(subject) {
            subject.onCompleted();
            subject.dispose();
        }

        return {
            start: start,
            stop: stop,
            output$: fsm_sinks.state$,
            set_internal_state: fsm_sinks.set_internal_state, // TODO but should be used only for testing
            get_internal_state: fsm_sinks.get_internal_state // TODO but should be used only for testing
        }
    }

    function make_effect_handler_operator(effect_hash) {
        // An effect is a function :: model -> event_data -> model
        // 1. From the function list, we derive an enumeration from the function names
        //    By construction there cannot be two functions with the same name
        //    The function names will serve as the DSL to represent the actions
        // The resulting DSL is generated to serve as input to the main
        // effect_req maker
        return function effect_req_interpreter(effect_req$) {
            // 1. Look up effect_req in list of actions
            // 2. If not there, return error code or send error through subject
            // 3. If there, then execute the action
            var effect_res$ = effect_req$
                .flatMap(function (effect_req) {
                    var effect_payload = effect_req.effect_payload;
                    var effect_enum = effect_req.effect_req;
                    var model = effect_req.model;
                    var effect = effect_hash[effect_enum];
                    if (effect) {
                        // CASE : we do have some actions to execute
                        var effect_res = Err.tryCatch(function execute_effect(effect, effect_payload) {
                            console.info("THEN : we execute the effect " + effect.name);
                            return effect(model, effect_payload);
                        })(effect, effect_payload);
                        if (effect_res instanceof Error) {
                            return Rx.Observable.return(effect_res);
                        }
                        else return utils.to_observable(effect_res);
                    }
                    else {
                        // TODO : be careful, they say flatMap swallow errors, That should be a fatal error
                        return Rx.Observable.throw('no effect found for effect code ' + effect_enum);
                    }
                });
            return effect_res$;
        }
    }

    return {
        make_fsm: make_fsm,
        transduce_fsm_streams: transduce_fsm_streams,
        process_fsm_internal_transition: process_fsm_internal_transition,
        create_state_enum: create_state_enum,
        create_event_enum: create_event_enum,
        make_action_DSL: make_action_DSL
    }
}
