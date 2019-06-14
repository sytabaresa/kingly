import * as QUnit from "qunitjs"
import { F } from "ramda"
import { ACTION_IDENTITY, create_state_machine, INIT_EVENT, INIT_STATE } from "../src"
import { applyPatch } from "json-patch-es6"
import { assertContract, isArrayUpdateOperations } from "../test/helpers"
import { CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE } from "../src/properties"

/**
 *
 * @param {ExtendedState} extendedState
 * @param {Operation[]} extendedStateUpdateOperations
 * @returns {ExtendedState}
 */
export function applyJSONpatch(extendedState, extendedStateUpdateOperations) {
  assertContract(isArrayUpdateOperations, [extendedStateUpdateOperations],
    `applyUpdateOperations : ${CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE}`);

  // NOTE : we don't validate operations, to avoid throwing errors when for instance the value property for an
  // `add` JSON operation is `undefined` ; and of course we don't mutate the document in place
  return applyPatch(extendedState, extendedStateUpdateOperations, false, false).newDocument;
}

let consoleContent = [];
const fakeConsole = {
  log: (...args) => consoleContent.push('log', args),
  debug: (...args) => consoleContent.push('debug', args),
  info: (...args) => consoleContent.push('info', args),
  warn: (...args) => consoleContent.push('warn', args),
  error: (...args) => consoleContent.push('error', args),
};
const default_settings = { debug: { console: fakeConsole } };
const FALSE_GUARD = function always_false(action, state) {return [{ predicate: F, to: state, action }]};

const a_value = "some value";
const another_value = "another value";
const an_output = {
  outputKey1: 'outputValue1'
};
const initialExtendedState = {
  a_key: a_value,
  another_key: another_value
};
const dummy_action_result = {
  updates: [],
  outputs: an_output
};

function dummy_action(extendedState, event_data, settings) {
  return dummy_action_result
}

QUnit.module("Testing create_state_machine(fsmDef, settings)", {});

// Debug tests are brittle : specifications can change in any ways at any time. As a result, we do only one such test.
QUnit.test("debug settings, event, no action, false guard", function exec_test(assert) {
  // fakeConsole.reset();
  const fsmDef = {
    states: { A: '', B: '' },
    events: ['ev'],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY },
      { from: 'A', to: 'B', event: 'ev', guards: FALSE_GUARD(ACTION_IDENTITY, 'A') }
    ],
    initialExtendedState: initialExtendedState,
    updateState: applyJSONpatch,
  };
  const fsm = create_state_machine(fsmDef, default_settings);
  const result = fsm({ ev: initialExtendedState });
  assert.deepEqual(consoleContent, [
      "debug",
      [
        "send event",
        {
          "init": {
            "a_key": "some value",
            "another_key": "another value"
          }
        }
      ],
      "log",
      [
        "found event handler!"
      ],
      "info",
      [
        "WHEN EVENT ",
        "init"
      ],
      "info",
      [
        "IN STATE ",
        "nok"
      ],
      "info",
      [
        "CASE: guard alwaysTrue for transition is fulfilled"
      ],
      "info",
      [
        "THEN : we execute the action ACTION_IDENTITY"
      ],
      "info",
      [
        "left state",
        "-nok-"
      ],
      "info",
      [
        "AND TRANSITION TO STATE",
        "A"
      ],
      "info",
      [
        "ENTERING NEXT STATE: ",
        "A"
      ],
      "info",
      [
        "with extended state: ",
        {
          "a_key": "some value",
          "another_key": "another value"
        }
      ],
      "debug",
      [
        "send event",
        {
          "ev": {
            "a_key": "some value",
            "another_key": "another value"
          }
        }
      ],
      "log",
      [
        "found event handler!"
      ],
      "info",
      [
        "WHEN EVENT ",
        "ev"
      ],
      "warn",
      [
        "No guards have been fulfilled! We recommend to configure guards explicitly to cover the full state space!"
      ]
    ],
      `console displays something`);
});
