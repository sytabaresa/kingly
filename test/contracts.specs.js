import * as QUnit from "qunitjs"
import { ACTION_IDENTITY, INIT_EVENT, INIT_STATE } from "../src"
import { applyJSONpatch } from "./fsm_trace.specs"
import {
  atLeastOneState, fsmContractChecker, noDuplicatedStates, noReservedStates, validInitialTransition
} from "../src/contracts"

const default_settings = {
  updateState : applyJSONpatch,
};

QUnit.module("Testing contract checking", {});

QUnit.test("fsmContracts(fsmDef, settings): duplicate states", function exec_test(assert) {
  const fsmDef = {
    states: { A: {B:''} , B:''},
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const {isFulfilled, failingContracts} = fsmContractChecker(fsmDef, settings);
  const duplicateContractFailureInfo = failingContracts.find(x => x.name === noDuplicatedStates.name);
  const {message, info} = duplicateContractFailureInfo;
  const {duplicatedStates} = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(duplicatedStates, ['B'], `A control state hierarchy should not contain any duplicate control states`);
});

QUnit.test("fsmContracts(fsmDef, settings): reserved states", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' , B:'', [INIT_STATE]:''},
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const {isFulfilled, failingContracts} = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === noReservedStates.name);
  const {message, info} = failureInfo;
  const {stateList} = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(stateList, ['A', 'B', INIT_STATE], `A user-defined control state cannot be a reserved control state`);
});

QUnit.test("fsmContracts(fsmDef, settings): at least one state", function exec_test(assert) {
  const fsmDef = {
    states: { },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const {isFulfilled, failingContracts} = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === atLeastOneState.name);
  const {message, info} = failureInfo;
  const {stateList} = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(stateList, [], message);
});

QUnit.test("fsmContracts(fsmDef, settings): two initial transitions", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B:''},
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: INIT_STATE, to: 'B', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const {isFulfilled, failingContracts} = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === validInitialTransition.name);
  const {message, info} = failureInfo;
  const {initTransition, initTransitions, initialControlState} = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(initTransitions.length, 2, message);
});
