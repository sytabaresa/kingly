import * as QUnit from "qunitjs"
import { ACTION_IDENTITY, DEEP, historyState, INIT_EVENT, INIT_STATE } from "../src"
import {
  allStateTransitionsOnOneSingleRow, areEventsDeclared, areStatesDeclared, atLeastOneState, fsmContractChecker,
  fsmContracts,
  haveTransitionsValidTypes, initEventOnlyInCompoundStates, isHistoryStatesCompoundStates, isHistoryStatesExisting,
  isHistoryStatesTargetStates, isInitialControlStateDeclared, isInitialStateOriginState, isValidSelfTransition,
  isValidSettings,
  noConflictingTransitionsWithAncestorState, noDuplicatedStates, noReservedStates, validEventLessTransitions,
  validInitialTransition, validInitialTransitionForCompoundState
} from "../src/contracts"
import { applyJSONpatch, formatResult } from "./helpers"

const default_settings = {
  updateState: applyJSONpatch,
};

QUnit.module("Testing contract checking", {});

QUnit.test("fsmContracts(fsmDef): duplicate states", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const duplicateContractFailureInfo = failingContracts.find(x => x.name === noDuplicatedStates.name);
  const { message, info } = duplicateContractFailureInfo;
  const { duplicatedStates } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(duplicatedStates, ['B'], `A control state hierarchy should not contain any duplicate control states`);
});

QUnit.test("fsmContracts(fsmDef): reserved states", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '', [INIT_STATE]: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === noReservedStates.name);
  const { message, info } = failureInfo;
  const { statesType } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(Object.keys(statesType), ['A', 'B', INIT_STATE], `A user-defined control state cannot be a reserved control state`);
});

QUnit.test("fsmContracts(fsmDef): at least one state", function exec_test(assert) {
  const fsmDef = {
    states: {},
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === atLeastOneState.name);
  const { message, info } = failureInfo;
  const { statesType } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(Object.keys(statesType), [], message);
});

QUnit.test("fsmContracts(fsmDef): two initial transitions", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: INIT_STATE, to: 'B', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === validInitialTransition.name);
  const { message, info } = failureInfo;
  const { initTransition, initTransitions, initialControlState } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(initTransitions.length, 2, message);
});

QUnit.test("fsmContracts(fsmDef): compound states - no init transition", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: { D: '' } },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === validInitialTransitionForCompoundState.name);
  const { message, info } = failureInfo;
  const { hasEntryTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(hasEntryTransitions, [
    { "A": false },
    { "C": true }
  ], message);
});

QUnit.test("fsmContracts(fsmDef): compound states - invalid init transition", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, guards: [{ to: 'B', action: ACTION_IDENTITY, predicate: () => true }] }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
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

QUnit.test("fsmContracts(fsmDef): compound states - invalid init transition - target states not within" +
  " hierarchy", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'C', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
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

QUnit.test("fsmContracts(fsmDef): compound states - invalid init transition - target states not within" +
  " hierarchy - same origin and target", function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'A', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
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

QUnit.test(`fsmContracts(fsmDef): init events only in compound states `, function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
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

QUnit.test(`fsmContracts(fsmDef): valid eventless transitions`, function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'C', event: void 0, action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
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

QUnit.test(`fsmContracts(fsmDef): all state transitions defined in one row`, function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'C', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
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

QUnit.test(`fsmContracts(fsmDef): no conflicting transition between two control states hierarchically related`, function exec_test(assert) {
  const fsmDef = {
    states: { A: { B: '' }, C: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'C', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === noConflictingTransitionsWithAncestorState.name);
  const { message, info } = failureInfo;
  const { eventTransitionsInfo } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(eventTransitionsInfo, {
    "anything": [
      {
        "B": "A"
      }
    ]
  }, message);
});

QUnit.test(`fsmContracts(fsmDef): no history pseudo state can be an origin state`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: historyState(DEEP, 'A'), to: 'C', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === isHistoryStatesTargetStates.name);
  const { message, info } = failureInfo;
  const { wrongHistoryStates } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongHistoryStates.map(formatResult), [
    {
      "action": "ACTION_IDENTITY",
      "event": "anything",
      "from": {
        "deep": "A"
      },
      "to": "C"
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): no history pseudo state can be an atomic state`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: historyState(DEEP, 'B'), event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === isHistoryStatesCompoundStates.name);
  const { message, info } = failureInfo;
  const { wrongHistoryStates } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongHistoryStates.map(formatResult), [
    {
      "action": "ACTION_IDENTITY",
      "event": "anything",
      "from": "C",
      "to": {
        "deep": "B"
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): history pseudo state has to refer to a known state`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: historyState(DEEP, 'X'), event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === isHistoryStatesExisting.name);
  const { message, info } = failureInfo;
  const { invalidTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(invalidTransitions.map(formatResult), [
    {
      "flatTransitions": [
        {
          "action": "ACTION_IDENTITY",
          "event": "anything",
          "from": "C",
          "predicate": undefined,
          "to": {
            "deep": "X"
          }
        }
      ],
      "historyState": "X"
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): initial control state is a declared control state`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    initialControlState: 'X',
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === isInitialControlStateDeclared.name);
  const { message, info } = failureInfo;
  const { initialControlState } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(initialControlState, "X", message);
});

QUnit.test(`fsmContracts(fsmDef): events figuring in transition must be declared and vice versa`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    initialControlState: 'X',
    states,
    events: ['ev', 'xomething'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === areEventsDeclared.name);
  const { message, info } = failureInfo;
  const { eventsDeclaredButNotTriggeringTransitions, eventsNotDeclaredButTriggeringTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(eventsDeclaredButNotTriggeringTransitions, [
    "xomething"
  ], message);
  assert.deepEqual(eventsNotDeclaredButTriggeringTransitions, [
    "anything"
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): states figuring in transition must be declared and vice versa`, function exec_test(assert) {
  const states = { A: '', C: '' };
  const fsmDef = {
    initialControlState: 'X',
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'X', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'X', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === areStatesDeclared.name);
  const { message, info } = failureInfo;
  const { statesDeclaredButNotTriggeringTransitions, statesNotDeclaredButTriggeringTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(statesDeclaredButNotTriggeringTransitions, [
    "C"
  ], message);
  assert.deepEqual(statesNotDeclaredButTriggeringTransitions, [
    "B",
    "X"
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): valid settings have an update state function`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === isValidSettings.name);
  const { message, info } = failureInfo;
  const { settings } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(settings, undefined, message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - inconditional transition - from`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: {}, to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 1,
      "transition": {
        "action": "ACTION_IDENTITY",
        "event": "anything",
        "from": {},
        "to": "A"
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - inconditional transition - event`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'A', event: void 0, action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 2,
      "transition": {
        "action": "ACTION_IDENTITY",
        "event": undefined,
        "from": "B",
        "to": "A"
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - inconditional transition - to`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 2, event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 2,
      "transition": {
        "action": "ACTION_IDENTITY",
        "event": "ev",
        "from": "B",
        "to": 2
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - inconditional transition - action`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', to: 'C', event: 'ev' },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 2,
      "transition": {
        "event": "ev",
        "from": "B",
        "to": "C"
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - conditional transition - from`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: {}, event: 'anything', guards: [{ to: 'A', action: ACTION_IDENTITY, predicate: () => {} }] },
      { from: 'B', to: 'A', event: 'ev', action: ACTION_IDENTITY },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 1,
      "transition": {
        "event": "anything",
        "from": {},
        "guards": [
          {
            "action": "ACTION_IDENTITY",
            "predicate": "predicate",
            "to": "A"
          }
        ]
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - conditional transition - event`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', event: void 0, guards: [{ to: 'A', action: ACTION_IDENTITY, predicate: () => {} }] },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 2,
      "transition": {
        "event": undefined,
        "from": "B",
        "guards": [
          {
            "action": "ACTION_IDENTITY",
            "predicate": "predicate",
            "to": "A"
          }
        ]
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - conditional transition - to`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', event: 'ev', guards: [{ to: 2, action: ACTION_IDENTITY, predicate: () => {} }] },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 2,
      "transition": {
        "event": "ev",
        "from": "B",
        "guards": [
          {
            "action": "ACTION_IDENTITY",
            "predicate": "predicate",
            "to": 2
          }
        ]
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - conditional transition - action`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', event: 'ev', guards: [{ to: 'C', predicate: () => {} }] },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 2,
      "transition": {
        "event": "ev",
        "from": "B",
        "guards": [
          {
            "predicate": "predicate",
            "to": "C"
          }
        ]
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - conditional transition - guards []`, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', event: 'ev', guards: [] },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 2,
      "transition": {
        "event": "ev",
        "from": "B",
        "guards": []
      }
    }
  ], message);
});

QUnit.test(`fsmContracts(fsmDef): configured transition have valid format - conditional transition - guards - predicate `, function exec_test(assert) {
  const states = { A: { B: '' }, C: '' };
  const fsmDef = {
    states,
    events: ['ev', 'anything'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'C', to: 'A', event: 'anything', action: ACTION_IDENTITY },
      { from: 'B', event: 'ev', guards: [{ to: 'A', action: ACTION_IDENTITY }] },
      { from: 'A', event: INIT_EVENT, to: 'B', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };
  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === haveTransitionsValidTypes.name);
  const { message, info } = failureInfo;
  const { wrongTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongTransitions.map(formatResult), [
    {
      "index": 2,
      "transition": {
        "event": "ev",
        "from": "B",
        "guards": [
          {
            "action": "ACTION_IDENTITY",
            "to": "A"
          }
        ]
      }
    }
  ], message);
});

QUnit.test("fsmContracts(fsmDef): initial transition - initial state", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: ['ev'],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { to: 'A', predicate: () => true, action: () => true }
        ],
      },
      { from: INIT_STATE, to: 'B', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === validInitialTransition.name);
  const { message, info } = failureInfo;
  const { initTransition, initTransitions, initialControlState } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(initTransitions.map(formatResult), [
    {
      "event": "init",
      "from": "nok",
      "guards": [
        {
          "action": "action",
          "predicate": "predicate",
          "to": "A"
        }
      ]
    },
    {
      "action": "ACTION_IDENTITY",
      "event": "init",
      "from": "nok",
      "to": "B"
    }
  ], message);
});

QUnit.test("fsmContracts(fsmDef): initial state cannot be a target state", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'B', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', action: ACTION_IDENTITY },
      { from: 'B', to: INIT_STATE, event: 'ev', action: ACTION_IDENTITY }
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === isInitialStateOriginState.name);
  const { message, info } = failureInfo;
  const { targetStates } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(targetStates.map(formatResult), [
    "B",
    "nok"
  ], message);
});

QUnit.test("fsmContracts(fsmDef): eventless self-transitions are forbidden", function exec_test(assert) {
  const fsmDef = {
    states: { A: {C: ''}, B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'B', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'C', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'B', to: 'B', event: void 0, action: ACTION_IDENTITY },
    ],
    initialExtendedState: {},
    settings : default_settings,
  };

  const { isFulfilled, failingContracts } = fsmContractChecker(fsmDef, fsmContracts);
  const failureInfo = failingContracts.find(x => x.name === isValidSelfTransition.name);
  const { message, info } = failureInfo;
  const { wrongSelfTransitions } = info;
  assert.deepEqual(isFulfilled, false, `Fails at least one contract`);
  assert.deepEqual(wrongSelfTransitions.map(x => x.map(formatResult)), [
    [
      {
        "flatTransition": {
          "action": "ACTION_IDENTITY",
          "event": undefined,
          "from": "B",
          "predicate": undefined,
          "to": "B"
        },
        "state": "B"
      }
    ]
  ], message);
});
