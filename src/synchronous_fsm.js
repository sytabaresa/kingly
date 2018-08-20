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

// TODO : add a null event notion. If a null input is received return a null output, taht means no event
// TODO : in streaming, ignore automatically null events. We don't have a choice but to return null output in the
// normal autoamta. However null could be a valid return, so using a NULL_OUTPUT variable or SYMBOL??!!  We
// basically simulate a Maybe Input -> Maybe Output
// TODO : as a isActualOutput function to discriminate out the Maybe

import { ACTION_IDENTITY, AUTO_EVENT, INIT_EVENT, INIT_STATE, NO_OUTPUT, STATE_PROTOTYPE_NAME } from "./properties";
import { applyUpdateOperations, get_fn_name, keys, mapOverActions, wrap } from "./helpers";
import { objectTreeLenses, PRE_ORDER, traverseObj } from "fp-rosetree";

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
 * @param event_emitter_factory
 * @returns {{hash_states: {}, is_group_state: {}}}
 */
function build_nested_state_structure(states, event_emitter_factory) {
  const root_name = "State";
  const last_seen_state_event_emitter = event_emitter_factory();
  let hash_states = {};
  let last_seen_state_listener_disposables = [];
  let is_group_state = {};

  // Add the starting state
  states = { nok: states };

  ////////
  // Helper functions
  function add_last_seen_state_listener(child_name, parent_name) {
    last_seen_state_listener_disposables.push(
      last_seen_state_event_emitter.subscribe(function (x) {
        const event_emitter_name = x.event_emitter_name;
        const last_seen_state_name = x.last_seen_state_name;
        if (event_emitter_name === child_name) {
          console.log(
            [
              "last seen state set to",
              wrap(last_seen_state_name),
              "in",
              wrap(parent_name)
            ].join(" ")
          );
          hash_states[
            parent_name
            ].history.last_seen_state = last_seen_state_name;
        }
      })
    );
  }

  function build_state_reducer(states, curr_constructor) {
    keys(states).forEach(function (state_name) {
      const state_config = states[state_name];
      let curr_constructor_new;

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
      hash_states[state_name].history = { last_seen_state: null };
      hash_states[state_name].active = false;

      // Set up the listeners for propagating the last seen state up the prototypal chain
      // Prototypal inheritance only works in one direction, we need to implement the other
      // direction by hand if A < B < C is a state hierarchy, to implement correctly the history
      // mechanism, we need the last seen state to be the same throughout the whole hierarchy.
      // Prototypal inheritance does not help here as it works in the opposite direction. So we
      // resort to an event emitter (here an RxJS subject) which connect C and B, B and A. When
      // state C is abandoned, then it updates it `last_seen_state` property and emits a change
      // event, B is subscribed to it, and updates its property and emits a change. A is subscribed
      // to B changes, so that the change event is propagated recursively up the hierarchy. This is
      // a reactive mechanim which is simpler that the interactive one where you adjust the whole
      // hierarchy when state C is abandoned.
      add_last_seen_state_listener(state_name, parent_name);

      if (typeof state_config === "object") {
        is_group_state[state_name] = true;
        eval(["curr_constructor_new = function", state_name, "(){}"].join(" "));
        curr_constructor_new.displayName = state_name;
        curr_constructor_new.prototype = hash_states[state_name];
        build_state_reducer(state_config, curr_constructor_new);
      }
    });
  }

  function State() {
    this.history = { last_seen_state: null };
  }

  // The `emitLastSeenStateEvent` is set on the State object which is inherited by all state
  // objects, so it can be called from all of them when a transition triggers a change of state
  State.prototype = {
    emitLastSeenStateEvent: function (x) {
      last_seen_state_event_emitter.emit(x);
    },
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
 * - a function whose name is the state name to represent the state history (set in the `history`
 * property of the hash)
 * @param states A hash describing a hierarchy of nested states
 * @returns {state_name: {String}, {history: {Function}}}
 */
function build_state_enum(states) {
  let states_enum = { history: {} };

  // Set initial state
  states_enum.NOK = INIT_STATE;

  function build_state_reducer(states) {
    keys(states).forEach(function (state_name) {
      const state_config = states[state_name];

      states_enum[state_name] = state_name;
      // All history states will be signalled through the history property, and a function instead
      // of a value The function name is the state name whose history is referred to
      let state_name_history_fn;
      // NOTE : we add an underscore to avoid collision with javascript reserved word (new,
      // each, ...)
      eval(
        ["state_name_history_fn = function", "_" + state_name, "(){}"].join(" ")
      );
      states_enum.history[state_name] = state_name_history_fn;

      if (typeof state_config === "object") {
        build_state_reducer(state_config);
      }
    });
  }

  build_state_reducer(states);

  return states_enum;
}

/**
 * TODO : DOC transition mechanism
 * - transition format
 *   - events : if not present, then actions become automatic
 *   // DOC : only document the array : always array even if only one condition
 *   - condition(s) : if several, pass them in an array (field `conditions`), the order of the
 * array is the order of applying the conditions. When a single condition (field `condition`) When
 * the first is found true, the sequence of condition checking stops there
 *   - action : function (model, event_data, settings) : {output, update_state}
 *   - from : state from which the described transition operates
 *   - to : target state for the described transition
 * @param {FSM_Def} fsmDef
 * @param {{subject_factory: Function, merge: Function}} settings Contains the subject factory as mandatory settings,
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
  const subject_factory = settings && settings.subject_factory;
  if (!subject_factory)
    throw `create_state_machine : cannot find a subject factory (use Rxjs subject??)`;

  const _control_states = build_state_enum(control_states);
  const _events = build_event_enum(events);

  // Create the nested hierarchical
  const hash_states_struct = build_nested_state_structure(
    _control_states,
    subject_factory
  );

  // This will be the model object which will be updated by all actions and on which conditions
  // will be evaluated It is safely contained in a closure so it cannot be accessed in any way
  // outside the state machine. Note also that the model is only modified through JSON patch operations which create
  // a new model every time. There is hence no need to do any cloning.
  let model = initial_extended_state;
  // {Object<state_name,boolean>}, allows to know whether a state has a init transition defined
  let is_init_state = {};
  // {Object<state_name,boolean>}, allows to know whether a state has an automatic transition defined
  let is_auto_state = {};
  // {Object<state_name,boolean>}, allows to know whether a state is a group of state or not
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
        }// TODO
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
              console.info(
                "WITH model, event data, settings BEING ",
                model_,
                event_data,
                settings
              );
              console.info(
                "CASE : " +
                (predicate
                  ? "guard " + predicate.name + " for transition is fulfilled"
                  : "automatic transition")
              );
              // CASE : we do have some actions to execute
              console.info("THEN : we execute the action " + action.name);
              // NOTE : in a further extension, passing the fsm and the events object could help
              // in implementing asynchronous fsm
              const actionResult = action(model_, event_data, settings);

              // Leave the current state
              leave_state(from, model_, hash_states);

              // Update the model before entering the next state
              model = update_model(model_, actionResult.model_update);
              // Emit the new model event
              // new_model_event_emitter.onNext(model);
              console.info("RESULTING IN UPDATED MODEL : ", model);
              console.info("RESULTING IN OUTPUT : ", actionResult.output);

              // ...and enter the next state (can be different from to if we have nesting state group)
              const next_state = enter_next_state(
                to,
                actionResult.model_update,
                hash_states
              );
              console.info("ENTERING NEXT STATE : ", next_state);

              return { stop: true, output: actionResult.output }; // allows for chaining and stop
              // chaining guard
            } else {
              // CASE : guard for transition is not fulfilled
              console.log(
                "CASE : " +
                (predicate
                  ? "guard " +
                  predicate.name +
                  " for transition NOT fulfilled..."
                  : "no predicate")
              );
              return { stop: false, output: NO_OUTPUT };
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
        return { stop: false, output: NO_OUTPUT };
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
      const output = event_handler(model, event_data, current_state).output;

      // we read it anew as the execution of the event handler may have changed it
      const new_current_state = hash_states[INIT_STATE].current_state_name;

      // Two cases here:
      // 1. Init handlers, when present on the current state, must be acted on immediately
      // This allows for sequence of init events in various state levels
      // For instance, L1: init -> L2:init -> L3:init -> L4: stateX
      // In this case event_data will carry on the data passed on from the last event (else we loose
      // the model?) 2. transitions with no events associated, only conditions (i.e. transient
      // states) In this case, there is no need for event data
      if (is_auto_state[new_current_state]) {
        // CASE : transient state with no triggering event, just conditions
        // automatic transitions = transitions without events
        const auto_event = is_init_state[new_current_state]
          ? INIT_EVENT
          : AUTO_EVENT;
        return send_event({ [AUTO_EVENT]: event_data }); // TODO : probably [auto_event]...
      } else return output;
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

    // Set the `last_seen_state` property in the object representing that state's state (!)...
    state_from.history.last_seen_state = state_from_name;
    state_from.active = false;
    console.log("left state", wrap(from));

    // ... and emit the change event for the parents up the hierarchy to update also their
    // last_seen_state properties This updating solution is preferred to an imperative solution, as
    // it allows not to think too much about how to go up the hierarchy There is no big difference
    // also, as by default subject emits synchronously their values to all subscribers. The
    // difference in speed should be neglectable, and anyways it is not expected to have large
    // state chart depths
    state_from.emitLastSeenStateEvent({
      event_emitter_name: state_from_name,
      last_seen_state_name: state_from_name
    });
  }

  function enter_next_state(to, model_prime, hash_states) {
    // Enter the target state
    let state_to;
    let state_to_name;
    // CASE : history state (H)
    if (typeof to === "function") {
      state_to_name = get_fn_name(to);

      const target_state = hash_states[state_to_name].history.last_seen_state;
      state_to_name = target_state
        ? // CASE : history state (H) && existing history, target state is the last seen state
        target_state
        : // CASE : history state (H) && no history (i.e. first time state is entered), target state
          // is the entered state
        state_to_name;
      state_to = hash_states[state_to_name];
    } else if (to) {
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

  /**
   * OUT
   * @param model
   * @param modelUpdateOperations
   */
  function update_model(model, modelUpdateOperations) {
    return applyUpdateOperations(model, modelUpdateOperations);
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
      .filter(output => output !== NO_OUTPUT)
      .share();
  };

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
 * @param  {Object.<string, function>} entryActions Adds an action to be processed when entering a given state
 * @param  {Array<Transition>} transitions Array of transitions for a given state machine
 * @param  {{}} states hierarchy of states for a given state machine
 * @param {function (Array<MachineOutput>) : MachineOutput} mergeOutputFn monoidal merge (pure) function
 * to be provided to instruct how to combine machine outputs. Beware that the second output corresponds to the entry
 * action output which must logically correspond to a processing as if it were posterior to the first output. In
 * many cases, that will mean that the second machine output has to be 'last', whatever that means for the monoid
 * and application in question
 */
export function decorateWithEntryActions(transitions, states, entryActions, mergeOutputFn) {
  const { getLabel } = objectTreeLenses;
  const traverse = {
    strategy: PRE_ORDER,
    seed: {},
    visit: (accStateList, traversalState, tree) => {
      const treeLabel = getLabel(tree);
      const controlState = Object.keys(treeLabel)[0];
      accStateList[controlState] = "";

      return accStateList;
    }
  };
  const stateHashMap = traverseObj(traverse, states);
  const isValidEntryActions = Object.keys(entryActions).every(controlState => {
    return stateHashMap[controlState] != null;
  });

  if (!isValidEntryActions) {
    throw `decorateWithEntryActions : found control states for which entry actions are defined, and yet do not exist in the state machine!`;
  } else {
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

    return decoratedTransitions;
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
  // anything. That means the automatic event should logically receive the state updated by the entry action TODO :
  // test it!
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
      output: mergeOutputFn([actionResult.output, exitActionResult.output])
    };
  };
  decoratedAction.displayName = action.displayName;

  return decoratedAction;
}

/**
 * This function converts a state machine `A` into a traced state machine `T(A)`. The traced state machine, on
 * receiving an input `I` outputs the following information :
 * - `output` : the output `A.yield(I)`
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
 * @param {*} env unused for now
 * @param {FSM_Def} fsm
 */
export function traceFSM(env, fsm) {
  return mapOverActions(env, fsm, function (env, fsmData, action) {
    return function (model, eventData, settings) {
      const { controlState, eventLabel, targetControlState, predicate } = fsmData;
      const actionResult = action(model, eventData, settings);
      const { output, model_update } = actionResult;

      return {
        model_update,
        output: {
          output,
          model_update,
          extendedState: model,
          controlState,
          event: { eventLabel, eventData },
          settings: settings,
          targetControlState,
          predicate,
          actionFactory: action
        },
      }
    }
  })
}

// TODO : in tracing try to conserve or check that action names are conserved
// TODO : actually add display name systematically for action in core
// TODO DOC: beware not to modify settings, it is passed by reference and not cloned!!
// TODO DOC: explain hierarchy, initial events, auto events, and other contracts
// TODO DOC: document the obs merge settings (+filter necessary on prototype)

/* test plan
Case non-hierarchical state machine :
A -> B with event[ guard ] / action
action -> {update state, output] | exception
update_state = [no update, update 1, update 2, malformed] (I need to update to test composition of updates. Ideally they should be chosen such that order matters, and not idempotent (use JSON patch push possibility))
output = [no output, {model, event_data} - not cloned, to check immutable, malformed]
event -> [init, event1, event2, unknown event]
guard -> [T, F, exception]
// TODO : I should also clone settings prior to usage, so it is not modified later on inadvertently

  Then Machines = [States x Transitions x event[ guard ] / action]
    States in [Init, State1, State2, State3]
    Transitions in [pick two states in States possibly the same]

So stage 1 : input generation
   Stage 2 : for the generated input, guess the right result and then check vs. actual run

Edge case : malformed state machine : write checker of well-formed (to test too then...)

So Model based Testing algorithm :
- accumulator initialized to null
- generate set of states -> accumulator
- generate set of transitions -> accumulator
- generate event sequence -> accumulator
- generate guard -> accumulator
- generate actions -> accumulator

Now I want to generate some more interesting cases than other, rather than go with exhaustive testing
*/
