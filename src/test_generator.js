// TODO import {depthFirstTraverseGraphEdges} from 'graph-adt' uncomment whn finished
import { constructGraph, depthFirstTraverseGraphEdges } from '../../graph-adt/src'
import { INIT_STATE } from "./properties"
import {
  computeHistoryState, getFsmStateList, getHistoryParentState, getHistoryType, isCompoundState, isEventless,
  isHistoryControlState, isHistoryStateEdge, isInitEvent, isInitState, isShallowHistory, lastOf, merge,
  reduceTransitions
} from "./helpers"
import { create_state_machine, traceFSM } from "./synchronous_fsm"
import { objectTreeLenses, PRE_ORDER, traverseObj } from "fp-rosetree"

const graphSettings = {
  getEdgeOrigin: function (edge) {
    return edge.from
  },
  getEdgeTarget: function (edge) {
    return edge.to
  },
  constructEdge: function (originVertex, targetVertex) {
    return { from: originVertex, to: targetVertex }
  }
};

/**
 *
 * @param {FSM_Def} fsm Machine modelizing the system under test
 * @param {FSM_Gen_Def} generators
 * @param {{ strategy: { isGoalReached : SearchPredicate, isTraversableEdge : SearchPredicate} }} settings
 * `isTraversableEdge` tells us
 * whether to
 * continue the graph exploration. `isGoalReached` tells us when to aggregate results
 * @returns {*}
 */
export function generateTestsFromFSM(fsm, generators, settings) {
  const startingVertex = INIT_STATE;
  const tracedFSM = traceFSM({}, fsm);
  const fsmStates = tracedFSM.states;
  const analyzedStates = analyzeStateTree(fsmStates);
  const initialExtendedState = tracedFSM.initialExtendedState;
  const { strategy: { isGoalReached, isTraversableEdge } } = settings;

  // Associate a gen to (from, event, guard index) = the transition it is mapped
  const genMap = getGeneratorMapFromGeneratorMachine(generators);

  // Build a graph from the tracedFSM, and the state machine triggering logic
  const fsmGraph = convertFSMtoGraph(tracedFSM);
  // search that graph with the right parameters
  const search = {
    initialGoalEvalState: { results: [] },
    showResults: graphTraversalState => graphTraversalState.results,
    evaluateGoal: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { results } = graphTraversalState;
      const bIsGoalReached = isGoalReached(edge, graph, pathTraversalState, graphTraversalState);
      const { inputSequence, outputSequence, controlStateSequence } = pathTraversalState;
      const newResults = bIsGoalReached
        ? results.concat([{ inputSequence, outputSequence, controlStateSequence }])
        : results;
      const newGraphTraversalState = { results: newResults };

      return {
        isGoalReached: bIsGoalReached,
        graphTraversalState: newGraphTraversalState
      }
    },
  };
  const visit = {
    initialPathTraversalState: {
      path: [],
      controlStateSequence: [INIT_STATE],
      inputSequence: [],
      outputSequence: [],
      noMoreInput: false
    },
    visitEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      const trueEdge = edge.compound
        ? merge(edge, { from: edge.compound })
        : edge;
      // NOTE : edge is a transition of the state machine
      const { inputSequence } = pathTraversalState;
      // Execute the state machine with the input sequence to get it in the matching control state
      // Note that the machine has to be recreated each time, as it is a stateful object
      const fsm = create_state_machine(tracedFSM, settings);
      const extendedState = inputSequence.length === 0
        // Edge case : we are in INIT_STATE, the init event has the initial extended state as event data
        ? initialExtendedState
        // Main case : we run the sequence of inputs and
        // we take the extended state of the machine at the end of the run
        // NOTE : fsm is a traced fsm, the output returned will always be an array of length 1
        : lastOf(inputSequence.map(fsm.yield))[0].newExtendedState;

      // The generator is mapped to the original edge from the state machine transitions, so we use trueEdge
      const gen = getGeneratorMappedTransitionFromEdge(genMap, trueEdge);
      const generatedInput = gen ? gen(extendedState) : { input: null, hasGeneratedInput: false };
      // The traversability of an edge is based on the original edge from the state machine
      // transitions, so we use trueEdge
      const _isTraversableEdge = isTraversableEdge(trueEdge, graph, pathTraversalState, graphTraversalState);
      // Visit the edge
      const { newPathTraversalState, newIsTraversableEdge } =
        computeNewPathTraversalState(fsm, fsmStates, analyzedStates, edge, generatedInput, pathTraversalState, _isTraversableEdge);

      return {
        pathTraversalState: newPathTraversalState,
        isTraversableEdge: newIsTraversableEdge
      }
    }
  };
  const testCases = depthFirstTraverseGraphEdges(search, visit, startingVertex, fsmGraph);

  return testCases
}

function computeNewPathTraversalState(fsm, fsmStates, analyzedStates, edge, genInput, pathTraversalState,
                                      isTraversableEdge) {
  const { event: eventLabel, from: controlState, to: targetControlState, history } = edge;

  // Then get and run the generator matching the control state, and the edge transition
  // to get the input and output sequences

  // TODO : restructure the if, with comments first then code
  // Case 1 : control state is INIT_STATE and event is INIT_EVENT
  // Reminder : in INIT_STATE, the only event admissible is INIT_EVENT
  if (isInitState(controlState) && !isInitEvent(eventLabel)) {
    throw `computeNewPathTraversalState : cannot be in INIT_STATE and receive another event than INIT_EVENT! Check your fsm configuration!`
  }
  // Case 2. the init event is manually sent : we have to generate the corresponding input
  else if (isInitState(controlState) && isInitEvent(eventLabel)) {
    return computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState)
  }
  // Case 3 : the init event is automatically and internally sent by the state machine : no need to generate inputs!
  else if (!isInitState(controlState) && isInitEvent(eventLabel)) {
    return computeGeneratedInfoDoNothingCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState)
  }
  // Case 4 : main case
  else if (!isInitState(controlState) && !isInitEvent(eventLabel)) {
    // Edge case 4.0: controlState is a compound state -> this cannot happen per the way the graph is constructed :
    // Origin compound states A = [A1, A2, A3], with A -ev> X are broken down in [A1 -ev> X, A2 -ev>X...], if ev != INIT
    if (isCompoundState(analyzedStates, controlState)) {
      return computeRejectCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState)
    }
    // Case 4.1 : if eventless transition, the machine progress automatically,
    // so we have no input to generate to trigger a transition!
    else if (isEventless(eventLabel)) {
      return computeGeneratedInfoDoNothingCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState)
    }
    // Case 4.2 : if history transition, input generation is depending on the actual history so far
    else if (isHistoryStateEdge(edge)) {
      return computeGeneratedInfoHistoryStateCase(fsm, fsmStates, edge, isTraversableEdge, genInput, pathTraversalState)
    }
    // general case 4,3 : not init state, not init event, not eventless, not history transition
    else {
      return computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState)
    }
  }
}

function computeRejectCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState) {
  return {
    newIsTraversableEdge: false,
    newPathTraversalState: pathTraversalState
  }
}

function computeGeneratedInfoDoNothingCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState) {
  const { to: targetControlState } = edge;
  const { path, inputSequence, outputSequence, controlStateSequence } = pathTraversalState;

  return {
    newIsTraversableEdge: true,
    newPathTraversalState: {
      inputSequence,
      // NOTE: reminder : intermediary states do not output! so no output to aggregate here
      outputSequence,
      controlStateSequence: controlStateSequence.concat([targetControlState]),
      path: path.concat([edge])
    }
  }
}

function computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState) {
  const { event: eventLabel, from: controlState, to: targetControlState } = edge;
  const { path, inputSequence, outputSequence, controlStateSequence } = pathTraversalState;
  const { input: newInputData, hasGeneratedInput } = genInput;
  let noMoreInput, newInputSequence, newOutputSequence, newControlStateSequence, newPath;

  // There is no way to generate an input for that transition : invalid transition
  // This could be the case when the extended state generated by the input sequence invalidates the transition guard
  if (!hasGeneratedInput) {
    noMoreInput = true;
    newInputSequence = inputSequence;
    newOutputSequence = outputSequence;
    newControlStateSequence = controlStateSequence;
    newPath = path;
  }
  // We generated an input for that transition : add that to the generated input sequence
  else {
    const newInput = { [eventLabel]: newInputData };
    newInputSequence = inputSequence.concat([newInput]);
    // NOTE : the fsm is a traced one. That means it will always return as output an array with exactly one item!
    const newOutput = fsm.yield(newInput)[0];
    // NOTE : finalControlState is the control state at the end of the associated automatic transitions, if any
    // A -INIT> B -INIT> C ; edge : [A -INIT> B] => finalControlState = C, targetControlState = B
    const { outputs: untracedOutput, targetControlState: finalControlState } = newOutput;
    newOutputSequence = outputSequence.concat(untracedOutput);
    newControlStateSequence = controlStateSequence.concat([targetControlState]);
    newPath = path.concat([edge]);
    noMoreInput = false;
  }

  return {
    newIsTraversableEdge: !noMoreInput && isTraversableEdge,
    newPathTraversalState: {
      inputSequence: newInputSequence,
      outputSequence: newOutputSequence,
      controlStateSequence: newControlStateSequence,
      path: newPath
    }
  }
}

function computeGeneratedInfoHistoryStateCase(fsm, fsmStates, edge, isTraversableEdge, genInput, pathTraversalState) {
  const { to: targetControlState, history } = edge;
  const { controlStateSequence } = pathTraversalState;

  const historyParentState = getHistoryParentState(history);
  const historyType = getHistoryType(history);
  // We must compute the history state assuming edge.from is exited!
  // As edge.from is already in the control state sequence, we are good to call computeHistoryState
  const historyStateForParentState = computeHistoryState(fsmStates, controlStateSequence, historyType, historyParentState);

  // We have an history edge to evaluate, and the history target for that edge
  // does not correspond to the actual history state generated by the input sequence
  // No need to traverse that edge nor generate any inputs : this transition never happens
  if (historyStateForParentState !== targetControlState) {
    return {
      newIsTraversableEdge: false,
      newPathTraversalState: pathTraversalState
    }
  }
  // We have an history edge to evaluate, and the history target for that edge match the history
  // generated by the input sequence
  else {
    return computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, genInput, pathTraversalState)
  }
}

/**
 * @param {FSM_Gen_Def} generators
 */
export function getGeneratorMapFromGeneratorMachine(generators) {
  return reduceTransitions((acc, transition, guardIndex, transitionIndex) => {
    const { from, event, gen } = transition;
    acc.set(JSON.stringify({ from, event, guardIndex }), gen);
    return acc
  }, new Map(), generators)
}

/**
 * Returns the graph structure associated to the FSM. The graph is constructed from the state machines transitions,
 * with a reduction mechanism applied to transitions with origin a compound state which are flattened
 * @param {FSM_Def} tracedFSM
 * @returns Graph
 */
export function convertFSMtoGraph(tracedFSM) {
  const { transitions, states } = tracedFSM;
  const vertices = Object.keys(getFsmStateList(states)).concat(INIT_STATE);
  // The trace set of H(A) are the direct children of A, i.e. statesAdjacencyList
  // The trace set of H*(A) are the descendents of A which are leaves, i.e. statesLeafChildrenList
  const { statesAdjacencyList, statesLeafChildrenList } = analyzeStateTree(states);
  const edges = reduceTransitions((acc, transition, guardIndex, transitionIndex) => {
    const { from, event, to, action, predicate } = transition;
    const transitionRecord = { from, event, action, predicate, to, guardIndex, transitionIndex };
    const isOriginStateCompound = isCompoundState({ statesAdjacencyList, statesLeafChildrenList }, from);
    const isOriginStateAtomic = !isOriginStateCompound;
    const isTargetStateCompound = isCompoundState({ statesAdjacencyList, statesLeafChildrenList }, to);
    const isTargetStateAtomic = !isTargetStateCompound;
    const isHistoryState = isHistoryControlState(to);

    // We have cyclomatic complexity = 11 branches??!!!

    // Terminology :
    // - Trace set of f : set of all possible values that can be taken by f (i.e. f image)
    // Reminder : history states are always atomic target states
    // Algorithm :
    // 1. If A = [A1,A2,A3] is a compound state, A -INIT> X is created as per the configured transitions
    // 2. If A = [A1,A2,A3] is a compound state, and X is such that A -ev> X, with ev != INIT
    // then the edges will be created : A1 -ev> X, A2 -ev> X, A3 -ev> X
    // 3. If A -ev> H | H*, then the trace set of H | H* is computed, and this is dealt with as
    //   If A -ev> trace(H) | trace(H*)
    // Otherwise edges are created as per the configured transitions
    // NOTE : because 1, 2, and 3 may intersect, for better maintainability and safety,
    // we structure the code by the disjoint `if` branches from the `origin x target` space,
    // with origin and target taking values in [atomic, compound] and identifiy cases 1,2,3 each time
    if (isOriginStateAtomic && isTargetStateAtomic) {
      if (isHistoryState) {
        const historyParentState = getHistoryParentState(to);
        const traceHistorySet = isShallowHistory(to)
          ? statesAdjacencyList[historyParentState]
          : statesLeafChildrenList[historyParentState];

        return acc.concat(traceHistorySet.map(state => merge(transitionRecord, { to: state, history: to })))
      }
      else {
        return acc.concat(transitionRecord)
      }
    }
    else if (isOriginStateAtomic && isTargetStateCompound) {
      return acc.concat(transitionRecord)
    }
    else if (isOriginStateCompound && isTargetStateAtomic) {
      const childrenStates = statesLeafChildrenList[from];
      const origins = childrenStates.map(state => merge(transitionRecord, { from: state, compound: from }));

      if (isInitEvent(event)) {
        return acc.concat(transitionRecord)
      }
      else if (isHistoryState) {
        const historyParentState = getHistoryParentState(to);
        const traceHistorySet = isShallowHistory(to)
          ? statesAdjacencyList[historyParentState]
          : statesLeafChildrenList[historyParentState];
        const transitions = traceHistorySet.reduce((acc, possibleHistState) => {
          return origins.reduce((acc2, origin) => {
            return acc2.concat(merge(origin, { to: possibleHistState, history: to }))
          }, acc)
        }, []);

        return acc.concat(transitions)
      }
      else {
        return acc.concat(origins);
      }
    }
    else if (isOriginStateCompound && isTargetStateCompound) {
      if (isInitEvent(event)) {
        return acc.concat(transitionRecord)
      }
      else {
        const childrenStates = statesLeafChildrenList[from];
        const origins = childrenStates.map(state => merge(transitionRecord, { from: state, compound: from }));

        return acc.concat(origins);
      }
    }
  }, [], transitions);

  return constructGraph(graphSettings, edges, vertices)
}

/**
 * For a given state hierarchy, return a map associating, for every control state, its direct substates, and its
 * children which are atomic states
 * @param {FSM_States} states
 * @returns {{statesAdjacencyList: Object.<ControlState, Array<ControlState>>, statesLeafChildrenList:
 *   Object.<ControlState, Array<ControlState>>}}
 */
export function analyzeStateTree(states) {
  const { getLabel, getChildren, isLeafLabel } = objectTreeLenses;
  const traverse = {
    strategy: PRE_ORDER,
    seed: { statesAdjacencyList: {}, leaveStates: {} },
    visit: (acc, traversalState, tree) => {
      const { path } = traversalState.get(tree);
      const treeLabel = getLabel(tree);
      const controlState = Object.keys(treeLabel)[0];
      acc.statesAdjacencyList[controlState] = getChildren(tree).map(x => Object.keys(x)[0]);
      if (isLeafLabel(treeLabel)) {
        acc.leaveStates[path.join('.')] = controlState;
      }

      return acc;
    }
  };
  const { statesAdjacencyList, leaveStates } = traverseObj(traverse, states);

  const leavePathsStr = Object.keys(leaveStates);
  const traverseAgain = {
    strategy: PRE_ORDER,
    seed: { statesLeafChildrenList: {} },
    visit: (acc, traversalState, tree) => {
      const { path } = traversalState.get(tree);
      const pathStr = path.join('.');
      const treeLabel = getLabel(tree);
      const controlState = Object.keys(treeLabel)[0];
      acc.statesLeafChildrenList[controlState] = [];
      leavePathsStr.filter(x => x !== pathStr).filter(x => x.startsWith(pathStr)).forEach(pathStr => {
        acc.statesLeafChildrenList[controlState].push(leaveStates[pathStr]);
      });

      return acc;
    }
  };
  const { statesLeafChildrenList } = traverseObj(traverseAgain, states);

  return {
    statesAdjacencyList,
    statesLeafChildrenList
  }
}

function getGeneratorMappedTransitionFromEdge(genMap, edge) {
  const { from, event, guardIndex } = edge;
  return genMap.get(JSON.stringify({ from, event, guardIndex }))
}

// API
// generateTestsFromFSM(fsm, generators, settings) : Array<TestCase>
// fsm :: FSM_Def
// generators :: FSM_Gen_Def
// settings :: *
// TestCase :: {input :: InputSequence, actual :: OutputSequence}
//
// A. FSM_Gen_Def
/**
 * @typedef {Object} FSM_Gen_Def
 * @property {Array<GenTransition>} generators An array of transitions associated to an input generator for the sut
 */
/**
 * @typedef {Object} GenTransition
 * @property {Array<GenTransitionFromState>} An array of transitions from a specific origin control state, including
 * input generators
 */
/**
 * @typedef {{from: ControlState, event: Event, guards: Array<GenSpecs>}} GenTransitionFromState Transition for the
 * specified state is contingent to some guards being passed. Those guards are defined as an array.
 */
/**
 * @typedef {{predicate: Predicate, gen: InputGenerator, to: ControlState}} GenSpecs Specifies a generator `gen`
 * which will be responsible for computing inputs which pass the predicate, triggering a transition to `to` control
 * state.
 */
/**
 * @typedef {function (ExtendedState) : {input: EventData, hasGeneratedInput: Boolean}} InputGenerator generator which
 * knows how to generate an input, taking into account the extended state of the machine under test, after an input
 * sequence has been run on it. The generated input is generated so as to trigger a specific transition of the state
 * machine. In the event, it is not possible to generate the targeted transition of the state machine, the generator
 * set the returned property `hasGeneratedInput` to `false`.
 */
/**
 * @typedef {*} NoInput any object which unequivocally signifies an absence of input.
 */
/**
 * @typedef {{input :: InputSequence, actual :: OutputSequence}} TestCase
 */
/**
 * @typedef {Array<LabelledEvent>} InputSequence
 */
/**
 * @typedef {Array<MachineOutput>} OutputSequence
 */
/**
 * @typedef {function (Edge, Graph, PathTraversalState, GraphTraversalState) : Boolean} SearchPredicate Computes a
 * boolean in function of the current visited edge, the current search path, and the previously accumulated results.
 * In addition the graph ADT is available for querying graph entities (vertices, edges, etc).
 */

