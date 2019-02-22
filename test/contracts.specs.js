import * as QUnit from "qunitjs"
import { ACTION_IDENTITY, INIT_EVENT, INIT_STATE } from "../src"
import {
  allStateTransitionsOnOneSingleRow,
  atLeastOneState, fsmContractChecker, initEventOnlyInCompoundStates, noDuplicatedStates, noReservedStates,
  validEventLessTransitions,
  validInitialTransition, validInitialTransitionForCompoundState
} from "../src/contracts"
import { applyJSONpatch, formatResult } from "./helpers"

const default_settings = {
  updateState: applyJSONpatch,
};

QUnit.module("Testing contract checking", {});

QUnit.test("fsmContracts(fsmDef, settings): duplicate states", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const duplicateContractFailureInfo = failingContracts.find(x => x.name === noDuplicatedStates.name);
  const { message, info } = duplicateContractFailureInfo;
  const { duplicatedStates } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(duplicatedStates, ['B'], `A control state hierarchy should not contain any duplicate control states`);
});

QUnit.test("fsmContracts(fsmDef, settings): reserved states", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '', [INIT_STATE]: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === noReservedStates.name);
  const { message, info } = failureInfo;
  const { statesType } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(Object.keys(statesType), ['A', 'B', INIT_STATE], `A user-defined control state cannot be a reserved control state`);
});

QUnit.test("fsmContracts(fsmDef, settings): at least one state", function exec_test(assert) {
  const fsmDef = {
    states: {},
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === atLeastOneState.name);
  const { message, info } = failureInfo;
  const { statesType } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(Object.keys(statesType), [], message);
});

QUnit.test("fsmContracts(fsmDef, settings): two initial transitions", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: INIT_STATE, to: 'B', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === validInitialTransition.name);
  const { message, info } = failureInfo;
  const { initTransition, initTransitions, initialControlState } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(initTransitions.length, 2, message);
});

QUnit.test("fsmContracts(fsmDef, settings): compound states - no init transition", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: { D: '' } },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === validInitialTransitionForCompoundState.name);
  const { message, info } = failureInfo;
  const { hasEntryTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(hasEntryTransitions, [
    { "A": false },
    { "C": true }
  ], message);
});

QUnit.test("fsmContracts(fsmDef, settings): compound states - invalid init transition", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, guards: [{ to: 'B', action: ACTION_IDENTITY, predicate: () => true }] }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === validInitialTransitionForCompoundState.name);
  const { message, info } = failureInfo;
  const { entryTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(entryTransitions.map(formatResult), [
    {
      "event": "init",
      "from": "A",
      "guards": [
        {
          "action": "ACTION_IDENTITY",
          "predicate": "predicate",
          "to": "B"
        }
      ]
    }
  ], message);
});

QUnit.test("fsmContracts(fsmDef, settings): compound states - invalid init transition - target states not within" +
  " hierarchy", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'C', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === validInitialTransitionForCompoundState.name);
  const { message, info } = failureInfo;
  const { entryTransitions, statesPath } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(entryTransitions.map(formatResult), [
    {
      "action": "ACTION_IDENTITY",
      "event": "init",
      "from": "A",
      "to": "C"
    }
  ], message);
  assert.deepEqual(statesPath, {
    "A": "0.0",
    "B": "0.0.0",
    "C": "0.1"
  }, message);
});

QUnit.test("fsmContracts(fsmDef, settings): compound states - invalid init transition - target states not within" +
  " hierarchy - same origin and target", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'A', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === validInitialTransitionForCompoundState.name);
  const { message, info } = failureInfo;
  const { entryTransitions, statesPath } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(entryTransitions.map(formatResult), [
    {
      "action": "ACTION_IDENTITY",
      "event": "init",
      "from": "A",
      "to": "A"
    }
  ], message);
  assert.deepEqual(statesPath, {
    "A": "0.0",
    "B": "0.0.0",
    "C": "0.1"
  }, message);
});

QUnit.test(`fsmContracts(fsmDef, settings): init events only in compound states `, function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === initEventOnlyInCompoundStates.name);
  const { message, info } = failureInfo;
  const { initTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(initTransitions.map(formatResult), [
    {
      "B": {
        "action": "ACTION_IDENTITY",
        "event": "init",
        "from": "B",
        "to": "C"
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef, settings): valid eventless transitions`, function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'C', event: void 0, action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === validEventLessTransitions.name);
  const { message, info } = failureInfo;
  const { failingOriginControlStates } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(failingOriginControlStates.map(formatResult), [
    {
      "B": true
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef, settings): all state transitions defined in one row`, function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'C', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {}
  };
  const settings = default_settings;
  debugger
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, settings);
  const failureInfo = failingContracts.find(x => x.name === allStateTransitionsOnOneSingleRow.name);
  const { message, info } = failureInfo;
  const { statesTransitionsInfo } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(statesTransitionsInfo, {
    "B": [
      "anything"
    ]
  }, message);
});
