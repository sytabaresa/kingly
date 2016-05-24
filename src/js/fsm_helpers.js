define(function (require) {
    var constants = require('constants');
    var utils = require('utils');
    var  INITIAL_STATE_NAME = constants.INITIAL_STATE_NAME;
    var  EV_CODE_INIT = constants.EV_CODE_INIT;

    function make_action_DSL(action_list) {
        // action_list is an array whose entries are actions (functions)
        // Returns :
        // [function my_name(){}] -> action_enum : {my_name: 'my_name'}
        // [function my_name(){}] -> action_hash : {my_name: 0}
        var action_list_min = {identity: utils.identity};
        return action_list.reduce(function build_action_enum(action_struct, action_fn, index) {
            var action_name = action_fn.name;
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
        var event_hash = array_identifiers.reduce(function (acc, identifier) {
            acc[identifier.toUpperCase()] = identifier.toUpperCase();
            return acc;
        }, {});
        // Add 'init' event code
        // NOTE : That will overwrite any other event called EV_CODE_INIT...
        event_hash[EV_CODE_INIT] = EV_CODE_INIT;
        return event_hash;
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

    return {
        make_action_DSL: make_action_DSL,
        create_event_enum: create_event_enum,
        create_state_enum: create_state_enum
    }
});
