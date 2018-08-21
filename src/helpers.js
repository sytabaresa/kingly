// Ramda fns
import {
  CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE, HISTORY_PREFIX, HISTORY_STATE_NAME, INIT_EVENT, NO_OUTPUT
} from "./properties"
// import { applyPatch } from "./fast-json-patch/duplex"
import { applyPatch } from "json-patch-es6"
import { objectTreeLenses, PRE_ORDER, traverseObj } from "fp-rosetree"

/**
 * Returns the name of the function as taken from its source definition.
 * For instance, function do_something(){} -> "do_something"
 * @param fn {Function}
 * @returns {String}
 */
export function get_fn_name(fn) {
  const tokens =
    /^[\s\r\n]*function[\s\r\n]*([^\(\s\r\n]*?)[\s\r\n]*\([^\)\s\r\n]*\)[\s\r\n]*\{((?:[^}]*\}?)+)\}\s*$/
      .exec(fn.toString());
  return tokens[1];
}

export function wrap(str) { return ['-', str, '-'].join(""); }

export function times(fn, n) {
  return Array.apply(null, { length: n }).map(Number.call, Number).map(fn)
}

/**
 *
 * @param {FSM_Model} model
 * @param {JSON_Patch_Operation[]} modelUpdateOperations
 * @returns {FSM_Model}
 */
export function applyUpdateOperations(/*OUT*/model, modelUpdateOperations) {
  assertContract(isArrayUpdateOperations, [modelUpdateOperations],
    `applyUpdateOperations : ${CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE}`);

  // NOTE : we don't validate operations, to avoid throwing errors when for instance the value property for an
  // `add` JSON operation is `undefined` ; and of course we don't mutate the document in place
  return applyPatch(model, modelUpdateOperations, false, false).newDocument;
}

export function always(x) {return x}

export function keys(obj) {return Object.keys(obj)}

// Contracts
export function assertContract(contractFn, contractArgs, errorMessage) {
  const boolOrError = contractFn.apply(null, contractArgs)
  const isPredicateSatisfied = isBoolean(boolOrError) && boolOrError;

  if (!isPredicateSatisfied) {
    throw `assertContract: fails contract ${contractFn.name}\n${errorMessage}\n ${boolOrError}`
  }
  return true
}

export function isBoolean(obj) {return typeof(obj) === 'boolean'}

export function isUpdateOperation(obj) {
  return (typeof(obj) === 'object' && Object.keys(obj).length === 0) ||
    (
      ['add', 'replace', 'move', 'test', 'remove', 'copy'].some(op => obj.op === op) &&
      typeof(obj.path) === 'string'
    )
}

export function isEmptyArray(obj) {return Array.isArray(obj) && obj.length === 0}

export function isArrayOf(predicate) {return obj => Array.isArray(obj) && obj.every(predicate)}

export function isArrayUpdateOperations(obj) {
  return isEmptyArray(obj) || isArrayOf(isUpdateOperation)(obj)
}

export function is_history_transition(transition) {
  return transition.to.startsWith(HISTORY_PREFIX)
}

export function is_entry_transition(transition) {
  return transition.event === INIT_EVENT
}

export function is_from_control_state(controlState) {
  return function (transition) {
    return transition.from === controlState
  }
}

export function is_to_history_control_state_of(controlState) {
  return function (transition) {
    return is_history_control_state_of(controlState, transition.to)
  }
}

export function is_history_control_state_of(controlState, state) {
  return state.substring(HISTORY_PREFIX.length) === controlState
}

export function format_transition_label(_event, predicate, action) {
  const event = _event || '';
  return predicate && action
    ? `${event} [${predicate.name}] / ${action.name}`
    : predicate
      ? `${event} [${predicate.name}]}`
      : action
        ? `${event} / ${action.name}`
        : `${event}`
}

export function format_history_transition_state_name({ from, to }) {
  return `${from}.${to.substring(HISTORY_PREFIX.length)}.${HISTORY_STATE_NAME}`
}

export function get_all_transitions(transition) {
  const { from, event, guards } = transition;

  return guards
    ? guards.map(({ predicate, to, action }) => ({ from, event, predicate, to, action }))
    : [transition];
}

/**
 * 'this_name' => 'this name'
 * @param {String} str
 * @returns {String}
 */
export function getDisplayName(str) {
  return str.replace(/_/g, ' ')
}

/**
 * This function MERGES model updates. That means that given two model updates, the resulting model update will be
 * the concatenation of the two, in the order in which they are passed
 * @param {function[]}  arrayUpdateFns
 * @returns {function(*=, *=, *=): {model_update: *}}
 */
export function mergeModelUpdates(arrayUpdateFns) {
  // TODO write just like [].concat(...arrayModelUpdates), array..Updates = arrayActions.map(x => x.model_update || []);
  return function (model, eventData, settings) {
    return {
      model_update: arrayUpdateFns.reduce((acc, updateFn) => {
        const update = updateFn(model, eventData, settings).model_update;
        if (update) {
          return acc.concat(update)
        }
        else {
          return acc
        }
      }, [])
    }
  }
}

/**
 * This function CHAINS model updates, in the order in which they are passed. It is thus similar to a pipe.
 * The second update function receives the model updated by the first update function.
 * @param {function[]}  arrayUpdateFns
 */
export function chainModelUpdates(arrayUpdateFns) {
  return function (model, eventData, settings) {
    return {
      model_update: arrayUpdateFns
        .reduce((acc, updateFn) => {
          const { model, model_update } = acc;
          const update = updateFn(model, eventData, settings).model_update;
          const updatedModel = applyUpdateOperations(model, model_update)

          return { model: updatedModel, model_update: update }
        }, { model, model_update: [] })
        .model_update || []
    }
  }
}

function defaultMerge(arrayOutputs) {
  return arrayOutputs.length === 0 ? NO_OUTPUT : Object.assign({}, ...arrayOutputs)
}

/**
 *
 * @param {function (Array<MachineOutput>) : MachineOutput} mergeOutputFn
 * @param {Array<ActionFactory>} arrayActionFactory
 * @returns {function(*=, *=, *=): {model_update: *[], output: *|null}}
 */
export function mergeActionFactories(mergeOutputFn, arrayActionFactory) {
  return function (model, eventData, settings) {
    const arrayActions = arrayActionFactory.map(factory => factory(model, eventData, settings));
    const arrayModelUpdates = arrayActions.map(x => x.model_update || []);
    const arrayOutputs = arrayActions.map(x => x.output || {});

    return {
      model_update: [].concat(...arrayModelUpdates),
      // for instance, mergeFn = R.mergeAll or some variations around R.mergeDeepLeft
      output: (mergeOutputFn || defaultMerge)(arrayOutputs)
    }
  }
}

/** @type ActionFactory*/
export function identity(model, eventData, settings) {
  return {
    model_update: [],
    output: NO_OUTPUT
  }
}

export function lastOf(arr) {
  return arr[arr.length - 1];
}

function formatActionName(action, from, event, to, predicate) {
  const predicateName = predicate ? predicate.name : "";
  const formattedPredicate = predicateName ? `[${predicateName}]` : "";
  const actionName = action ? action.name : "identity";
  const formattedAction = actionName ? actionName : "unnamed action";
  return `${formattedAction}:${from}-${event}->${to} ${formattedPredicate}`;
}

export function getFsmStateList(fsm) {
  const { states } = fsm;
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

  return stateHashMap
}

// DOC : the mapped action should have same name than the action it is mapping
export function mapOverTransitionsActions(mapFn, transitions) {
  return reduceTransitions(function (acc, transition, guardIndex, transitionIndex) {
    const { from, event, to, action, predicate } = transition;
    const mappedAction = mapFn(action, transition, guardIndex, transitionIndex);
    mappedAction.displayName = action.name || action.displayName || formatActionName(action, from, event, to, predicate);

    if (typeof(predicate) === 'undefined') {
      acc.push({ from, event, to, action: mappedAction })
    }
    else {
      if (guardIndex === 0) {
        acc.push({ from, event, guards: [{ to, predicate, action: mappedAction }] })
      }
      else {
        acc[acc.length - 1].guards.push({ to, predicate, action: mappedAction })
      }
    }

    return acc
  }, [], transitions)
}

export function reduceTransitions(reduceFn, seed, transitions) {
  const result = transitions.reduce((acc, transitionStruct, transitionIndex) => {
    let { from, event, to, gen, action, guards } = transitionStruct;
    // Edge case when no guards are defined
    if (!guards) {
      guards = gen ? [{ to, action, gen, predicate: undefined }] : [{ to, action, predicate: undefined }]
    }
    return guards.reduce((acc, guard, guardIndex) => {
      const { to, action, gen, predicate } = guard;
      return gen
        ? reduceFn(acc, { from, event, to, action, predicate, gen }, guardIndex, transitionIndex)
        : reduceFn(acc, { from, event, to, action, predicate }, guardIndex, transitionIndex)
    }, acc);
  }, seed);

  return result
}
