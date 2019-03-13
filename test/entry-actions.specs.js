import * as QUnit from "qunitjs"
import {omit} from "ramda"
import {
  ACTION_IDENTITY, create_state_machine, decorateWithEntryActions, INIT_EVENT, INIT_STATE, mergeOutputsFn, traceFSM
} from "../src"
import { applyJSONpatch, formatResult } from "./helpers"
import { fsmContracts } from "../src/contracts"

const default_settings = {
  debug: { checkContracts: fsmContracts }
};

function removeDebugSettings(output){
  if (output.settings){
    return Object.assign({}, output, {settings : omit(['debug'], output.settings)})
  }
  else {
    return output
  }
}

function setEntryActionForD() {
  return {
    outputs: [{ d: true }],
    updates: [{ op: 'add', path: '/d', value: true }]
  }
}

function setEntryActionForC() {
  return {
    outputs: [{ c: true }],
    updates: [{ op: 'add', path: '/c', value: true }]
  }
}

function setEntryActionForB() {
  return {
    outputs: [{ b: true }],
    updates: [{ op: 'add', path: '/b', value: true }]
  }
}

function setEntryActionForA() {
  return {
    outputs: [{ a: true }],
    updates: [{ op: 'add', path: '/a', value: 'test' }]
  }
}

function setDummy() {
  return {
    outputs: [{ dummy: true }],
    updates: [{ op: 'add', path: '/dummy', value: 'dummy' }]
  }
}


QUnit.module("Testing entry actions", {});

QUnit.test("decorateWithEntryActions(fsm, entryActions, mergeOutputs): entry actions with and without normal actions", function exec_test(assert) {
  const fsmDef = {
    states: { A: { C: '' }, B: '', D: '' },
    events: ['ev1', 'ev2'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'D', event: 'ev2', action: setDummy },
      { from: 'C', to: 'B', event: 'ev1', action: ACTION_IDENTITY },
      { from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initialExtendedState: { standard: true },
    updateState: applyJSONpatch,
    settings: default_settings,
  };
  const entryActions = {
    // NOTE : per contract, we can't put an non-empty action on the initial control state
    // The extended state would be updated, but there would be no way to observe the output
    // for that transition
    // A: setEntryActionForA,
    B: setEntryActionForB,
    C: setEntryActionForC,
    D: setEntryActionForD,
  };
  const fsmDefWithEntryActions = decorateWithEntryActions(fsmDef, entryActions, mergeOutputsFn);
  const tracedFsmDef = traceFSM({}, fsmDefWithEntryActions);
  const tracedFsm = create_state_machine(tracedFsmDef);
  const output1 = tracedFsm({'ev1': void 0});
  const output2 = tracedFsm({'ev2': void 0});

  assert.deepEqual(output1.map(formatResult).map(removeDebugSettings), [
    {
      "actionFactory": "decoratedAction",
      "controlState": "C",
      "event": {
        "eventData": undefined,
        "eventLabel": "ev1"
      },
      "extendedState": {
        "c": true,
        "standard": true
      },
      "guardIndex": 0,
      "newExtendedState": {
        "b": true,
        "c": true,
        "standard": true
      },
      "outputs": [
        null,
        {
          "b": true
        }
      ],
      "predicate": undefined,
      "settings": {

      },
      "targetControlState": "B",
      "transitionIndex": 2,
      "updates": [
        {
          "op": "add",
          "path": "/b",
          "value": true
        }
      ]
    }
  ], `Entry actions are executed AFTER actions for the transitions`);
  assert.deepEqual(output2.map(formatResult).map(removeDebugSettings), [
    {
      "actionFactory": "decoratedAction",
      "controlState": "B",
      "event": {
        "eventData": undefined,
        "eventLabel": "ev2"
      },
      "extendedState": {
        "b": true,
        "c": true,
        "standard": true
      },
      "guardIndex": 0,
      "newExtendedState": {
        "b": true,
        "c": true,
        "d": true,
        "dummy": "dummy",
        "standard": true
      },
      "outputs": [
        {
          "dummy": true
        },
        {
          "d": true
        }
      ],
      "predicate": undefined,
      "settings": {

      },
      "targetControlState": "D",
      "transitionIndex": 1,
      "updates": [
        {
          "op": "add",
          "path": "/dummy",
          "value": "dummy"
        },
        {
          "op": "add",
          "path": "/d",
          "value": true
        }
      ]
    }
  ], `Outputs from the transition actions and entry actions are merged in that order. The extended state is updated also in that order.`);
});

// This is an edge case excluded by contract. However the contract is not enforced. We write but skip that test for
// later usage
QUnit.skip("decorateWithEntryActions(fsm, entryActions, mergeOutputs): EDGE case - entry actions with and without" +
  " normal actions, AND entry actions for initial control state", function exec_test(assert) {
  const fsmDef = {
    states: { A: { C: '' }, B: '', D: '' },
    events: ['ev1', 'ev2'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'D', event: 'ev2', action: setDummy },
      { from: 'C', to: 'B', event: 'ev1', action: ACTION_IDENTITY },
      { from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initialExtendedState: { standard: true },
    settings: default_settings,
  };
  const entryActions = {
    // NOTE : per contract, we can't put an non-empty action on the initial control state
    // The extended state would be updated, but there would be no way to observe the output
    // for that transition
    A: setEntryActionForA,
    B: setEntryActionForB,
    C: setEntryActionForC,
    D: setEntryActionForD,
  };
  const fsmDefWithEntryActions = decorateWithEntryActions(fsmDef, entryActions, mergeOutputsFn);
  const tracedFsmDef = traceFSM({}, fsmDefWithEntryActions);
  const tracedFsm = create_state_machine(tracedFsmDef);
  const output1 = tracedFsm({'ev1': void 0});
  const output2 = tracedFsm({'ev2': void 0});

  assert.deepEqual(output1.map(formatResult).map(removeDebugSettings), [
    {
      "actionFactory": "decoratedAction",
      "controlState": "C",
      "event": {
        "eventData": undefined,
        "eventLabel": "ev1"
      },
      "extendedState": {
        "c": true,
        "standard": true
      },
      "guardIndex": 0,
      "newExtendedState": {
        "b": true,
        "c": true,
        "standard": true
      },
      "outputs": [
        null,
        {
          "b": true
        }
      ],
      "predicate": undefined,
      "settings": {
        "debug": {
          "checkContracts": true
        },
        "updateState": "applyJSONpatch"
      },
      "targetControlState": "B",
      "transitionIndex": 2,
      "updates": [
        {
          "op": "add",
          "path": "/b",
          "value": true
        }
      ]
    }
  ], `Entry actions are executed AFTER actions for the transitions`);
  assert.deepEqual(output2.map(formatResult).map(removeDebugSettings), [
    {
      "actionFactory": "decoratedAction",
      "controlState": "B",
      "event": {
        "eventData": undefined,
        "eventLabel": "ev2"
      },
      "extendedState": {
        "b": true,
        "c": true,
        "standard": true
      },
      "guardIndex": 0,
      "newExtendedState": {
        "b": true,
        "c": true,
        "d": true,
        "dummy": "dummy",
        "standard": true
      },
      "outputs": [
        {
          "dummy": true
        },
        {
          "d": true
        }
      ],
      "predicate": undefined,
      "settings": {
        "debug": {
          "checkContracts": true
        },
        "updateState": "applyJSONpatch"
      },
      "targetControlState": "D",
      "transitionIndex": 1,
      "updates": [
        {
          "op": "add",
          "path": "/dummy",
          "value": "dummy"
        },
        {
          "op": "add",
          "path": "/d",
          "value": true
        }
      ]
    }
  ], `Outputs from the transition actions and entry actions are merged in that order. The extended state is updated also in that order.`);
});
