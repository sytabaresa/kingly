// TODO import {depthFirstTraverseGraphEdges} from 'graph-adt'
import { constructGraph, depthFirstTraverseGraphEdges } from '../../graph-adt/src'
import { ACTION_IDENTITY, INIT_EVENT, INIT_STATE } from "./properties"
import { getFsmStateList, lastOf, reduceTransitions } from "./helpers"
import * as Rx from "rx"
import { create_state_machine, traceFSM } from "./synchronous_fsm"

const $ = Rx.Observable;

const fsmRxSettings = {
  subject_factory: () => {
    const subject = new Rx.Subject();
    // NOTE : this is intended for Rxjs v4-5!! but should work for most also
    subject.emit = subject.next || subject.onNext;
    return subject
  },
  merge: function merge(arrayObs) {return $.merge(...arrayObs)},
  of: $.of,
};

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
      const {inputSequence, outputSequence, controlStateSequence} = pathTraversalState;
      const newResults = bIsGoalReached
        ? results.concat([{inputSequence, outputSequence, controlStateSequence}])
        : results;
      const newGraphTraversalState = { results: newResults };

      return {
        isGoalReached: bIsGoalReached,
        graphTraversalState: newGraphTraversalState
      }
    },
  };
  // TODO : no!! should not have to do that, it should be in gen!! to generate the input!!
  const visit = {
    initialPathTraversalState: { path: [], controlStateSequence :[INIT_STATE], inputSequence: [], outputSequence: [], noMoreInput: false },
    visitEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      let noMoreInput = false;
      let newInputSequence, newOutputSequence, newControlStateSequence, newPath;
      // NOTE : edge is a transition of the state machine
      const {event: eventLabel} = edge;
      const { path, inputSequence, outputSequence, controlStateSequence } = pathTraversalState;
      // Execute the state machine with the input sequence to get it in the matching control state
      // Note that the machine has to be recreated each time, as it is a stateful object
      const fsm = create_state_machine(tracedFSM, fsmRxSettings);
      const extendedState = inputSequence.length === 0
        // Edge case : we are in INIT_STATE, the init event has the initial extended state as event data
      ? initial_extended_state
        // Main case : we run the sequence of inpus and
        // we take the extended state of the machine at the end of the run
        : lastOf(inputSequence.map(fsm.yield)).newExtendedState;
      // Then get and run the generator matching the control state, and the edge transition
      // to get the input and output sequences
      const gen = getGeneratorMappedTransitionFromEdge(genMap, edge)
      const { input: newInputData, hasGeneratedInput } = gen(extendedState);
      if (!hasGeneratedInput) {
        noMoreInput = true;
        newInputSequence = inputSequence;
        newOutputSequence = outputSequence;
        newControlStateSequence = controlStateSequence;
        newPath = path;
      }
      else {
        const newInput = {[eventLabel]: newInputData};
        newInputSequence = inputSequence.concat([newInput]);
        const newOutput = fsm.yield(newInput);
        const {output: untracedOutput, targetControlState} = newOutput;
        newOutputSequence = outputSequence.concat(untracedOutput);
        newControlStateSequence = controlStateSequence.concat([targetControlState]);
        newPath = path.concat([edge]);
        noMoreInput = false;
      }

      return {
        pathTraversalState: {
          path: newPath,
          inputSequence: newInputSequence,
          outputSequence: newOutputSequence,
          controlStateSequence : newControlStateSequence,
          noMoreInput
        },
        isTraversableEdge: !noMoreInput && isTraversableEdge(edge, graph, pathTraversalState, graphTraversalState)
      }
    }
  };
  const testCases = depthFirstTraverseGraphEdges(search, visit, startingVertex, fsmGraph);

  return testCases
}

/**
 * from, event, index : CONTRACT : all transition from `from` triggered by `event` must be defined together in the
 * same record
 * TODO : write the contract when creating the state machine
 // DOC : contract, all transition for a (from, event) must be gathered in one place
 * CONTRACT : cannot have the same predicate for a same (from, event) as is logical, the second is contracdictory or
 * redundant
 * CONTRACT : predicate MUST be defined if in a guard !
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
  const { transitions } = tracedFSM;
  const vertices = Object.keys(getFsmStateList(tracedFSM)).concat(INIT_STATE);
  const edges = reduceTransitions((acc, transition, guardIndex, transitionIndex) => {
    const { from, event, to, action, predicate } = transition;
    return acc.concat({ from, event, to, action, predicate, guardIndex, transitionIndex })
  }, [], transitions);

  return constructGraph(graphSettings, edges, vertices)
}

function getGeneratorMappedTransitionFromEdge(genMap, edge) {
  // TODO : check edge case for starting edge where event, to etc. are not set!!
  const { from, event, guardIndex } = edge;
  return genMap.get(JSON.stringify({ from, event, guardIndex }))
}

function makeStartingEdge() {
  return {
    from: null,
    event: INIT_EVENT,
    guardIndex: 0,
    transitionIndex: 0,
    to: INIT_STATE,
    predicate: undefined,
    action: ACTION_IDENTITY
  }
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

