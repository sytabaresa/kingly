import {
  HISTORY_STATE_NAME, INIT_STATE, SEP, TRANSITION_LABEL_START_SYMBOL, TRANSITION_SYMBOL
} from "./properties"
import {
  getDisplayName, format_history_transition_state_name, format_transition_label, get_all_transitions, is_entry_transition,
  is_from_control_state, is_history_transition, is_to_history_control_state_of, times
} from './helpers'
import { arrayTreeLenses, objectTreeLenses, postOrderTraverseTree } from "fp-rosetree"

function generateStatePlantUmlHeader(state, optDisplayName) {
  return optDisplayName
    ? `state "${optDisplayName}" as ${state} <<NoContent>>`
    : `state "${getDisplayName(state)}" as ${state} <<NoContent>>`
}

/**
 * Converts a transducer definition to a textual format for interpretation by PlantUml tools
 * @param {FSM_Def} fsmDef
 * @param {*} settings
 */
export function toPlantUml(fsmDef, settings) {
  const { states, transitions } = fsmDef;
  const { getChildren, constructTree, getLabel } = objectTreeLenses;
  const stringify = path => path.join(SEP);
  const getChildrenNumber = (tree, traversalState) => getChildren(tree, traversalState).length;
  const traverse = {
    seed: () => Map,
    visit: (pathMap, traversalState, tree) => {
      const { path } = traversalState.get(tree);
      const treeLabel = getLabel(tree);
      const controlState = Object.keys(treeLabel)[0];
      const childrenTranslation = times(
        index => pathMap.get(stringify(path.concat(index))),
        getChildrenNumber(tree, traversalState)
      );
      const translation = stateToPlantUML(controlState, childrenTranslation, transitions);
      pathMap.set(stringify(path), translation);

      return pathMap;
    }
  };

  const translationMap = postOrderTraverseTree(objectTreeLenses, traverse, { [INIT_STATE]: states });

  const mappedTree = translationMap.get('0');
  translationMap.clear();

  return mappedTree;
}

/**
 * Convert a state machine specs into a plantUML format, limiting its conversion scope to a given control state and
 * its nested hierarchy
 * @param {Control_State} controlState
 * @param {Array<String>} childrenTranslation conversion of the states nested in the given control state
 * @param {Array<Transition>} transitions Full set of transitions as defined in the state machine specs
 * CONTRACT : All control states must have different names...
 */
function stateToPlantUML(controlState, childrenTranslation, transitions) {
  return [
    `${generateStatePlantUmlHeader(controlState, '')} {`,
    childrenTranslation.join('\n'),
    format_history_states(controlState, transitions),
    format_entry_transitions(controlState, transitions),
    `}`,
    translate_transitions(controlState, transitions)
  ]
    .filter(x => x !== '\n' && x !== '')
    .join('\n');
}

function format_history_states(controlState, transitions) {
  // creates the history states as orig.dest.H
  // e.g.  state "H" as CD_stepping_forwards.CD_Loaded_Group.H <<NoContent>>
  const historyStatesObj = transitions.reduce((accTranslation, transition) => {
    const allTransitions = get_all_transitions(transition);

    return allTransitions
      .filter(is_history_transition)
      .filter(is_to_history_control_state_of(controlState))
      .reduce((acc, transition) => {
        acc[format_history_transition_state_name(transition)] = void 0;
        return acc
      }, accTranslation)
  }, {});
  const historyStates = Object.keys(historyStatesObj);

  return historyStates.map(historyState => {
    return `${generateStatePlantUmlHeader(historyState, HISTORY_STATE_NAME)}`
  }).join('\n')
}

function translate_transitions(controlState, transitions) {
  const historyTransitionTranslation = format_history_transitions(controlState, transitions);
  const standardTransitionTranslation = format_standard_transitions(controlState, transitions);

  return [
    historyTransitionTranslation,
    standardTransitionTranslation
  ]
    .filter(Boolean)
    .join('\n')
}

function format_standard_transitions(controlState, transitions) {
  // The only transition from initial state are INIT transitions and that's already taken care of elsewhere
  if (controlState === INIT_STATE) return ''
  else return transitions.map(transition => {
    const allTransitions = get_all_transitions(transition)

    return allTransitions
      .filter(is_from_control_state(controlState))
      .filter(transition => !is_entry_transition(transition))
      .filter(transition => !is_history_transition(transition))
      .map(({ from, event, predicate, to, action }) => {
        return [
          from,
          TRANSITION_SYMBOL,
          to,
          TRANSITION_LABEL_START_SYMBOL,
          format_transition_label(event, predicate, action),
        ].join(' ')
      }).join('\n');
  })
  // necessary because [].join('\n') is "" so I need to take those out to avoid unnecessary '\n' down the road
    .filter(Boolean)
    .join('\n');
}

function format_entry_transitions(controlState, transitions) {
  const translation = transitions.reduce((accTranslation, transition) => {
    const allTransitions = get_all_transitions(transition);

    return allTransitions
      .filter(is_entry_transition)
      .filter(is_from_control_state(controlState))
      .reduce((acc, transition) => {
        const { from, to, predicate, action } = transition;
        acc.push(
          `[*] ${TRANSITION_SYMBOL} ${to} ${TRANSITION_LABEL_START_SYMBOL} ${format_transition_label("", predicate, action)}`
        );
        return acc
      }, accTranslation)
  }, []);

  return translation.join('\n')
}

function format_history_transitions(controlState, transitions) {
  return transitions.map(transition => {
    const allTransitions = get_all_transitions(transition)

    return allTransitions
      .filter(is_from_control_state(controlState))
      .filter(is_history_transition)
      .map(({ from, event, predicate, to, action }) => {
        return [
          from,
          TRANSITION_SYMBOL,
          format_history_transition_state_name({ from, to }),
          TRANSITION_LABEL_START_SYMBOL,
          format_transition_label(event, predicate, action),
        ].join(' ')
      }).join('\n');
  })
    .filter(Boolean)
    .join('\n');
}

export function toDagreVisualizerFormat(fsmDef) {
  // only thing to do here is to replace functions (guards and actions) by their name, and keep only
  // the states and transitions properties
  // ah no I also need to turn the states obj tree into an array-based tree... grrr
  const { states, transitions } = fsmDef;
  const { getLabel, getChildren } = objectTreeLenses;
  const { constructTree } = arrayTreeLenses;
  const getChildrenNumber = (tree, traversalState) => getChildren(tree, traversalState).length;
  const stringify = path => path.join(SEP);
  const traverse = {
    seed: () => Map,
    visit: (pathMap, traversalState, tree) => {
      const { path } = traversalState.get(tree);
      const treeLabel = getLabel(tree);
      const controlState = Object.keys(treeLabel)[0];
      const children = times(
        index => pathMap.get(stringify(path.concat(index))),
        getChildrenNumber(tree, traversalState)
      );
      pathMap.set(stringify(path), constructTree(controlState, children));

      return pathMap;
    }
  };

  const _translatedStates = postOrderTraverseTree(objectTreeLenses, traverse, { [INIT_STATE]: states });
  const translatedStates = _translatedStates.get('0');

  const translatedTransitions = transitions.map(transition => {
    const { from, to, event, guards, action } = transition;
    if (guards) {
      const translatedGuards = guards.map(guard => {
        const { predicate, to, action } = guard;
        return { predicate: predicate.name, to, action: action.name }
      })
      return { from, event, guards: translatedGuards }
    }
    else {
      // case {from, to event, action}
      return { from, to, event, action: action.name || 'no action name?' }
    }
  });

  return JSON.stringify({ states: translatedStates, transitions: translatedTransitions })
}
