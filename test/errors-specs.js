import * as QUnit from "qunitjs"
import {
  ACTION_IDENTITY, createStateMachine, decorateWithEntryActions, INIT_EVENT, INIT_STATE, KinglyError, mergeOutputsFn
} from "../src"
import {applyJSONpatch} from "./helpers"
import {fsmContracts} from "../src/contracts"

const default_settings = {};
const debug_settings = Object.assign({}, default_settings, {
  debug: {
    checkContracts: fsmContracts,
    console
  }
});

function setEntryActionForC() {
  return {
    outputs: [{c: true}],
    updates: [{op: 'add', path: '/c', value: true}]
  }
}

const errorString = `An error occurred`;
const invalidAction = {};
const invalidEntryAction = {};
const throwingAction = function () {
  throw errorString
};
const factoryReturningInvalidAction = function () {
  return invalidAction
};
const factoryReturningInvalidEntryAction = function () {
  return invalidEntryAction
};
const throwingEntryAction = function () {
  throw  errorString
};
const invalidReturningPredicate = () => {
}
const throwingPredicate = () => {
  throw errorString
}

QUnit.module("Testing error capture in user-provided functions", {});

QUnit.test("Transition action factory error - throws", function exec_test(assert) {
  const fsmDef = {
    states: {A: {C: ''}, B: ''},
    events: ['ev'],
    transitions: [
      {from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'C', to: 'B', event: 'ev', action: throwingAction},
    ],
    initialExtendedState: {},
    updateState: applyJSONpatch,
  };

  const fsm = createStateMachine(fsmDef, debug_settings);
  assert.ok(
    fsm({ev: void 0}) instanceof KinglyError,
    `No throwing, a KinglyError object is returned`
  );
});

QUnit.test("Transition action factory error - returns invalid action", function exec_test(assert) {
  const fsmDef = {
    states: {A: {C: ''}, B: ''},
    events: ['ev'],
    transitions: [
      {from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'C', to: 'B', event: 'ev', action: factoryReturningInvalidAction},
    ],
    initialExtendedState: {},
    updateState: applyJSONpatch,
  };

  const fsm = createStateMachine(fsmDef, debug_settings);
  assert.ok(fsm({ev: void 0}) instanceof KinglyError, `KinglyError thrown`);
});

// TODO: remove no more entry actions
QUnit.skip("Entry action factory error", function exec_test(assert) {
  const fsmDef = {
    states: {A: {C: ''}, B: ''},
    events: ['ev1'],
    transitions: [
      {from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'C', to: 'B', event: 'ev1', action: ACTION_IDENTITY},
      {from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY}
    ],
    initialExtendedState: {standard: true},
    updateState: applyJSONpatch,
  };
  const entryActions = {
    // NOTE : per contract, we can't put an non-empty action on the initial control state
    // The extended state would be updated, but there would be no way to observe the output
    // for that transition
    // A: setEntryActionForA,
    B: throwingEntryAction,
    C: setEntryActionForC,
  };
  const fsmDefWithEntryActions = decorateWithEntryActions(fsmDef, entryActions, mergeOutputsFn);
  const fsm = createStateMachine(fsmDefWithEntryActions, debug_settings);

  assert.throws(
    () => fsm({'ev1': void 0}),
    err => err.info[0].fnName === 'throwingEntryAction',
    `Entry actions throwing are identified separately`
  );
});

QUnit.skip("Entry action factory error - returns invalid action", function exec_test(assert) {
  const fsmDef = {
    states: {A: {C: ''}, B: ''},
    events: ['ev1'],
    transitions: [
      {from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'C', to: 'B', event: 'ev1', action: ACTION_IDENTITY},
      {from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY}
    ],
    initialExtendedState: {standard: true},
    updateState: applyJSONpatch,
  };
  const entryActions = {
    // NOTE : per contract, we can't put an non-empty action on the initial control state
    // The extended state would be updated, but there would be no way to observe the output
    // for that transition
    // A: setEntryActionForA,
    B: factoryReturningInvalidEntryAction,
    C: setEntryActionForC,
  };
  const fsmDefWithEntryActions = decorateWithEntryActions(fsmDef, entryActions, mergeOutputsFn);
  const fsm = createStateMachine(fsmDefWithEntryActions, debug_settings);

  assert.throws(
    () => fsm({'ev1': void 0}),
    err => err.info[0].fnName === 'factoryReturningInvalidEntryAction',
    `Entry actions returning invalid actions are identified separately`
  );
});

QUnit.test("Guard error - throws", function exec_test(assert) {
  const fsmDef = {
    states: {A: {C: ''}, B: ''},
    events: ['ev'],
    transitions: [
      {from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'C', event: 'ev', guards: [{predicate: throwingPredicate, to: 'B', action: ACTION_IDENTITY}]},
    ],
    initialExtendedState: {},
    updateState: applyJSONpatch,
  };

  const fsm = createStateMachine(fsmDef, debug_settings);

  assert.ok(fsm({ev: void 0}) instanceof KinglyError, `KinglyError thrown`);
});

QUnit.test("Guard error - returns non boolean", function exec_test(assert) {
  const fsmDef = {
    states: {A: {C: ''}, B: ''},
    events: ['ev'],
    transitions: [
      {from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'C', event: 'ev', guards: [{predicate: invalidReturningPredicate, to: 'B', action: ACTION_IDENTITY}]},
    ],
    initialExtendedState: {},
    updateState: applyJSONpatch,
  };

  const fsm = createStateMachine(fsmDef, debug_settings);

  assert.ok(fsm({ev: void 0}) instanceof KinglyError, `KinglyError thrown`);
});

QUnit.test("Update state function error - throws", function exec_test(assert) {
  const fsmDef = {
    states: {A: {C: ''}, B: ''},
    events: ['ev'],
    transitions: [
      {from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY},
      {from: 'C', event: 'ev', guards: [{predicate: throwingPredicate, to: 'B', action: ACTION_IDENTITY}]},
    ],
    initialExtendedState: {},
    updateState: function throwingUpdateState() {
      throw errorString
    },
  };
  assert.ok(createStateMachine(fsmDef, debug_settings) instanceof KinglyError, `KinglyError thrown`);
});
