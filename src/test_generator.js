// TODO import {depthFirstTraverseGraphEdges} from 'graph-adt'
import { depthFirstTraverseGraphEdges, constructGraph } from '../../graph-adt/src'
import { INIT_STATE } from "./properties"
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

function generateTestsFromFSM(fsm, generators, settings) {
  const tracedFSM = traceFSM({}, fsm);
  // associate a gen to from, event, guard index = the transition it is mapped
  const genMap = getGeneratorMapFromGeneratorMachine(generators);
  const { search } = settings;
  // build a graph from the tracedFSM
  const fsmGraph = convertFSMtoGraph(tracedFSM);
  // search that graph with the right parameters
  const startingEdge = makeFakeEdge(INIT_STATE);
  const visit = {
    initialEdgesPathState: { path: [], inputSequence: [], outputSequence: [], noMoreInput: false },
    visitEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      let noMoreInput = false;
      let newInputSequence;
      let newOutputSequence;
      // NOTE : edge is a transition of the state machine
      const { path, inputSequence, outputSequence } = pathTraversalState;
      // Execute the state machine with the input sequence to get it in the matching control state
      // Note that the machine has to be recreated each time, as it is a stateful object
      const fsm = create_state_machine(tracedFSM, fsmRxSettings);
      const tracedOutputSequence = inputSequence.map(fsm.yield);
      const { controlState, extendedState } = lastOf(tracedOutputSequence);
      const transition = getGeneratorMappedTransitionFromEdge(genMap, edge);
      // Then get and run the generator matching the control state, and the edge transition
      // to get the input and output sequences
      const gen = genMap(controlState, transition);
      const { input: newInput, hasGeneratedInput } = gen(extendedState);
      if (!hasGeneratedInput) {
        noMoreInput = true;
        newInputSequence = inputSequence;
        newOutputSequence = outputSequence;
      }
      else {
        newInputSequence = inputSequence.concat(newInput);
        const newOutput = fsm.yield(newInput);
        newOutputSequence = outputSequence.concat(newOutput);
        noMoreInput = false;
      }

      return {
        pathTraversalState: {
          path: path.concat([edge]),
          inputSequence: newInputSequence,
          outputSequence: newOutputSequence,
          noMoreInput
        },
        isTraversableEdge: !noMoreInput
      }
    }
  };
  const testCases = depthFirstTraverseGraphEdges(search, visit, startingEdge, fsmGraph);

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
    const {from, event, gen} = transition;
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
    const {from, event, to, action, predicate} = transition;
    return acc.concat({ from, event, to, action, predicate, guardIndex, transitionIndex })
  }, [], transitions);

  return constructGraph(graphSettings, edges, vertices)
}

function getGeneratorMappedTransitionFromEdge(genMap, edge) {
  // TODO : check edge case for starting edge where event, to etc. are not set!!
  return genMap.get(JSON.stringify(edge))
}

function makeFakeEdge(targetState) {
  return graphSettings.constructEdge(null, targetState)
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
 * @typedef {function (ExtendedState) : LabelledEvent | NoInput} InputGenerator generator which knows how to generate an
 * input, taking into account the extended state of the machine under test, after an input sequence has been run on
 * it. The generated input is generated so as to trigger a specific transition of the state machine. In the event,
 * it is not possible to generate the targeted transition of the state machine, the generator returns a value of
 * type `NoInput`.
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
