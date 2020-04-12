import {
    ACTION_FACTORY_DESC,
    ACTION_IDENTITY,
    AUTO_EVENT,
    DEEP,
    ENTRY_ACTION_FACTORY_DESC,
    history_symbol,
    INIT_EVENT,
    INIT_STATE,
    NO_OUTPUT,
    PREDICATE_DESC,
    SHALLOW,
    STATE_PROTOTYPE_NAME,
    UPDATE_STATE_FN_DESC
} from "./properties";
import {
    arrayizeOutput,
    assert,
    computeHistoryMaps,
    destructureEvent,
    emptyConsole,
    emptyTrace,
    findInitTransition,
    get_fn_name,
    getFsmStateList,
    getFunctionName,
    handleFnExecError,
    initHistoryDataStructure,
    isActions,
    isBoolean,
    isError,
    isEventStruct,
    isHistoryControlState,
    keys,
    mapOverTransitionsActions,
    noop,
    notifyAndRethrow,
    throwIfInvalidActionResult,
    throwIfInvalidEntryActionResult,
    throwIfInvalidGuardResult,
    tryCatchMachineFn,
    updateHistory,
    wrap
} from "./helpers";
import {fsmContractChecker} from "./contracts"

const alwaysTrue = () => true;

/**
 * Takes a list of identifiers (strings), adds init to it, and returns a hash whose properties are
 * the uppercased identifiers For instance :
 * ('edit', 'delete') -> {EDIT: 'EDIT', DELETE : 'DELETE', INIT : 'INIT'}
 * If there is an init in the list of identifiers, it is overwritten
 * RESTRICTION : avoid having init as an identifier
 * @param array_identifiers {Array | arguments}
 * @returns {Object<String,String>}
 */
function build_event_enum(array_identifiers) {
    let _array_identifiers = array_identifiers.reduce
        ? array_identifiers.slice()
        : Array.prototype.slice.call(arguments);
    // NOTE : That will overwrite any other event called init...
    _array_identifiers.push(INIT_EVENT);
    return _array_identifiers.reduce(function (acc, identifier) {
        acc[identifier] = identifier;
        return acc;
    }, {});
}

/**
 * Processes the hierarchically nested states and returns miscellaneous objects derived from it:
 * `is_group_state` : {Object<String,Boolean>} Hash whose properties (state names) are matched with
 * whether that state is a nested state
 * `hash_states` : Hierarchically nested object whose properties are the nested states.
 * - Nested states inherit (prototypal inheritance) from the containing state.
 * - Holds a `history` property which holds a `last_seen_state` property which holds the latest
 * state for that hierarchy group For instance, if A < B < C and the state machine leaves C for a
 * state in another branch, then `last_seen_state` will be set to C for A, B and C
 * - Tthe root state (NOK) is added to the whole hierarchy, i.e. all states inherit from the root
 * state
 * `states` {Object<String,Boolean>} : Hash which maps every state name with itself
 * `states.history` {Object<String,Function>} : Hash which maps every state name with a function
 * whose name is the state name
 * @param states
 * @returns {{hash_states: {}, is_group_state: {}}}
 */
function build_nested_state_structure(states) {
    const root_name = "State";
    let hash_states = {};
    let is_group_state = {};

    // Add the starting state
    states = {nok: states};

    ////////
    // Helper functions
    function build_state_reducer(states, curr_constructor) {
        keys(states).forEach(function (state_name) {
            const state_config = states[state_name];

            // The hierarchical state mechanism is implemented by reusing the standard Javascript
            // prototypal inheritance If A < B < C, then C has a B as prototype which has an A as
            // prototype So when an event handler (transition) is put on A, that event handler will be
            // visible in B and C
            hash_states[state_name] = new curr_constructor();
            hash_states[state_name].name = state_name;
            const parent_name = (hash_states[state_name].parent_name = get_fn_name(
                curr_constructor
            ));
            hash_states[state_name].root_name = root_name;

            if (typeof state_config === "object") {
                is_group_state[state_name] = true;
                const curr_constructor_new = function () {
                };
                curr_constructor_new.displayName = state_name;
                curr_constructor_new.prototype = hash_states[state_name];
                build_state_reducer(state_config, curr_constructor_new);
            }
        });
    }

    function State() {
    }

    State.prototype = {
        current_state_name: INIT_STATE
    };

    hash_states[INIT_STATE] = new State();
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
 * @param states A hash describing a hierarchy of nested states
 * @returns {state_name: {String}}
 */
export function build_state_enum(states) {
    let states_enum = {history: {}};

    // Set initial state
    states_enum.NOK = INIT_STATE;

    function build_state_reducer(states) {
        keys(states).forEach(function (state_name) {
            const state_config = states[state_name];

            states_enum[state_name] = state_name;

            if (typeof state_config === "object") {
                build_state_reducer(state_config);
            }
        });
    }

    build_state_reducer(states);

    return states_enum;
}

export function normalizeTransitions(fsmDef) {
    const {initialControlState, transitions} = fsmDef;
    const initTransition = findInitTransition(transitions);

    if (initialControlState) {
        return transitions
            .concat([{from: INIT_STATE, event: INIT_EVENT, to: initialControlState, action: ACTION_IDENTITY}])
    }
    else if (initTransition) {
        return transitions
    }
}

export function normalizeFsmDef(fsmDef) {
    return Object.assign({}, fsmDef, {transitions: normalizeTransitions(fsmDef)})
}

// Alias for compatibility before deprecating entirely create_state_machine
export function create_state_machine(fsmDef, settings) {
    return createStateMachine(fsmDef, settings)
}

/**
 * Creates an instance of state machine from a set of states, transitions, and accepted events. The initial
 * extended state for the machine is included in the machine definition.
 * @param {FSM_Def} fsmDef
 * @param {FSM_Settings} settings
 * @return {function(*=)}
 */
export function createStateMachine(fsmDef, settings) {
    const {
        states: control_states,
        events,
        // transitions ,
        initialExtendedState,
        updateState: userProvidedUpdateStateFn,
    } = fsmDef;
    const {debug} = settings || {};
    const checkContracts = debug && debug.checkContracts || void 0;
    let console = debug && debug.console ? debug.console : emptyConsole;
    let trace = debug && debug.trace ? debug.trace : emptyTrace;

    if (checkContracts) {
        const {failingContracts} = fsmContractChecker(fsmDef, settings, checkContracts);
        if (failingContracts.length > 0) throw new Error(`createStateMachine: called with wrong parameters! Cf. logs for failing contracts.`)
    }

    const wrappedUpdateState = tryCatchMachineFn(UPDATE_STATE_FN_DESC, userProvidedUpdateStateFn, ['extendedState,' +
    ' updates']);
    const _events = build_event_enum(events);
    const transitions = normalizeTransitions(fsmDef);

    // Create the nested hierarchy
    const hash_states_struct = build_nested_state_structure(control_states);

    // This will be the extended state object which will be updated by all actions and on which conditions
    // will be evaluated It is safely contained in a closure so it cannot be accessed in any way
    // outside the state machine.
    // Note the extended state is modified by the `settings.updateState` function, which should not modify
    // the extended state object. There is hence no need to do any cloning.
    let extendedState = initialExtendedState;

    // history maps
    const {stateList, stateAncestors} = computeHistoryMaps(control_states);
    let history = initHistoryDataStructure(stateList);

    // @type {Object<state_name,boolean>}, allows to know whether a state has a init transition defined
    let is_init_state = {};
    // @type {Object<state_name,boolean>}, allows to know whether a state has an automatic transition defined
    // that would be init transitions + eventless transitions
    let is_auto_state = {};
    // @type {Object<state_name,boolean>}, allows to know whether a state is a group of state or not
    const is_group_state = hash_states_struct.is_group_state;
    let hash_states = hash_states_struct.hash_states;

    transitions.forEach(function (transition) {
        let {from, to, action, event, guards: arr_predicate} = transition;
        // CASE : ZERO OR ONE condition set
        if (!arr_predicate)
            arr_predicate = [{predicate: alwaysTrue, to: to, action: action}];

        // CASE : transition has a init event
        // NOTE : there should ever only be one, but we don't enforce it here
        if (event === INIT_EVENT) {
            is_init_state[from] = true;
        }

        let from_proto = hash_states[from];

        // ERROR CASE : state found in transition but cannot be found in the events passed as parameter
        // NOTE : this is probably all what we need the events variable for
        if (event && !(event in _events))
            throw `unknown event ${event} found in state machine definition!`;
        // CASE : automatic transitions : no events - likely a transient state with only conditions
        if (!event) {
            event = AUTO_EVENT;
            is_auto_state[from] = true;
        }
        // CASE : automatic transitions : init event automatically fired upon entering a grouping state
        if (is_group_state[from] && is_init_state[from]) {
            is_auto_state[from] = true;
        }

        // TODO : this seriously needs refactoring, that is one line in ramda
        from_proto[event] = arr_predicate.reduce((acc, guard, index) => {
                const action = guard.action || ACTION_IDENTITY;
                const actionName = action.name || action.displayName;
                const condition_checking_fn = (function (guard, settings) {
                    let condition_suffix = "";
                    // We add the `current_state` because the current control state might be different from
                    // the `from` field here This is the case for instance when we are in a substate, but
                    // through prototypal inheritance it is the handler of the prototype which is called
                    const condition_checking_fn = function (extendedState_, event_data, current_state) {
                        from = current_state || from;
                        const isGuardedTransition = guard.predicate;
                        const predicate = isGuardedTransition || alwaysTrue;
                        const shouldTransitionBeTaken =
                            !isGuardedTransition
                            || tryCatchMachineFn(
                            PREDICATE_DESC, predicate, ['extendedState', 'eventData', 'settings']
                            )(extendedState_, event_data, settings);
                        const to = guard.to;
                        condition_suffix = predicate ? "_checking_condition_" + index : "";

                        handleFnExecError(
                            {debug, console},
                            {predicate: guard.predicate, extendedState: extendedState_, eventData: event_data, settings},
                            shouldTransitionBeTaken,
                            isBoolean,
                            notifyAndRethrow,
                            throwIfInvalidGuardResult
                        );
                        if (shouldTransitionBeTaken) {
                            // CASE : guard for transition is fulfilled so we can execute the actions...
                            console.info("IN STATE ", from);
                            isGuardedTransition && console.info(`CASE: guard ${predicate.name} for transition is fulfilled`);
                            !isGuardedTransition && console.info(`CASE: unguarded transition`);

                            console.info("THEN : we execute the action " + actionName);
                            const wrappedAction = tryCatchMachineFn(ACTION_FACTORY_DESC, action, ['extendedState', 'eventData', 'settings']);
                            const actionResultOrError = wrappedAction(extendedState_, event_data, settings);

                            handleFnExecError(
                                {debug, console},
                                {action, extendedState: extendedState_, eventData: event_data, settings},
                                actionResultOrError,
                                isActions,
                                notifyAndRethrow,
                                throwIfInvalidActionResult
                            );
                            const {updates, outputs} = actionResultOrError;

                            // Leave the current state
                            leave_state(from, extendedState_, hash_states);

                            // Update the extendedState before entering the next state
                            const extendedStateOrError = wrappedUpdateState(extendedState_, updates);
                            handleFnExecError(
                                {debug, console},
                                {updateStateFn: userProvidedUpdateStateFn, extendedState: extendedState_, updates},
                                extendedStateOrError,
                                alwaysTrue, // NOTE : could also be passed in settings with updateState, maybe in later version
                                notifyAndRethrow,
                                noop // NOTE : we do not test the return value of the update state function, cf. previous note
                            );
                            extendedState = extendedStateOrError;

                            // ...and enter the next state (can be different from `to` if we have nesting state group)
                            const next_state = enter_next_state(to, updates, hash_states);
                            console.info("ENTERING NEXT STATE: ", next_state);
                            if (isError(extendedStateOrError)) console.error("with error: ", extendedStateOrError);
                            if (!isError(extendedStateOrError)) console.info("with extended state: ", extendedState);

                            // allows for chaining and stop chaining guard
                            return {stop: true, outputs};
                        }
                        else {
                            // CASE : guard for transition is not fulfilled
                            return {stop: false, outputs: NO_OUTPUT};
                        }
                    };
                    condition_checking_fn.displayName = from + condition_suffix;
                    return condition_checking_fn;
                })(guard, settings);

                return function arr_predicate_reduce_fn(extendedState_, event_data, current_state) {
                    const condition_checked = acc(extendedState_, event_data, current_state);
                    return condition_checked.stop
                        ? condition_checked
                        : condition_checking_fn(extendedState_, event_data, current_state);
                };
            },
            function dummy() {
                return {stop: false, outputs: NO_OUTPUT};
            }
        );
    });

    function assertContract(contract, arrayParams) {
        if (!checkContracts) return void 0
        else return assert(contract, arrayParams)
    }

    function send_event(event_struct, isExternalEvent) {
        console.debug("send event", event_struct);
        assertContract(isEventStruct, [event_struct]);

        const {eventName, eventData} = destructureEvent(event_struct);
        const current_state = hash_states[INIT_STATE].current_state_name;

        // Edge case : INIT_EVENT sent and the current state is not the initial state
        // We have to do this separately, as by construction the INIT_STATE is a
        // super state of all states in the machine. Hence sending an INIT_EVENT
        // would always execute the INIT transition by prototypal delegation
        if (isExternalEvent && eventName === INIT_EVENT && current_state !== INIT_STATE) {
            console.warn(`The external event INIT_EVENT can only be sent when starting the machine!`)

            return NO_OUTPUT
        }

        const outputs = process_event(
            hash_states_struct.hash_states,
            eventName,
            eventData,
            extendedState
        );

        return outputs
    }

    function process_event(hash_states, event, event_data, extendedState) {
        const current_state = hash_states[INIT_STATE].current_state_name;
        const event_handler = hash_states[current_state][event];

        if (event_handler) {
            // CASE : There is a transition associated to that event
            console.log("found event handler!");
            console.info("WHEN EVENT ", event, event_data);
            /* OUT : this event handler modifies the extendedState and possibly other data structures */
            const {stop, outputs: rawOutputs} = event_handler(extendedState, event_data, current_state);
            debug && !stop && console.warn("No guards have been fulfilled! We recommend to configure guards explicitly to" +
                " cover the full state space!")
            const outputs = arrayizeOutput(rawOutputs);

            // we read it anew as the execution of the event handler may have changed it
            const new_current_state = hash_states[INIT_STATE].current_state_name;

            // Two cases here:
            // 1. Init handlers, when present on the current state, must be acted on immediately
            // This allows for sequence of init events in various state levels
            // For instance, L1: init -> L2:init -> L3:init -> L4: stateX
            // In this case event_data will carry on the data passed on from the last event (else we loose
            // the extendedState?)
            // 2. transitions with no events associated, only conditions (i.e. transient states)
            // NOTE : the guard is to defend against loops occuring when an AUTO transition fails to advance and stays
            // in the same control state!! But by contract that should never happen : all AUTO transitions should advance!
            // TODO : test that case, what is happening? I should add a branch and throw!!
            if (is_auto_state[new_current_state] && new_current_state !== current_state) {
                // CASE : transient state with no triggering event, just conditions
                // automatic transitions = transitions without events
                const auto_event = is_init_state[new_current_state]
                    ? INIT_EVENT
                    : AUTO_EVENT;
                return [].concat(outputs).concat(send_event({[auto_event]: event_data}, false));
            } else return outputs;
        } else {
            // CASE : There is no transition associated to that event from that state
            console.warn(`There is no transition associated to the event |${event}| in state |${current_state}|!`);

            return NO_OUTPUT;
        }
    }

    function leave_state(from, extendedState, hash_states) {
        // NOTE : extendedState is passed as a parameter for symetry reasons, no real use for it so far
        const state_from = hash_states[from];
        const state_from_name = state_from.name;

        history = updateHistory(history, stateAncestors, state_from_name);

        console.info("left state", wrap(from));
    }

    function enter_next_state(to, updatedExtendedState, hash_states) {
        let state_to;
        let state_to_name;
        // CASE : history state (H)
        if (isHistoryControlState(to)) {
            const history_type = to.deep ? DEEP : to.shallow ? SHALLOW : void 0;
            const history_target = to[history_type];
            // Edge case : history state (H) && no history (i.e. first time state is entered), target state
            // is the entered state
            // TODO: edge case should be init state for compound state, and check it is recursively descended,
            // and error if the history target is an atomic state
            // if (!is_auto_state(history_target)) throw `can't be atomic state`
            // then by setting the compound state, it should evolve toward to init control state naturally
            debug && console && !is_init_state[history_target] && console.warn(`Configured a history state which does not relate to a compound state! The behaviour of the machine is thus unspecified. Please review your machine configuration`);
            state_to_name = history[history_type][history_target] || history_target;
            state_to = hash_states[state_to_name];
        }
        else if (to) {
            // CASE : normal state
            state_to = hash_states[to];
            state_to_name = state_to.name;
        } else {
            throw "enter_state : unknown case! Not a state name, and not a history state to enter!";
        }
        hash_states[INIT_STATE].current_state_name = state_to_name;

        debug && console.info("AND TRANSITION TO STATE", state_to_name);
        return state_to_name;
    }

    function start() {
        return send_event({[INIT_EVENT]: initialExtendedState}, true);
    }

    start();

    // NOTE : yield is a reserved JavaScript word so using yyield
    return function yyield(x) {
        const outputs = send_event(x, true);
        debug && console.info("OUTPUTS:", outputs);

        return outputs
    }
}

/**
 *
 * @param {WebComponentName} name name for the web component. Must include at least one hyphen per custom
 * components' specification
 * @param {Subject} eventHandler A factory function which returns a subject, i.e. an object which
 * implements the `Observer` and `Observable` interface
 * @param {FSM} fsm An executable machine, i.e. a function which accepts machine inputs
 * @param {Object.<CommandName, CommandHandler>} commandHandlers
 * @param {*} effectHandlers Typically anything necessary to perform effects. Usually this is a hashmap mapping an effect moniker to a function performing the corresponding effect.
 * @param {{initialEvent, terminalEvent, NO_ACTION}} options
 */
export function makeWebComponentFromFsm({name, eventHandler, fsm, commandHandlers, effectHandlers, options}) {
    class FsmComponent extends HTMLElement {
        constructor() {
            if (name.split('-').length <= 1) throw `makeWebComponentFromFsm : web component's name MUST include a dash! Please review the name property passed as parameter to the function!`
            super();
            const el = this;
            this.eventSubject = eventHandler;
            this.options = Object.assign({}, options);
            const NO_ACTION = this.options.NO_ACTION || NO_OUTPUT;

            // Set up execution of commands
            this.eventSubject.subscribe({
                next: eventStruct => {
                    const actions = fsm(eventStruct);

                    if (actions === NO_ACTION) return;
                    actions.forEach(action => {
                        if (action === NO_ACTION) return;
                        const {command, params} = action;
                        commandHandlers[command](this.eventSubject.next, params, effectHandlers, el);
                    });
                }
            });
        }

        static get observedAttributes() {
            return [];
        }

        connectedCallback() {
            this.options.initialEvent && this.eventSubject.next(this.options.initialEvent);
        }

        disconnectedCallback() {
            this.options.terminalEvent && this.eventSubject.next(this.options.terminalEvent);
            this.eventSubject.complete();
        }

        attributeChangedCallback(name, oldValue, newValue) {
            // simulate a new creation every time an attribute is changed
            // i.e. they are not expected to change
            this.constructor();
            this.connectedCallback();
        }
    }

    return customElements.define(name, FsmComponent);
}

/**
 * Adds a `displayName` property corresponding to the action name to all given action factories. The idea is to use
 * the action name in some specific useful contexts (debugging, tracing, visualizing)
 * @param {Object.<string, function>} namedActionSpecs Maps an action name to an action factory
 */
export function makeNamedActionsFactory(namedActionSpecs) {
    return Object.keys(namedActionSpecs).reduce((acc, actionName) => {
        const actionFactory = namedActionSpecs[actionName];
        actionFactory.displayName = actionName;
        acc[actionName] = actionFactory;

        return acc;
    }, {});
}

/**
 * This function works to merge outputs by simple concatenation and flattening
 * Every action return T or [T], and we want in output [T] always
 * mergeOutputsFn([a, [b]) = mergeOutputsFn([a,b]) = mergeOutputsFn([[a],b) = mergeOutputsFn([[a],[b]]) = [a,b]
 * If we wanted to pass [a] as value we would have to do mergeOutputsFn([[[a]],[b]]) to get [[a],b]
 * @param arrayOutputs
 * @returns {*}
 */
export function mergeOutputsFn(arrayOutputs) {
    // NOTE : here, this array of outputs could be array x non-array ^n
    // The algorithm is to concat all elements
    return arrayOutputs.reduce((acc, element) => acc.concat(element), [])
}

/**
 * @param  {FSM_Def} fsmDef
 * @param  {Object.<ControlState, function>} entryActions Adds an action to be processed when entering a given state
 * @param {function (Array<MachineOutput>) : MachineOutput} mergeOutputs monoidal merge (pure) function
 * to be provided to instruct how to combine machine outputs. Beware that the second output corresponds to the entry
 * action output which must logically correspond to a processing as if it were posterior to the first output. In
 * many cases, that will mean that the second machine output has to be 'last', whatever that means for the monoid
 * and application in question
 */
export function decorateWithEntryActions(fsmDef, entryActions, mergeOutputs) {
    if (!entryActions) return fsmDef

    const {transitions, states, initialExtendedState, initialControlState, events, updateState, settings} = fsmDef;
    const stateHashMap = getFsmStateList(states);
    const isValidEntryActions = Object.keys(entryActions).every(controlState => {
        return stateHashMap[controlState] != null;
    });
    const mergeOutputFn = mergeOutputs || mergeOutputsFn

    if (!isValidEntryActions) {
        throw `decorateWithEntryActions : found control states for which entry actions are defined, and yet do not exist in the state machine!`;
    } else {
        const decoratedTransitions = mapOverTransitionsActions((action, transition, guardIndex, transitionIndex) => {
            const {to} = transition;
            const entryAction = entryActions[to];
            const decoratedAction = entryAction
                ? decorateWithExitAction(action, entryAction, mergeOutputFn, updateState)
                : action;

            return decoratedAction
        }, transitions);

        return {
            initialExtendedState,
            initialControlState,
            states,
            events,
            transitions: decoratedTransitions,
            updateState,
            settings
        }
    }
}

/**
 *
 * @param {ActionFactory} action action factory which may be associated to a display name
 * @param {ActionFactory} entryAction
 * @param {function (Array<MachineOutput>) : MachineOutput} mergeOutputFn monoidal merge function. Cf.
 *   decorateWithEntryActions
 * @param updateState
 * @return {decoratedAction}
 */
function decorateWithExitAction(action, entryAction, mergeOutputFn, updateState) {
    // NOTE : An entry action is modelized by an exit action, i.e. an action which will be processed last after any
    // others which apply. Because in the transducer semantics there is nothing happening after the transition is
    // processed, or to express it differently, transition and state entry are simultaneous, this modelization is
    // accurate.
    // DOC : entry actions for a control state will apply before any automatic event related to that state! In fact before
    // anything. That means the automatic event should logically receive the state updated by the entry action
    const decoratedAction = function (extendedState, eventData, settings) {
        const {debug} = settings;
        const wrappedEntryAction = tryCatchMachineFn(ENTRY_ACTION_FACTORY_DESC, entryAction, ['extendedState', 'eventData', 'settings']);
        const actionResult = action(extendedState, eventData, settings);
        const actionUpdate = actionResult.updates;

        const wrappedUpdateState = tryCatchMachineFn(UPDATE_STATE_FN_DESC, updateState, ['extendedState, updates']);
        const updatedExtendedStateOrError = wrappedUpdateState(extendedState, actionUpdate);

        // TODO : test that case
        handleFnExecError(
            {debug, console},
            {updateStateFn: updateState, extendedState, actionUpdate},
            updatedExtendedStateOrError,
            alwaysTrue, // NOTE : could also be passed in settings with updateState, maybe in later version
            notifyAndRethrow,
            noop // NOTE : we do not test the return value of the update state function, cf. previous note
        );
        const updatedExtendedState = updatedExtendedStateOrError;

        const exitActionResultOrError = wrappedEntryAction(updatedExtendedState, eventData, settings);

        const isExitActionResultError = handleFnExecError(
            {debug, console},
            {action: entryAction, extendedState: updatedExtendedState, eventData, settings},
            exitActionResultOrError,
            isActions,
            notifyAndRethrow,
            throwIfInvalidEntryActionResult
        );

        if (!isExitActionResultError) {
            // NOTE : exitActionResult comes last as we want it to have priority over other actions.
            // As a matter of fact, it is an exit action, so it must always happen on exiting, no matter what
            //
            // ADR :  Beware of the fact that as a result it could overwrite previous actions. In principle exit actions
            // should add to existing actions, not overwrite. Because exit actions are not represented on the machine
            // visualization, having exit actions which overwrite other actions might make it hard to reason about the
            // visualization. We choose however to not forbid the overwrite by contract. But beware. ROADMAP : the best is,
            // according to semantics, to actually send both separately
            return {
                updates: [].concat(actionUpdate, exitActionResultOrError.updates),
                outputs: mergeOutputFn([actionResult.outputs, exitActionResultOrError.outputs])
            };
        }
    };
    decoratedAction.displayName = `Entry_Action_After_${getFunctionName(action)}`;

    return decoratedAction;
}

/**
 * This function converts a state machine `A` into a traced state machine `T(A)`. The traced state machine, on
 * receiving an input `I` outputs the following information :
 * - `outputs` : the outputs `A.yield(I)`
 * - `updates` : the update of the extended state of `A` to be performed as a consequence of receiving the
 * input `I`
 * - `extendedState` : the extended state of `A` prior to receiving the input `I`
 * - `controlState` : the control state in which the machine is when receiving the input `I`
 * - `event::{eventLabel, eventData}` : the event label and event data corresponding to `I`
 * - `settings` : settings passed at construction time to `A`
 * - `targetControlState` : the target control state the machine has transitioned to as a consequence of receiving
 * the input `I`
 * - `predicate` : the predicate (guard) corresponding to the transition that was taken to `targetControlState`, as
 * a consequence of receiving the input `I`
 * - `actionFactory` : the `actionFactory` which was executed as a consequence of receiving the input `I`
 *  Note that the trace functionality is obtained by wrapping over the action factories in `A`. As such, all action
 *  factories will see their output wrapped. However, transitions which do not lead to the execution of action
 *  factories are not traced.
 * @param {*} env
 * @param {FSM_Def} fsm
 */
export function traceFSM(env, fsm) {
    const {initialExtendedState, initialControlState, events, states, transitions, updateState} = fsm;

    return {
        initialExtendedState,
        initialControlState,
        events,
        states,
        updateState,
        transitions: mapOverTransitionsActions((action, transition, guardIndex, transitionIndex) => {
            return function (extendedState, eventData, settings) {
                const {from: controlState, event: eventLabel, to: targetControlState, predicate} = transition;
                const wrappedAction = tryCatchMachineFn(ACTION_FACTORY_DESC, action, ['extendedState', 'eventData', 'settings']);
                const actionResultOrError = wrappedAction(extendedState, eventData, settings);
                const {outputs, updates} = actionResultOrError;
                const wrappedUpdateState = tryCatchMachineFn(UPDATE_STATE_FN_DESC, updateState, ['extendedState, updates']);

                return {
                    updates,
                    outputs: [{
                        outputs,
                        updates,
                        extendedState: extendedState,
                        // NOTE : I can do this because pure function!! This is the extended state after taking the transition
                        newExtendedState: wrappedUpdateState(extendedState, updates || []),
                        controlState,
                        event: {eventLabel, eventData},
                        settings: settings,
                        targetControlState,
                        predicate,
                        actionFactory: action,
                        guardIndex,
                        transitionIndex
                    }],
                }
            }
        }, transitions)
    }
}

/**
 * Construct history states `hs` from a list of states for a given state machine. The history states for a given control
 * state can then be referenced as follows :
 * - `hs.shallow(state)` will be the shallow history state associated to the `state`
 * - `hs.deep(state)` will be the deep history state associated to the `state`
 * @param {FSM_States} states
 * @return {HistoryStateFactory}
 */
export function makeHistoryStates(states) {
    const stateList = Object.keys(getFsmStateList(states));
    // used for referential equality comparison to discriminate history type

    return (historyType, controlState) => {
        if (!stateList.includes(controlState)) {
            throw `makeHistoryStates: the state for which a history state must be constructed is not a configured state for the state machine under implementation!!`
        }

        return {
            [historyType]: controlState,
            type: history_symbol
        }
    }
}

export function historyState(historyType, controlState) {
    return {
        [historyType]: controlState
    }
}
