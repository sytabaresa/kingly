import {
  ACTION_IDENTITY, create_state_machine, INIT_EVENT, INIT_STATE, makeHistoryStates, NO_OUTPUT, traceFSM
} from "../src"
import { formatResult } from "./helpers"
import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { assertContract, isArrayUpdateOperations } from "../src/helpers"
import { applyPatch } from "json-patch-es6/lib/duplex"
import { CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE } from "../src/properties"

const $ = Rx.Observable;

const default_settings = {
  updateModel: applyJSONpatch,
  subject_factory: () => {
    const subject = new Rx.Subject();
    // NOTE : this is intended for Rxjs v4-5!! but should work for most also
    subject.emit = subject.next || subject.onNext;
    return subject
  },
  merge: function merge(arrayObs) {return $.merge(...arrayObs)},
  of: $.of,
};

const EVENT1 = 'event1';
const EVENT2 = 'event2';
const EVENT3 = 'event3';
const EVENT4 = 'event4';
// constant for switching between deep history and shallow history
const DEEP = 'deep';
const SHALLOW = 'shallow';

/**
 *
 * @param {FSM_Model} model
 * @param {Operation[]} modelUpdateOperations
 * @returns {FSM_Model}
 */
function applyJSONpatch(model, modelUpdateOperations) {
  assertContract(isArrayUpdateOperations, [modelUpdateOperations],
    `applyUpdateOperations : ${CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE}`);

  // NOTE : we don't validate operations, to avoid throwing errors when for instance the value property for an
  // `add` JSON operation is `undefined` ; and of course we don't mutate the document in place
  return applyPatch(model, modelUpdateOperations, false, false).newDocument;
}

function incCounter(extS, eventData) {
  const { counter } = extS;

  return {
    model_update: [{ op: 'add', path: '/counter', value: counter + 1 }],
    outputs: counter
  }
}

function setBdata(extendedState, eventData) {
  return {
    model_update: [
      { op: 'add', path: '/b', value: eventData }
    ],
    outputs: NO_OUTPUT
  }
}

function setCinvalidData(extendedState, eventData) {
  return {
    model_update: [
      { op: 'add', path: '/c', value: { error: eventData.error, data: eventData.data } },
      { op: 'add', path: '/switch', value: false },
    ]
  }
}

function setCvalidData(extendedState, eventData) {
  return {
    model_update: [
      { op: 'add', path: '/c', value: { error: null, data: eventData.data } },
      { op: 'add', path: '/switch', value: true },
    ],
    outputs: NO_OUTPUT
  }
}

function setReviewed(extendedState, eventData) {
  return {
    model_update: [
      { op: 'add', path: '/reviewed', value: true },
    ],
    outputs: NO_OUTPUT
  }
}

function setReviewedAndOuput(extendedState, eventData) {
  return {
    model_update: [
      { op: 'add', path: '/reviewed', value: true },
    ],
    outputs: extendedState
  }
}

QUnit.module("Testing hierarchy features", {});

QUnit.test("INIT event multi transitions, CASCADING inner INIT event transitions", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { A: '', B: '', C: '', OUTER_GROUP_D: { INNER_GROUP_D: { D: '' } }, E: '' },
    events: [CLICK, REVIEW_A, REVIEW_B, SAVE],
    initial_extended_state: { switch: false, reviewed: false },
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', action: ACTION_IDENTITY },
          { predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          { predicate: function isReviewed(x, e) {return x.reviewed}, to: 'OUTER_GROUP_D', action: ACTION_IDENTITY },
          { predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      { from: 'B', event: CLICK, to: 'C', action: setBdata },
      {
        from: 'C', event: CLICK, guards: [
          { predicate: function isValid(x, e) {return e.valid}, to: 'INNER_GROUP_D', action: setCvalidData },
          { predicate: function isNotValid(x, e) {return !e.valid}, to: 'C', action: setCinvalidData }
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', action: setReviewed },
      { from: 'D', event: REVIEW_B, to: 'B', action: ACTION_IDENTITY },
      { from: 'D', event: SAVE, to: 'E', action: setReviewedAndOuput },
      { from: 'OUTER_GROUP_D', event: INIT_EVENT, to: 'INNER_GROUP_D', action: ACTION_IDENTITY },
      { from: 'INNER_GROUP_D', event: INIT_EVENT, to: 'D', action: ACTION_IDENTITY },
    ],
  };
  const settings = default_settings;
  const inputSequence = [
    { "init": fsmDef.initial_extended_state },
    { "click": { "keyB": "valueB" } },
    { "click": { "valid": true, "data": "valueC" } }
  ];
  const fsm = create_state_machine(traceFSM({}, fsmDef), settings);
  const outputSequence = inputSequence.map(fsm.yield);
  const formattedResults = outputSequence.map(output => output.map(formatResult));
  assert.deepEqual(formattedResults, [
    [{
      "actionFactory": "ACTION_IDENTITY",
      "controlState": "nok",
      "event": {
        "eventData": fsmDef.initial_extended_state,
        "eventLabel": "init"
      },
      "extendedState": {
        "reviewed": false,
        "switch": false
      },
      "guardIndex": 1,
      "model_update": [],
      "newExtendedState": {
        "reviewed": false,
        "switch": false
      },
      "outputs": null,
      "predicate": "isSwitchOff",
      settings: formatResult(settings),
      "targetControlState": "B",
      "transitionIndex": 0
    }],
    [{
      "actionFactory": "setBdata",
      "controlState": "B",
      "event": {
        "eventData": {
          "keyB": "valueB"
        },
        "eventLabel": "click"
      },
      "extendedState": {
        "reviewed": false,
        "switch": false
      },
      "guardIndex": 0,
      "model_update": [
        {
          "op": "add",
          "path": "/b",
          "value": {
            "keyB": "valueB"
          }
        }
      ],
      "newExtendedState": {
        "b": {
          "keyB": "valueB"
        },
        "reviewed": false,
        "switch": false
      },
      "outputs": null,
      "predicate": undefined,
      settings: formatResult(settings),
      "targetControlState": "C",
      "transitionIndex": 2
    }],
    [
      {
        "actionFactory": "setCvalidData",
        "controlState": "C",
        "event": {
          "eventData": {
            "data": "valueC",
            "valid": true
          },
          "eventLabel": "click"
        },
        "extendedState": {
          "b": { "keyB": "valueB" },
          "reviewed": false,
          "switch": false
        },
        "guardIndex": 0,
        "model_update": [
          {
            "op": "add",
            "path": "/c",
            "value": {
              "data": "valueC",
              "error": null
            }
          },
          {
            "op": "add",
            "path": "/switch",
            "value": true
          }
        ],
        "newExtendedState": {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        },
        "outputs": null,
        "predicate": "isValid",
        settings: formatResult(settings),
        "targetControlState": "INNER_GROUP_D",
        "transitionIndex": 3
      },
      {
        "actionFactory": "ACTION_IDENTITY",
        "controlState": "INNER_GROUP_D",
        "event": {
          "eventData": {
            "data": "valueC",
            "valid": true
          },
          "eventLabel": "init"
        },
        "extendedState": {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        },
        "guardIndex": 0,
        "model_update": [],
        "newExtendedState": {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        },
        "outputs": null,
        "predicate": undefined,
        settings: formatResult(settings),
        "targetControlState": "D",
        "transitionIndex": 8
      },
    ]
  ], `Cascading init transitions are correctly taken`);
});

QUnit.test("eventless transition, INIT event multi transitions, CASCADING inner INIT event transitions", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { EVENTLESS: '', A: '', B: '', C: '', OUTER_GROUP_D: { INNER_GROUP_D: { D: '' } }, E: '' },
    events: [CLICK, REVIEW_A, REVIEW_B, SAVE],
    initial_extended_state: { switch: false, reviewed: false },
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', action: ACTION_IDENTITY },
          { predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'EVENTLESS', action: ACTION_IDENTITY }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          { predicate: function isReviewed(x, e) {return x.reviewed}, to: 'OUTER_GROUP_D', action: ACTION_IDENTITY },
          { predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      { from: 'EVENTLESS', to: 'B', action: ACTION_IDENTITY },
      { from: 'B', event: CLICK, to: 'C', action: setBdata },
      {
        from: 'C', event: CLICK, guards: [
          { predicate: function isValid(x, e) {return e.valid}, to: 'INNER_GROUP_D', action: setCvalidData },
          { predicate: function isNotValid(x, e) {return !e.valid}, to: 'C', action: setCinvalidData }
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', action: setReviewed },
      { from: 'D', event: REVIEW_B, to: 'B', action: ACTION_IDENTITY },
      { from: 'D', event: SAVE, to: 'E', action: setReviewedAndOuput },
      { from: 'OUTER_GROUP_D', event: INIT_EVENT, to: 'INNER_GROUP_D', action: ACTION_IDENTITY },
      { from: 'INNER_GROUP_D', event: INIT_EVENT, to: 'D', action: ACTION_IDENTITY },
    ],
  };
  const settings = default_settings;
  const inputSequence = [
    { "init": fsmDef.initial_extended_state },
    { "click": { "keyB": "valueB" } },
    { "click": { "valid": true, "data": "valueC" } }
  ];
  const fsm = create_state_machine(traceFSM({}, fsmDef), settings);
  const outputSequence = inputSequence.map(fsm.yield);
  const formattedResults = outputSequence.map(output => output.map(formatResult));
  assert.deepEqual(formattedResults, [
    [
      {
        "actionFactory": "ACTION_IDENTITY",
        "controlState": "nok",
        "event": {
          "eventData": {
            "reviewed": false,
            "switch": false
          },
          "eventLabel": "init"
        },
        "extendedState": {
          "reviewed": false,
          "switch": false
        },
        "guardIndex": 1,
        "model_update": [],
        "newExtendedState": {
          "reviewed": false,
          "switch": false
        },
        "outputs": null,
        "predicate": "isSwitchOff",
        "settings": {
          "merge": "merge",
          "of": "anonymous",
          "subject_factory": "subject_factory",
          "updateModel": "applyJSONpatch"
        },
        "targetControlState": "EVENTLESS",
        "transitionIndex": 0
      },
      {
        "actionFactory": "ACTION_IDENTITY",
        "controlState": "EVENTLESS",
        "event": {
          "eventData": {
            "reviewed": false,
            "switch": false
          },
          "eventLabel": undefined
        },
        "extendedState": {
          "reviewed": false,
          "switch": false
        },
        "guardIndex": 0,
        "model_update": [],
        "newExtendedState": {
          "reviewed": false,
          "switch": false
        },
        "outputs": null,
        "predicate": undefined,
        "settings": {
          "merge": "merge",
          "of": "anonymous",
          "subject_factory": "subject_factory",
          "updateModel": "applyJSONpatch"
        },
        "targetControlState": "B",
        "transitionIndex": 2
      }
    ],
    [
      {
        "actionFactory": "setBdata",
        "controlState": "B",
        "event": {
          "eventData": {
            "keyB": "valueB"
          },
          "eventLabel": "click"
        },
        "extendedState": {
          "reviewed": false,
          "switch": false
        },
        "guardIndex": 0,
        "model_update": [
          {
            "op": "add",
            "path": "/b",
            "value": {
              "keyB": "valueB"
            }
          }
        ],
        "newExtendedState": {
          "b": {
            "keyB": "valueB"
          },
          "reviewed": false,
          "switch": false
        },
        "outputs": null,
        "predicate": undefined,
        "settings": {
          "merge": "merge",
          "of": "anonymous",
          "subject_factory": "subject_factory",
          "updateModel": "applyJSONpatch"
        },
        "targetControlState": "C",
        "transitionIndex": 3
      }
    ],
    [
      {
        "actionFactory": "setCvalidData",
        "controlState": "C",
        "event": {
          "eventData": {
            "data": "valueC",
            "valid": true
          },
          "eventLabel": "click"
        },
        "extendedState": {
          "b": {
            "keyB": "valueB"
          },
          "reviewed": false,
          "switch": false
        },
        "guardIndex": 0,
        "model_update": [
          {
            "op": "add",
            "path": "/c",
            "value": {
              "data": "valueC",
              "error": null
            }
          },
          {
            "op": "add",
            "path": "/switch",
            "value": true
          }
        ],
        "newExtendedState": {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        },
        "outputs": null,
        "predicate": "isValid",
        "settings": {
          "merge": "merge",
          "of": "anonymous",
          "subject_factory": "subject_factory",
          "updateModel": "applyJSONpatch"
        },
        "targetControlState": "INNER_GROUP_D",
        "transitionIndex": 4
      },
      {
        "actionFactory": "ACTION_IDENTITY",
        "controlState": "INNER_GROUP_D",
        "event": {
          "eventData": {
            "data": "valueC",
            "valid": true
          },
          "eventLabel": "init"
        },
        "extendedState": {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        },
        "guardIndex": 0,
        "model_update": [],
        "newExtendedState": {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        },
        "outputs": null,
        "predicate": undefined,
        "settings": {
          "merge": "merge",
          "of": "anonymous",
          "subject_factory": "subject_factory",
          "updateModel": "applyJSONpatch"
        },
        "targetControlState": "D",
        "transitionIndex": 9
      }
    ]
  ], `eventless transitions are correctly taken`);
});

QUnit.test("shallow history transitions, INIT event CASCADING transitions", function exec_test(assert) {
  const OUTER = 'OUTER';
  const INNER = 'INNER';
  const OUTER_A = 'outer_a';
  const OUTER_B = 'outer_b';
  const INNER_S = 'inner_s';
  const INNER_T = 'inner_t';
  const Z = 'z';
  const states = { [OUTER]: { [INNER]: { [INNER_S]: '', [INNER_T]: '' }, [OUTER_A]: '', [OUTER_B]: '' }, [Z]: '' };
  const hs = makeHistoryStates(states);
  const fsmDef = {
    states,
    events: [EVENT1, EVENT2, EVENT3, EVENT4],
    initial_extended_state: { history: SHALLOW, counter: 0 },
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: OUTER, action: ACTION_IDENTITY },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A, action: ACTION_IDENTITY },
      { from: OUTER_A, event: EVENT1, to: INNER, action: ACTION_IDENTITY },
      { from: INNER, event: INIT_EVENT, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER_S, event: EVENT3, to: INNER_T, action: ACTION_IDENTITY },
      { from: INNER_T, event: EVENT3, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER, event: EVENT2, to: OUTER_B, action: ACTION_IDENTITY },
      { from: OUTER, event: EVENT1, to: Z, action: ACTION_IDENTITY },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs.deep(OUTER),
            action: incCounter
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs.shallow(OUTER),
            action: incCounter
          }
        ]
      },
    ],
  };
  const settings = default_settings;
  const inputSequence = [
    { "init": fsmDef.initial_extended_state },
    { [EVENT1]: {} },
    { [EVENT3]: {} },
    { [EVENT1]: {} },
    { [EVENT4]: {} },
  ];
  const fsm = create_state_machine(fsmDef, settings);
  const outputSequence = inputSequence.map(fsm.yield);
  const formattedResults = outputSequence.map(output => output && output.map(formatResult));
  assert.deepEqual(formattedResults, [
    [NO_OUTPUT, NO_OUTPUT],
    [NO_OUTPUT, NO_OUTPUT],
    NO_OUTPUT,
    NO_OUTPUT,
    [0, NO_OUTPUT]
  ], `eventless transitions are correctly taken`);
  // Fix bug : action output is not output for history states!! What to do with
});

QUnit.test("deep history transitions, INIT event CASCADING transitions", function exec_test(assert) {
  const OUTER = 'OUTER';
  const INNER = 'INNER';
  const OUTER_A = 'outer_a';
  const OUTER_B = 'outer_b';
  const INNER_S = 'inner_s';
  const INNER_T = 'inner_t';
  const Z = 'z';
  const states = { [OUTER]: { [INNER]: { [INNER_S]: '', [INNER_T]: '' }, [OUTER_A]: '', [OUTER_B]: '' }, [Z]: '' };
  const hs = makeHistoryStates(states);
  const fsmDef = {
    states,
    events: [EVENT1, EVENT2, EVENT3, EVENT4],
    initial_extended_state: { history: DEEP, counter: 0 },
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: OUTER, action: ACTION_IDENTITY },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A, action: ACTION_IDENTITY },
      { from: OUTER_A, event: EVENT1, to: INNER, action: ACTION_IDENTITY },
      { from: INNER, event: INIT_EVENT, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER_S, event: EVENT3, to: INNER_T, action: ACTION_IDENTITY },
      { from: INNER_T, event: EVENT3, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER, event: EVENT2, to: OUTER_B, action: ACTION_IDENTITY },
      { from: OUTER, event: EVENT1, to: Z, action: ACTION_IDENTITY },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs.deep(OUTER),
            action: incCounter
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs.shallow(OUTER),
            action: incCounter
          }
        ]
      },
    ],
  };
  const settings = default_settings;
  const inputSequence = [
    { "init": fsmDef.initial_extended_state },
    { [EVENT1]: {} },
    { [EVENT3]: {} },
    { [EVENT1]: {} },
    { [EVENT4]: {} },
  ];
  const fsm = create_state_machine(fsmDef, settings);
  const outputSequence = inputSequence.map(fsm.yield);
  const formattedResults = outputSequence.map(output => output && output.map(formatResult));
  assert.deepEqual(formattedResults, [
    [NO_OUTPUT, NO_OUTPUT],
    [NO_OUTPUT, NO_OUTPUT],
    NO_OUTPUT,
    NO_OUTPUT,
    [0]
  ], `eventless transitions are correctly taken`);
  // Fix bug : action output is not output for history states!! What to do with
});

QUnit.test("with trace : shallow history transitions, INIT event CASCADING transitions", function exec_test(assert) {
  const OUTER = 'OUTER';
  const INNER = 'INNER';
  const OUTER_A = 'outer_a';
  const OUTER_B = 'outer_b';
  const INNER_S = 'inner_s';
  const INNER_T = 'inner_t';
  const Z = 'z';
  const states = { [OUTER]: { [INNER]: { [INNER_S]: '', [INNER_T]: '' }, [OUTER_A]: '', [OUTER_B]: '' }, [Z]: '' };
  const hs = makeHistoryStates(states);
  const fsmDef = {
    states,
    events: [EVENT1, EVENT2, EVENT3, EVENT4],
    initial_extended_state: { history: SHALLOW, counter: 0 },
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: OUTER, action: ACTION_IDENTITY },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A, action: ACTION_IDENTITY },
      { from: OUTER_A, event: EVENT1, to: INNER, action: ACTION_IDENTITY },
      { from: INNER, event: INIT_EVENT, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER_S, event: EVENT3, to: INNER_T, action: ACTION_IDENTITY },
      { from: INNER_T, event: EVENT3, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER, event: EVENT2, to: OUTER_B, action: ACTION_IDENTITY },
      { from: OUTER, event: EVENT1, to: Z, action: ACTION_IDENTITY },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs.deep(OUTER),
            action: incCounter
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs.shallow(OUTER),
            action: incCounter
          }
        ]
      },
    ],
  };
  const settings = default_settings;
  const inputSequence = [
    { "init": fsmDef.initial_extended_state },
    { [EVENT1]: {} },
    { [EVENT3]: {} },
    { [EVENT1]: {} },
    { [EVENT4]: {} },
  ];
  const fsm = create_state_machine(traceFSM({}, fsmDef), settings);
  const outputSequence = inputSequence.map(fsm.yield);
  const formattedResults = outputSequence.map(output => output.map(formatResult));
  assert.deepEqual(formattedResults,
    [
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "nok",
          "event": {
            "eventData": {
              "counter": 0,
              "history": "shallow"
            },
            "eventLabel": "init"
          },
          "extendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "OUTER",
          "transitionIndex": 0
        },
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "OUTER",
          "event": {
            "eventData": {
              "counter": 0,
              "history": "shallow"
            },
            "eventLabel": "init"
          },
          "extendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "outer_a",
          "transitionIndex": 1
        }
      ],
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "outer_a",
          "event": {
            "eventData": {},
            "eventLabel": "event1"
          },
          "extendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "INNER",
          "transitionIndex": 2
        },
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "INNER",
          "event": {
            "eventData": {},
            "eventLabel": "init"
          },
          "extendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "inner_s",
          "transitionIndex": 3
        }
      ],
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "inner_s",
          "event": {
            "eventData": {},
            "eventLabel": "event3"
          },
          "extendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "inner_t",
          "transitionIndex": 4
        }
      ],
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "OUTER",
          "event": {
            "eventData": {},
            "eventLabel": "event1"
          },
          "extendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "z",
          "transitionIndex": 7
        }
      ],
      [
        {
          "actionFactory": "incCounter",
          "controlState": "z",
          "event": {
            "eventData": {},
            "eventLabel": "event4"
          },
          "extendedState": {
            "counter": 0,
            "history": "shallow"
          },
          "guardIndex": 1,
          "model_update": [
            {
              "op": "add",
              "path": "/counter",
              "value": 1
            }
          ],
          "newExtendedState": {
            "counter": 1,
            "history": "shallow"
          },
          "outputs": 0,
          "predicate": "isShallow",
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": {
            "shallow": "OUTER",
            "type": {}
          },
          "transitionIndex": 8
        },
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "INNER",
          "event": {
            "eventData": {},
            "eventLabel": "init"
          },
          "extendedState": {
            "counter": 1,
            "history": "shallow"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 1,
            "history": "shallow"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "inner_s",
          "transitionIndex": 3
        }
      ]
    ], `eventless transitions are correctly taken`);
});

QUnit.test("with trace : deep history transitions, INIT event CASCADING transitions", function exec_test(assert) {
  const OUTER = 'OUTER';
  const INNER = 'INNER';
  const OUTER_A = 'outer_a';
  const OUTER_B = 'outer_b';
  const INNER_S = 'inner_s';
  const INNER_T = 'inner_t';
  const Z = 'z';
  const states = { [OUTER]: { [INNER]: { [INNER_S]: '', [INNER_T]: '' }, [OUTER_A]: '', [OUTER_B]: '' }, [Z]: '' };
  const hs = makeHistoryStates(states);
  const fsmDef = {
    states,
    events: [EVENT1, EVENT2, EVENT3, EVENT4],
    initial_extended_state: { history: DEEP, counter: 0 },
    transitions: [
      { from: INIT_STATE, event: INIT_EVENT, to: OUTER, action: ACTION_IDENTITY },
      { from: OUTER, event: INIT_EVENT, to: OUTER_A, action: ACTION_IDENTITY },
      { from: OUTER_A, event: EVENT1, to: INNER, action: ACTION_IDENTITY },
      { from: INNER, event: INIT_EVENT, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER_S, event: EVENT3, to: INNER_T, action: ACTION_IDENTITY },
      { from: INNER_T, event: EVENT3, to: INNER_S, action: ACTION_IDENTITY },
      { from: INNER, event: EVENT2, to: OUTER_B, action: ACTION_IDENTITY },
      { from: OUTER, event: EVENT1, to: Z, action: ACTION_IDENTITY },
      {
        from: Z, event: EVENT4, guards: [
          {
            predicate: function isDeep(x, e) {return x.history === DEEP},
            to: hs.deep(OUTER),
            action: incCounter
          },
          {
            predicate: function isShallow(x, e) {return x.history !== DEEP},
            to: hs.shallow(OUTER),
            action: incCounter
          }
        ]
      },
    ],
  };
  const settings = default_settings;
  const inputSequence = [
    { "init": fsmDef.initial_extended_state },
    { [EVENT1]: {} },
    { [EVENT3]: {} },
    { [EVENT1]: {} },
    { [EVENT4]: {} },
  ];
  const fsm = create_state_machine(traceFSM({}, fsmDef), settings);
  const outputSequence = inputSequence.map(fsm.yield);
  const formattedResults = outputSequence.map(output => output.map(formatResult));
  assert.deepEqual(formattedResults,
    [
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "nok",
          "event": {
            "eventData": {
              "counter": 0,
              "history": "deep"
            },
            "eventLabel": "init"
          },
          "extendedState": {
            "counter": 0,
            "history": "deep"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "deep"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "OUTER",
          "transitionIndex": 0
        },
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "OUTER",
          "event": {
            "eventData": {
              "counter": 0,
              "history": "deep"
            },
            "eventLabel": "init"
          },
          "extendedState": {
            "counter": 0,
            "history": "deep"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "deep"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "outer_a",
          "transitionIndex": 1
        }
      ],
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "outer_a",
          "event": {
            "eventData": {},
            "eventLabel": "event1"
          },
          "extendedState": {
            "counter": 0,
            "history": "deep"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "deep"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "INNER",
          "transitionIndex": 2
        },
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "INNER",
          "event": {
            "eventData": {},
            "eventLabel": "init"
          },
          "extendedState": {
            "counter": 0,
            "history": "deep"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "deep"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "inner_s",
          "transitionIndex": 3
        }
      ],
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "inner_s",
          "event": {
            "eventData": {},
            "eventLabel": "event3"
          },
          "extendedState": {
            "counter": 0,
            "history": "deep"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "deep"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "inner_t",
          "transitionIndex": 4
        }
      ],
      [
        {
          "actionFactory": "ACTION_IDENTITY",
          "controlState": "OUTER",
          "event": {
            "eventData": {},
            "eventLabel": "event1"
          },
          "extendedState": {
            "counter": 0,
            "history": "deep"
          },
          "guardIndex": 0,
          "model_update": [],
          "newExtendedState": {
            "counter": 0,
            "history": "deep"
          },
          "outputs": null,
          "predicate": undefined,
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": "z",
          "transitionIndex": 7
        }
      ],
      [
        {
          "actionFactory": "incCounter",
          "controlState": "z",
          "event": {
            "eventData": {},
            "eventLabel": "event4"
          },
          "extendedState": {
            "counter": 0,
            "history": "deep"
          },
          "guardIndex": 0,
          "model_update": [
            {
              "op": "add",
              "path": "/counter",
              "value": 1
            }
          ],
          "newExtendedState": {
            "counter": 1,
            "history": "deep"
          },
          "outputs": 0,
          "predicate": "isDeep",
          "settings": {
            "merge": "merge",
            "of": "anonymous",
            "subject_factory": "subject_factory",
            "updateModel": "applyJSONpatch"
          },
          "targetControlState": {
            "deep": "OUTER",
            "type": {}
          },
          "transitionIndex": 8
        }
      ]
    ], `eventless transitions are correctly taken`);
});