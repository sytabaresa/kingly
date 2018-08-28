// DOC
// CONTRACT : no transition from the history state (history state is only a target state)
// CONTRACT : init events only acceptable in nesting state (aka grouping state)
// NOTE : enforced via in_auto_state only true for grouping state
// CONTRACT : Automatic actions with no events and only conditions are not allowed in nesting state
// (aka grouping state)
// NOTE : That would lead to non-determinism if A < B < C and both A and B
// have such automatic actions CONTRACT : There MUST be an action in each transition
// NOTE : Dead states: - Possible if automatic actions (no events) with conditions always true.
// If there is not another condition which at some point is set to false, we have an infinite
// loop (a very real one which could monopolize the CPU if all actions are synchronous) - To
// break out of it, maybe put a guard that if we remain in the same state for X steps,
// transition automatically (to error or else)

import {
  ACTION_IDENTITY, AUTO_EVENT, DEEP, history_symbol, INIT_EVENT, INIT_STATE, NO_OUTPUT, SHALLOW, STATE_PROTOTYPE_NAME
} from "./properties";
import {
  arrayizeOutput, computeHistoryMaps, get_fn_name, getFsmStateList, keys, mapOverTransitionsActions, wrap
} from "./helpers";

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
  array_identifiers = array_identifiers.reduce
    ? array_identifiers
    : Array.prototype.slice.call(arguments);
  // NOTE : That will overwrite any other event called init...
  array_identifiers.push(INIT_EVENT);
  return array_identifiers.reduce(function (acc, identifier) {
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
 * - Holds an `active` property which is not so useful so far, and which signal whether the state
 * is active (current) or not
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
  states = { nok: states };

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
      hash_states[state_name].active = false;

      if (typeof state_config === "object") {
        is_group_state[state_name] = true;
        const curr_constructor_new = function () {};
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
  let states_enum = { history: {} };

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

/**
 *
 * @param {{updateHistory: function(*=): *, [p: string]: *}} history Contains deep history and shallow history for all
 * control states, except the INIT_STATE (not that the concept has no value for atomic state). The function
 * `updateHistory` allows to update the history as transitions occur in the state machine.
 * @param {Object.<ControlState, *>} control_states
 * @returns {{updateHistory: function(*=): *, [p: string]: *}}
 */
export function updateHistory(history, stateAncestors, state_from_name) {
  // Edge case, we start with INIT_STATE but that is not kept in the history (no transition to it!!)

  if (state_from_name === INIT_STATE) {
    return history
  }
  else {
    [SHALLOW, DEEP].forEach(historyType => {
      // ancestors for the state which is exited
      const ancestors = stateAncestors[historyType][state_from_name] || [];
      ancestors.forEach(ancestor => {
        // set the exited state in the history of all ancestors
        history[historyType][ancestor] = state_from_name
      });
    });

    return history
  }
}

/**
 * Creates an instance of state machine from a set of states, transitions, and accepted events. The initial
 * extended state for the machine is included in the machine definition.
 * @param {FSM_Def} fsmDef
 * @param {{updateModel : (function (FSM_Model, *) : FSM_Model), ...}} settings Contains the subject factory as
 * mandatory settings,
 * and any other. The `merge` settings is mandatory only when using the streaming state machine functionality
 * extra settings the API user wants to make available in state machine's scope
 * @returns {{yield : Function, start: Function}}
 */
export function create_state_machine(fsmDef, settings) {
  const {
    states: control_states,
    events,
    transitions,
    initial_extended_state
  } = fsmDef;
  const { updateModel } = settings;

  const _events = build_event_enum(events);

  // Create the nested hierarchical
  const hash_states_struct = build_nested_state_structure(control_states);

  // This will be the model object which will be updated by all actions and on which conditions
  // will be evaluated It is safely contained in a closure so it cannot be accessed in any way
  // outside the state machine.
  // Note the model is modified by the `settings.updateModel` function, which should not modify
  // the model. There is hence no need to do any cloning.
  let model = initial_extended_state;
  // history maps

  const { stateList, stateAncestors } = computeHistoryMaps(control_states);
  // NOTE : we update history in place, so we need two different objects here, even
  // when they start with the same value
  const initHistory = () => stateList.reduce((acc, state) => (acc[state] = '', acc), {});
  let history = { [DEEP]: initHistory(), [SHALLOW]: initHistory() };

  // @type {Object<state_name,boolean>}, allows to know whether a state has a init transition defined
  let is_init_state = {};
  // @type {Object<state_name,boolean>}, allows to know whether a state has an automatic transition defined
  let is_auto_state = {};
  // @type {Object<state_name,boolean>}, allows to know whether a state is a group of state or not
  const is_group_state = hash_states_struct.is_group_state;
  let hash_states = hash_states_struct.hash_states;

  transitions.forEach(function (transition) {
    console.log("processing transition:", transition);
    let { from, to, action, event, guards: arr_predicate } = transition;
    // CASE : ZERO OR ONE condition set
    if (!arr_predicate)
      arr_predicate = [{ predicate: arr_predicate, to: to, action: action }];

    // CASE : transition has a init event
    // NOTE : there should ever only be one, but we don't enforce it for now
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

    console.log("This is transition for event:", event);
    console.log("Predicates:", arr_predicate);

    from_proto[event] = arr_predicate.reduce(
      function (acc, guard, index) {
        let action = guard.action;
        if (!action) {
          action = ACTION_IDENTITY
        }
        console.log("Guard:", guard);
        const condition_checking_fn = (function (guard, settings) {
          let condition_suffix = "";
          // We add the `current_state` because the current state might be different from the `from`
          // field here This is the case for instance when we are in a substate, but through
          // prototypal inheritance it is the handler of the prototype which is called
          const condition_checking_fn = function (
            model_,
            event_data,
            current_state
          ) {
            from = current_state || from;
            const { predicate, to } = guard;
            condition_suffix = predicate ? "_checking_condition_" + index : "";

            if (!predicate || predicate(model_, event_data, settings)) {
              // CASE : guard for transition is fulfilled so we can execute the actions...
              console.info("IN STATE ", from);
              console.info("WITH model, event data, settings BEING ", model_, event_data, settings);
              console.info("CASE : " + (predicate ? "guard " + predicate.name + "for transition is fulfilled" : "automatic transition"));
              // CASE : we do have some actions to execute
              console.info("THEN : we execute the action " + action.name);
              // NOTE : in a further extension, passing the fsm and the events object could help
              // in implementing asynchronous fsm
              const actionResult = action(model_, event_data, settings);

              // Leave the current state
              leave_state(from, model_, hash_states);

              // Update the model before entering the next state
              model = updateModel(model_, actionResult.model_update);
              // Emit the new model event
              // new_model_event_emitter.onNext(model);
              console.info("RESULTING IN UPDATED MODEL : ", model);
              console.info("RESULTING IN OUTPUT : ", actionResult.outputs);

              // ...and enter the next state (can be different from to if we have nesting state group)
              const next_state = enter_next_state(to, actionResult.model_update, hash_states);
              console.info("ENTERING NEXT STATE : ", next_state);

              return { stop: true, outputs: actionResult.outputs }; // allows for chaining and stop
              // chaining guard
            } else {
              // CASE : guard for transition is not fulfilled
              console.log("CASE : " + (predicate ? "guard " + predicate.name + " for transition NOT fulfilled..." : "no predicate"));
              return { stop: false, outputs: NO_OUTPUT };
            }
          };
          condition_checking_fn.displayName = from + condition_suffix;
          return condition_checking_fn;
        })(guard, settings);

        return function arr_predicate_reduce_fn(
          model_,
          event_data,
          current_state
        ) {
          const condition_checked = acc(model_, event_data, current_state);
          return condition_checked.stop
            ? condition_checked
            : condition_checking_fn(model_, event_data, current_state);
        };
      },
      function dummy() {
        return { stop: false, outputs: NO_OUTPUT };
      }
    );
  });

  function send_event(event_struct) {
    console.log("send event", event_struct);
    const event_name = keys(event_struct)[0];
    const event_data = event_struct[event_name];

    return process_event(
      hash_states_struct.hash_states,
      event_name,
      event_data,
      model
    );
  }

  function process_event(hash_states, event, event_data, model) {
    console.log("Processing event ", event, event_data);
    const current_state = hash_states[INIT_STATE].current_state_name;
    const event_handler = hash_states[current_state][event];

    if (event_handler) {
      // CASE : There is a transition associated to that event
      console.log("found event handler!");
      console.info("WHEN EVENT ", event);
      /* OUT : this event handler modifies the model and possibly other data structures */
      const outputs = arrayizeOutput(event_handler(model, event_data, current_state).outputs);

      // we read it anew as the execution of the event handler may have changed it
      const new_current_state = hash_states[INIT_STATE].current_state_name;

      // Two cases here:
      // 1. Init handlers, when present on the current state, must be acted on immediately
      // This allows for sequence of init events in various state levels
      // For instance, L1: init -> L2:init -> L3:init -> L4: stateX
      // In this case event_data will carry on the data passed on from the last event (else we loose
      // the model?)
      // 2. transitions with no events associated, only conditions (i.e. transient states)
      // In this case, there is no need for event data
      // NOTE : the guard is to defend against loops occuring when an AUTO transition fails to advance and stays
      // in the same control state!! But by contract that should never happen : all AUTO transitions should advance!
      if (is_auto_state[new_current_state] && new_current_state !== current_state) {
        // CASE : transient state with no triggering event, just conditions
        // automatic transitions = transitions without events
        const auto_event = is_init_state[new_current_state]
          ? INIT_EVENT
          : AUTO_EVENT;
        return [].concat(outputs).concat(send_event({ [auto_event]: event_data }));
      } else return outputs;
    } else {
      // CASE : There is no transition associated to that event from that state
      console.error(`There is no transition associated to that event!`);

      return NO_OUTPUT;
    }
  }

  function leave_state(from, model, hash_states) {
    // NOTE : model is passed as a parameter for symetry reasons, no real use for it so far
    const state_from = hash_states[from];
    const state_from_name = state_from.name;

    history = updateHistory(history, stateAncestors, state_from_name);

    state_from.active = false;
    console.log("left state", wrap(from));
  }

  function enter_next_state(to, model_prime, hash_states) {
    let state_to;
    let state_to_name;
    // CASE : history state (H)
    if (typeof to === "object" && to.type === history_symbol) {
      debugger
      const history_type = to.deep ? DEEP : to.shallow ? SHALLOW : void 0;
      const history_target = to[history_type];
      // Edge case : history state (H) && no history (i.e. first time state is entered), target state
      // is the entered state
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
    state_to.active = true;
    hash_states[INIT_STATE].current_state_name = state_to_name;

    console.info("AND TRANSITION TO STATE", state_to_name);
    return state_to_name;
  }

  function start() {
    return send_event({ [INIT_EVENT]: initial_extended_state });
  }

  return {
    yield: send_event,
    start: start
  };
}

/**
 *
 * @param {{subject_factory: Function, merge: Function, of:Function}} settings Contains the `merge` property as
 * mandatory
 * @param {FSM_Def} fsmDef
 * settings. That merge function must take an array of observables and return an observable.
 * Otherwise can also hold extra settings the API user wants to make available in state machine's scope
 * @returns {function(Object<String, Rx.Observable>): *}
 */
export function makeStreamingStateMachine(settings, fsmDef) {
  const fsm = create_state_machine(fsmDef, settings);
  const merge = settings && settings.merge;
  const of = settings && settings.of;
  if (!merge || !of)
    throw `makeStreamingStateMachine : could not find an observable merge or of functions ! use Rx??`;

  /**
   * @param {Object.<Event_Label, Rx.Observable>} events A mapping of event labels to the corresponding event sources
   * @returns {Rx.Observable} Returns an observable containing the actions emitted by the state machine in response
   * to the specified input events
   */
  const computeActions = function computeActions(events) {
    return merge(
      // Contract : the `merge` function must subscribe to its source parameters in order of appearance
      // This ensures that the init event is indeed processed always before the other events
      [of({ [INIT_EVENT]: fsmDef.initial_extended_state })].concat(
        keys(events).map(eventLabel => {
          const eventSource$ = events[eventLabel];

          return eventSource$.map(eventData => ({ [eventLabel]: eventData }));
        })
      )
    )
      .map(fsm.yield)
      .filter(outputs => outputs !== NO_OUTPUT)
      // TODO : check scheduling : we want all outputs (=actions) passed synchronously if possible
      // NOTE : Rxjs : https://github.com/ReactiveX/rxjs/blob/master/doc/scheduler.md
      // By not passing any scheduler, notifications are delivered synchronously and recursively.
      // DOC : settings.of should emit synchronously and recursively
      .flatMap(outputs => of(outputs))
      .filter(output => output !== NO_OUTPUT)
      .share();
  };
  // TODO : rewrite this to avoid using merge, map, filter and flatMap: use a subject/event emitter basically
  // that ensures synchronicity. All operators can be flattened in one long function

  return computeActions;
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
 * @param  {FSM_Def} fsm
 * @param  {Object.<string, function>} entryActions Adds an action to be processed when entering a given state
 * @param {function (Array<MachineOutput>) : MachineOutput} mergeOutputFn monoidal merge (pure) function
 * to be provided to instruct how to combine machine outputs. Beware that the second output corresponds to the entry
 * action output which must logically correspond to a processing as if it were posterior to the first output. In
 * many cases, that will mean that the second machine output has to be 'last', whatever that means for the monoid
 * and application in question
 */
export function decorateWithEntryActions(fsm, entryActions, mergeOutputFn) {
  const { transitions, states, initial_extended_state, events } = fsm;
  const stateHashMap = getFsmStateList(states);
  const isValidEntryActions = Object.keys(entryActions).every(controlState => {
    return stateHashMap[controlState] != null;
  });

  if (!isValidEntryActions) {
    throw `decorateWithEntryActions : found control states for which entry actions are defined, and yet do not exist in the state machine!`;
  } else {
    // TODO : use mapOverActionTransition helper
    const decoratedTransitions = transitions.map(transitionRecord => {
      const { from, event, guards } = transitionRecord;

      return {
        from,
        event,
        guards: guards.map(transitionGuard => {
          const { predicate, to, action } = transitionGuard;
          const entryAction = entryActions[to];

          return {
            predicate,
            to,
            action: entryAction
              ? decorateWithExitAction(action, entryAction, mergeOutputFn)
              : action
          };
        })
      };
    });

    return {
      initial_extended_state,
      states,
      events,
      transitions: decoratedTransitions
    }
  }
}

/**
 *
 * @param {ActionFactory} action action factory which may be associated to a display name
 * @param {ActionFactory} entryAction
 * @param {function (Array<MachineOutput>) : MachineOutput} mergeOutputFn monoidal merge function. Cf.
 *   decorateWithEntryActions
 * @return ActionFactory
 */
function decorateWithExitAction(action, entryAction, mergeOutputFn) {
  // NOTE : An entry action is modelized by an exit action, i.e. an action which will be processed last after any
  // others which apply. Because in the transducer semantics there is nothing happening after the transition is
  // processed, or to express it differently, transition and state entry are simultaneous, this modelization is
  // accurate.
  // DOC : entry actions for a control state will apply before any automatic event related to that state! In fact before
  // anything. That means the automatic event should logically receive the state updated by the entry action
  const decoratedAction = function (model, eventData, settings) {
    const actionResult = action(model, eventData, settings);
    const actionUpdate = actionResult.model_update;
    const updatedModel = applyUpdateOperations(model, actionUpdate);
    const exitActionResult = entryAction(updatedModel, eventData, settings);

    // NOTE : exitActionResult comes last as we want it to have priority over other actions.
    // As a matter of fact, it is an exit action, so it must always happen on exiting, no matter what
    //
    // ADR :  Beware of the fact that as a result it could overwrite previous actions. In principle exit actions should
    //        add to existing actions, not overwrite. Because exit actions are not represented on the machine
    //        visualization, having exit actions which overwrite other actions might make it hard to reason about the
    //        visualization. We choose however to not forbid the overwrite by contract. But beware.
    // ROADMAP : the best is, according to semantics, to actually send both separately
    return {
      model_update: [].concat(
        actionUpdate || [],
        exitActionResult.model_update || []
      ),
      outputs: mergeOutputFn([actionResult.outputs, exitActionResult.outputs])
    };
  };
  decoratedAction.displayName = action.displayName;

  return decoratedAction;
}

/**
 * This function converts a state machine `A` into a traced state machine `T(A)`. The traced state machine, on
 * receiving an input `I` outputs the following information :
 * - `outputs` : the outputs `A.yield(I)`
 * - `model_update` : the update of the extended state of `A` to be performed as a consequence of receiving the
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
 * @param {*} settings
 * @param {FSM_Def} fsm
 */
export function traceFSM(settings, fsm) {
  const { initial_extended_state, events, states, transitions } = fsm;

  return {
    initial_extended_state,
    events,
    states,
    transitions: mapOverTransitionsActions((action, transition, guardIndex, transitionIndex) => {
      return function (model, eventData, settings) {
        const { from: controlState, event: eventLabel, to: targetControlState, predicate } = transition;
        const actionResult = action(model, eventData, settings);
        const { outputs, model_update } = actionResult;
        const { updateModel } = settings;

        return {
          model_update,
          outputs: {
            outputs,
            model_update,
            extendedState: model,
            // NOTE : I can do this because pure function!! This is the extended state after taking the transition
            newExtendedState: updateModel(model, model_update || []),
            controlState,
            event: { eventLabel, eventData },
            settings: settings,
            targetControlState,
            predicate,
            actionFactory: action,
            guardIndex,
            transitionIndex
          },
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
 * @param {Object.<ControlState, *>} states
 */
export function makeHistoryStates(states) {
  const stateList = Object.keys(getFsmStateList(states));
  // used for referential equality comparison to discriminate history type

  return {
    shallow: state => {
      if (!stateList.includes(state)) {
        throw `makeHistoryStates: the state for which a history state must be constructed is not a configured state for the state machine under implementation!!`
      }

      return {
        [SHALLOW]: state,
        type: history_symbol
      }
    },
    deep: state => {
      if (!stateList.includes(state)) {
        throw `makeHistoryStates: the state for which a history state must be constructed is not a configured state for the state machine under implementation!!`
      }

      return {
        [DEEP]: state,
        type: history_symbol
      }
    }
  }
}

// TODO DOC: beware not to modify settings, it is passed by reference and not cloned!!
// TODO DOC: explain hierarchy, initial events, auto events, and other contracts
// TODO DOC: document the obs merge settings (+filter necessary on prototype)
