import * as QUnit from "qunitjs"
import {
  ACTION_IDENTITY, createStateMachine, decorateWithEntryActions, INIT_EVENT, INIT_STATE, mergeOutputsFn
} from "../src"
import { applyJSONpatch } from "./helpers"

const default_settings = {
  updateState: applyJSONpatch,
};
const debug_settings = Object.assign({}, default_settings, {
  debug: {
    checkContracts: true,
    console
  }
});

function setEntryActionForC() {
  return {
    outputs: [{ c: true }],
    updates: [{ op: 'add', path: '/c', value: true }]
  }
}

const errorString = `An error occurred`;
const invalidAction = {};
const invalidEntryAction = {};
const throwingAction = function () {throw errorString};
const factoryReturningInvalidAction = function () {return invalidAction};
const factoryReturningInvalidEntryAction = function () {return invalidEntryAction };
const throwingEntryAction = function () {throw  errorString};

QUnit.module("Testing error capture in user-provided functions", {});

QUnit.test("Transition action factory error - throws", function exec_test(assert) {
  const fsmDef = {
    states: { A: { C: '' }, B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev', action: throwingAction },
    ],
    initialExtendedState: {},
    settings: debug_settings,
  };

  const fsm = createStateMachine(fsmDef);

  assert.throws(
    () => fsm({ ev: void 0 }),
    err => err.info.actionName === 'throwingAction',
    `Error message identifies throwing action factory`
  );
});

QUnit.test("Transition action factory error - throws", function exec_test(assert) {
  const fsmDef = {
    states: { A: { C: '' }, B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev', action: factoryReturningInvalidAction },
    ],
    initialExtendedState: {},
    settings: debug_settings,
  };

  const fsm = createStateMachine(fsmDef);

  assert.throws(() => fsm({ ev: void 0 }), /factoryReturningInvalidAction/, `Error message identifies throwing action factory`);
});

QUnit.test("Entry action factory error", function exec_test(assert) {
  const fsmDef = {
    states: { A: { C: '' }, B: '' },
    events: ['ev1'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev1', action: ACTION_IDENTITY },
      { from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initialExtendedState: { standard: true },
    settings: debug_settings,
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
  const fsm = createStateMachine(fsmDefWithEntryActions);

  assert.throws(
    () => fsm({ 'ev1': void 0 }),
    err => err.info[1].actionName === 'throwingEntryAction',
    `Entry actions throwing are identified separately`
  );
});

// TODO: I am here
QUnit.test("Entry action factory error - returns invalid action", function exec_test(assert) {
  const fsmDef = {
    states: { A: { C: '' }, B: '' },
    events: ['ev1'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev1', action: ACTION_IDENTITY },
      { from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initialExtendedState: { standard: true },
    settings: debug_settings,
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
  const fsm = createStateMachine(fsmDefWithEntryActions);

  assert.throws(
    () => fsm({ 'ev1': void 0 }),
    err => err.info[1].actionName === 'throwingEntryAction',
    `Entry actions returning invalid actions are identified separately`
  );
});
