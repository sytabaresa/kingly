// TODO import {depthFirstTraverseGraphEdges} from 'graph-adt' uncomment whn finished
import { constructGraph, depthFirstTraverseGraphEdges } from '../../graph-adt/src'
import { INIT_STATE } from "./properties"
import {
  getFsmStateList, getHistoryParentState, isDeepHistory, isEventless, isHistoryControlState, isInitEvent, isInitState,
  isShallowHistory, lastOf, merge, reduceTransitions
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
  const initial_extended_state = tracedFSM.initial_extended_state;

  // associate a gen to from, event, guard index = the transition it is mapped
  // Note that we need to deal specially with edge case when edge is starting edge
  const genMap = getGeneratorMapFromGeneratorMachine(generators);

  const { strategy: { isGoalReached, isTraversableEdge } } = settings;
  // build a graph from the tracedFSM
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
      // NOTE : edge is a transition of the state machine
      const { inputSequence } = pathTraversalState;
      // Execute the state machine with the input sequence to get it in the matching control state
      // Note that the machine has to be recreated each time, as it is a stateful object
      const fsm = create_state_machine(tracedFSM, settings);
      const extendedState = inputSequence.length === 0
        // Edge case : we are in INIT_STATE, the init event has the initial extended state as event data
        ? initial_extended_state
        // Main case : we run the sequence of inpus and
        // we take the extended state of the machine at the end of the run
        // NOTE : fsm is a traced fsm, the output returned will always be an array of length 1
        : lastOf(inputSequence.map(fsm.yield))[0].newExtendedState;
      // Then get and run the generator matching the control state, and the edge transition
      // to get the input and output sequences
      const gen = getGeneratorMappedTransitionFromEdge(genMap, edge);
      const _isTraversableEdge = isTraversableEdge(edge, graph, pathTraversalState, graphTraversalState);
      const { newPathTraversalState, newIsTraversableEdge } =
        computeNewPathTraversalState(fsm, edge, gen, extendedState, pathTraversalState, _isTraversableEdge);


      return {
        pathTraversalState: newPathTraversalState,
        isTraversableEdge: newIsTraversableEdge
      }
    }
  };
  const testCases = depthFirstTraverseGraphEdges(search, visit, startingVertex, fsmGraph);

  return testCases
}

// TODO : the returned path will have a history in some parts of the path keep it?

function computeNewPathTraversalState(fsm, edge, gen, extendedState, pathTraversalState, isTraversableEdge) {
  const { event: eventLabel, from: controlState, to: targetControlState, history } = edge;

  // Case 1 : control state is INIT_STATE and event is INIT_EVENT
  // Reminder : in INIT_STATE, the only event admissible is INIT_EVENT
  if (isInitState(controlState) && !isInitEvent(eventLabel)) {
    throw `computeNewPathTraversalState : cannot be in INIT_STATE and receive another event than INIT_EVENT! Check your fsm configuration!`
  }
  else if (isInitState(controlState) && isInitEvent(eventLabel)) {
    // In this case, the init event is manually sent
    // we have to generate the corresponding input
    return computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, gen, extendedState, pathTraversalState)
  }
  else if (!isInitState(controlState) && isInitEvent(eventLabel)) {
    // In this case, the init event is automatically and internally sent by the state machine
    // no need to generate inputs!
    return computeGeneratedInfoDoNothingCase(fsm, edge, isTraversableEdge, gen, extendedState, pathTraversalState)
  }
  // Case X : control state is not INIT_STATE and event is not INIT_EVENT
  // TODO : for now base case, we will add history here
  else if (!isInitState(controlState) && !isInitEvent(eventLabel)) {
    if (isEventless(eventLabel)) {
      return computeGeneratedInfoDoNothingCase(fsm, edge, isTraversableEdge, gen, extendedState, pathTraversalState)
    }
    else if (isHistoryStateEdge(edge)) {
      return computeGeneratedInfoHistoryStateCase(fsm, edge, isTraversableEdge, gen, extendedState, pathTraversalState)
    }
    else {
      // General case : not init state, not init event, not eventless, not history transition
      return computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, gen, extendedState, pathTraversalState)
    }
  }
}

function computeGeneratedInfoDoNothingCase(fsm, edge, isTraversableEdge, gen, extendedState, pathTraversalState) {
  const { event: eventLabel, from: controlState, to: targetControlState } = edge;
  const { path, inputSequence, outputSequence, controlStateSequence } = pathTraversalState;

  return {
    newIsTraversableEdge: true,
    newPathTraversalState: {
      inputSequence,
      // NOTE: reminder : intermediary states do not output!
      outputSequence,
      controlStateSequence: controlStateSequence.concat([targetControlState]),
      path: path.concat([edge])
    }
  }
}

function computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, gen, extendedState, pathTraversalState) {
  const { event: eventLabel, from: controlState, to: targetControlState } = edge;
  const { path, inputSequence, outputSequence, controlStateSequence } = pathTraversalState;
  const { input: newInputData, hasGeneratedInput } = gen(extendedState);
  let noMoreInput, newInputSequence, newOutputSequence, newControlStateSequence, newPath;

  if (!hasGeneratedInput) {
    noMoreInput = true;
    newInputSequence = inputSequence;
    newOutputSequence = outputSequence;
    newControlStateSequence = controlStateSequence;
    newPath = path;
  }
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

function computeGeneratedInfoHistoryStateCase(fsm, edge, isTraversableEdge, gen, extendedState, pathTraversalState) {
  // TODO
  // edge comes from the graph, so history prop will be set in edge
  // here we set the gen ourself, basically isTraversable as normal only if the history <- inputSequence is the `to`
  // might have to recompute the analyzeStates, or rather compute the history myself from inputSequence
  // beware of edge cases, transition must exit a state to be counted as history
  const { event: eventLabel, from: controlState, to: targetControlState, history } = edge;
  const { path, inputSequence, outputSequence, controlStateSequence } = pathTraversalState;
  const { input: newInputData, hasGeneratedInput } = gen(extendedState);
  let noMoreInput, newInputSequence, newOutputSequence, newControlStateSequence, newPath;

  const historyParentState = getHistoryParentState(history);
  const historyType = getHistoryType(history);
  const historyStateForParentState = computeHistoryState(historyType, historyParentState, inputSequence);

  if (historyStateForParentState !== historyParentState) {
    // We have an history edge for a parent state with a potential target state
    // However the input sequence gives an history state for that parent state that
    // is different from the potential target state! We invalidate the traversal of that edge
    return {
      newIsTraversableEdge: false,
      newPathTraversalState: pathTraversalState
    }
  }
  else {
    return computeGeneratedInfoBaseCase(fsm, edge, isTraversableEdge, gen, extendedState, pathTraversalState)
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
 * Returns the graph structure associated to the FSM
 * @param {FSM_Def} tracedFSM
 * @returns Graph
 */
export function convertFSMtoGraph(tracedFSM) {
  const { transitions, states } = tracedFSM;
  const vertices = Object.keys(getFsmStateList(states)).concat(INIT_STATE);
  const { statesAdjacencyList, statesLeafChildrenList } = analyzeStateTree(states);
  const edges = reduceTransitions((acc, transition, guardIndex, transitionIndex) => {
    const { from, event, to, action, predicate } = transition;

    if (isHistoryControlState(to)) {
      const historyParentState = getHistoryParentState(to);
      const partialTransitionRecord = { from, event, action, predicate, guardIndex, transitionIndex, history: to };
      if (isShallowHistory(to)) {
        // note : must be an array
        return acc.concat(merge(partialTransitionRecord, { to: statesAdjacencyList[historyParentState] }))
      }
      else if (isDeepHistory(to)) {
        return acc.concat(merge(partialTransitionRecord, { to: statesLeafChildrenList[historyParentState] }))
      }
      else throw `convertFSMtoGraph : found unrecognizable history control state!`
    }
    else {
      return acc.concat({ from, event, to, action, predicate, guardIndex, transitionIndex })
    }
  }, [], transitions);

  return constructGraph(graphSettings, edges, vertices)
}

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
        debugger
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

