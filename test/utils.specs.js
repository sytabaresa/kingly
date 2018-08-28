import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { clone, F, merge, T } from "ramda"
import {
  ACTION_IDENTITY, computeHistoryMaps, computeTimesCircledOn, create_state_machine, generateTestsFromFSM, INIT_EVENT,
  INIT_STATE,
  mapOverTransitionsActions, NO_OUTPUT, reduceTransitions
} from "../src"
import { formatMap, formatResult } from "./helpers"
import { convertFSMtoGraph, getGeneratorMapFromGeneratorMachine } from "../src/test_generator"

const $ = Rx.Observable;

const default_settings = {
  subject_factory: () => {
    const subject = new Rx.Subject();
    // NOTE : this is intended for Rxjs v4-5!! but should work for most also
    subject.emit = subject.next || subject.onNext;
    return subject
  },
  merge: function merge(arrayObs) {return $.merge(...arrayObs)},
  of: $.of,
};
const FALSE_GUARD = function always_false(action, state) {return [{ predicate: F, to: state, action }]};
const TRUE_GUARD = function always_true(to, action) { return [{ predicate: T, to, action }]};

const EVENT1 = 'event1';
const EVENT1_DATA = {
  event1_data_key1: 'event1_data_value1'
}
const a_value = "some value";
const another_value = "another value";
const an_output = {
  outputKey1: 'outputValue1'
};
const another_output = {
  anotherOutputKey1: 'anotherOutputValue1'
};
const model_initial = {
  a_key: a_value,
  another_key: another_value
};
const dummy_action_result = {
  model_update: [],
  outputs: an_output
};
const another_dummy_action_result = {
  model_update: [],
  outputs: another_output
};
const replaced_model_property = {
  new_model_key: 'new_model_value'
}
const update_model_ops_1 = [
  { op: "add", path: '/new_model_key_1', value: 'new_model_value_1' },
  { op: "replace", path: '/a_key', value: replaced_model_property },
  { op: "remove", path: '/another_key' },
];
const update_model_ops_2 = [
  { op: "add", path: '/new_model_key_2', value: 'new_model_value_2' },
];
const dummy_action_result_with_update = {
  model_update: update_model_ops_1,
  outputs: an_output
};
const another_dummy_action_result_with_update = {
  model_update: update_model_ops_2,
  outputs: another_output
};

function dummy_action(model, event_data, settings) {
  return dummy_action_result
}

function another_dummy_action(model, event_data, settings) {
  return another_dummy_action_result
}

function dummy_action_with_update(model, event_data, settings) {
  return merge(dummy_action_result_with_update, {
    outputs: {
      // NOTE : ! this is the model before update!!
      model: clone(model),
      event_data: clone(event_data),
      settings: JSON.parse(JSON.stringify(settings))
    }
  })
}

function another_dummy_action_with_update(model, event_data, settings) {
  return merge(another_dummy_action_result_with_update, {
      outputs: {
        // NOTE : ! this is the model before update!!
        model: clone(model),
        event_data: clone(event_data),
        settings: JSON.parse(JSON.stringify(settings))
      }
    }
  )
}

const reduceFn = (acc, transitionStruct, guardIndex, transitionIndex) => {
  return acc.concat({ transitionStruct, guardIndex, transitionIndex })
};
const mapFn = (action, transition, guardIndex, transitionIndex) => {
  return function () {}
};

QUnit.module("Testing reduceTransitions(reduceFn, seed, transitions)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const result = reduceTransitions(reduceFn, [], fsmDef.transitions).map(formatResult);
  assert.deepEqual(result, [
    {
      "guardIndex": 0,
      "transitionIndex": 0,
      "transitionStruct": {
        "action": "ACTION_IDENTITY",
        "event": "init",
        "from": "nok",
        "predicate": undefined,
        "to": "A"
      }
    }
  ], `reduce transition when no guards are specified`);
});

QUnit.test("INIT event, 2 actions, [F,T] conditions, 2nd action executed", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: F, to: 'A', action: ACTION_IDENTITY },
          { predicate: T, to: 'A', action: ACTION_IDENTITY }
        ]
      }
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = reduceTransitions(reduceFn, [], fsmDef.transitions).map(formatResult);
  assert.deepEqual(result, [
      {
        "guardIndex": 0,
        "transitionIndex": 0,
        "transitionStruct": {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "nok",
          "predicate": "anonymous",
          "to": "A"
        }
      },
      {
        "guardIndex": 1,
        "transitionIndex": 0,
        "transitionStruct": {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "nok",
          "predicate": "anonymous",
          "to": "A"
        }
      }
    ],
    `reduce transition when guards are specified`);
});

QUnit.test("INIT event, 2 actions with model update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: dummy_action_with_update },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action_with_update },
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const result = reduceTransitions(reduceFn, [], fsmDef.transitions).map(formatResult);
  assert.deepEqual(result, [
    {
      "guardIndex": 0,
      "transitionIndex": 0,
      "transitionStruct": {
        "action": "dummy_action_with_update",
        "event": "init",
        "from": "nok",
        "predicate": undefined,
        "to": "A"
      }
    },
    {
      "guardIndex": 0,
      "transitionIndex": 1,
      "transitionStruct": {
        "action": "another_dummy_action_with_update",
        "event": "event1",
        "from": "A",
        "predicate": undefined,
        "to": "B"
      }
    }
  ], `event triggers correct transition`);
});

QUnit.module("Testing mapOverTransitionsActions(mapFn, transitions)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const result = mapOverTransitionsActions(mapFn, fsmDef.transitions).map(formatResult);
  assert.deepEqual(result, [
    {
      "action": "ACTION_IDENTITY",
      "event": "init",
      "from": "nok",
      "to": "A"
    }
  ], `reduce transition when no guards are specified`);
});

QUnit.test("INIT event, 2 actions, [F,T] conditions, 2nd action executed", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: F, to: 'A', action: ACTION_IDENTITY },
          { predicate: T, to: 'A', action: ACTION_IDENTITY }
        ]
      }
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const result = mapOverTransitionsActions(mapFn, fsmDef.transitions)
    .map(({ event, from, guards }) => ({ event, from, guards: guards.map(formatResult) }));
  assert.deepEqual(result,
    [
      {
        "event": "init",
        "from": "nok",
        "guards": [
          {
            "action": "ACTION_IDENTITY",
            "predicate": "anonymous",
            "to": "A"
          },
          {
            "action": "ACTION_IDENTITY",
            "predicate": "anonymous",
            "to": "A"
          }
        ]
      }
    ],
    `reduce transition when guards are specified`);
});

QUnit.test("INIT event, 2 actions with model update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: dummy_action_with_update },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action_with_update },
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const result = mapOverTransitionsActions(mapFn, fsmDef.transitions).map(formatResult);
  assert.deepEqual(result,
    [
      {
        "action": "dummy_action_with_update",
        "event": "init",
        "from": "nok",
        "to": "A"
      },
      {
        "action": "another_dummy_action_with_update",
        "event": "event1",
        "from": "A",
        "to": "B"
      }
    ], `event triggers correct transition`);
});

QUnit.module("Testing convertFSMtoGraph(tracedFSM)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY }
    ],
    initial_extended_state: model_initial
  };
  const result = formatResult(convertFSMtoGraph(fsmDef));
  assert.deepEqual(result, {
    "clear": "clear",
    "edges": [
      {
        "action": "ACTION_IDENTITY",
        "event": "init",
        "from": "nok",
        "guardIndex": 0,
        "predicate": undefined,
        "to": "A",
        "transitionIndex": 0
      }
    ],
    "getEdgeOrigin": "getEdgeOrigin",
    "getEdgeTarget": "getEdgeTarget",
    "incomingEdges": "incomingEdges",
    "outgoingEdges": "outgoingEdges",
    "showEdge": "showEdge",
    "showVertex": "showVertex",
    "vertices": [
      "A",
      "nok"
    ]
  }, `...`);
});

QUnit.test("INIT event, 2 actions, [F,T] conditions, 2nd action executed", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: F, to: 'A', action: ACTION_IDENTITY },
          { predicate: T, to: 'A', action: ACTION_IDENTITY }
        ]
      }
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const fsm = create_state_machine(fsmDef, settings);
  const result = formatResult(convertFSMtoGraph(fsmDef));
  assert.deepEqual(result, {
      "clear": "clear",
      "edges": [
        {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "nok",
          "guardIndex": 0,
          "predicate": "anonymous",
          "to": "A",
          "transitionIndex": 0
        },
        {
          "action": "ACTION_IDENTITY",
          "event": "init",
          "from": "nok",
          "guardIndex": 1,
          "predicate": "anonymous",
          "to": "A",
          "transitionIndex": 0
        }
      ],
      "getEdgeOrigin": "getEdgeOrigin",
      "getEdgeTarget": "getEdgeTarget",
      "incomingEdges": "incomingEdges",
      "outgoingEdges": "outgoingEdges",
      "showEdge": "showEdge",
      "showVertex": "showVertex",
      "vertices": [
        "A",
        "nok"
      ]
    },
    `...`);
});

QUnit.test("INIT event, 2 actions with model update, NOK -> A -> B, no guards", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: dummy_action_with_update },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action_with_update },
    ],
    initial_extended_state: model_initial
  };
  const settings = default_settings;
  const result = formatResult(convertFSMtoGraph(fsmDef));
  assert.deepEqual(result, {
    "clear": "clear",
    "edges": [
      {
        "action": "dummy_action_with_update",
        "event": "init",
        "from": "nok",
        "guardIndex": 0,
        "predicate": undefined,
        "to": "A",
        "transitionIndex": 0
      },
      {
        "action": "another_dummy_action_with_update",
        "event": "event1",
        "from": "A",
        "guardIndex": 0,
        "predicate": undefined,
        "to": "B",
        "transitionIndex": 1
      }
    ],
    "getEdgeOrigin": "getEdgeOrigin",
    "getEdgeTarget": "getEdgeTarget",
    "incomingEdges": "incomingEdges",
    "outgoingEdges": "outgoingEdges",
    "showEdge": "showEdge",
    "showVertex": "showVertex",
    "vertices": [
      "A",
      "B",
      "nok"
    ]
  }, `event triggers correct transition`);
});

QUnit.module("Testing getGeneratorMapFromGeneratorMachine(generators)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, to: 'A', event: INIT_EVENT, gen: function genFn(extendedState) {
          // does not matter
        }
      }
    ],
    initial_extended_state: model_initial
  };
  const generators = fsmDef.transitions;
  const result = formatMap(getGeneratorMapFromGeneratorMachine(generators));
  assert.deepEqual(result, [
    [
      "{\"from\":\"nok\",\"event\":\"init\",\"guardIndex\":0}",
      "genFn"
    ]
  ], `...`);
});

QUnit.module("Testing computeHistoryMaps(control_states)", {});

const OUTER = 'OUTER';
const INNER = 'INNER';
const OUTER_A = 'outer_a';
const OUTER_B = 'outer_b';
const INNER_S = 'inner_s';
const INNER_T = 'inner_t';
const Z = 'z';

QUnit.test("states with hierarchy", function exec_test(assert) {
  const states = { [OUTER]: { [INNER]: { [INNER_S]: '', [INNER_T]: '' }, [OUTER_A]: '', [OUTER_B]: '' }, [Z]: '' };
  const history =computeHistoryMaps(states);
  assert.deepEqual(history, {
    "stateAncestors": {
      "deep": {
        "INNER": [
          "OUTER"
        ],
        "inner_s": [
          "INNER",
          "OUTER"
        ],
        "inner_t": [
          "INNER",
          "OUTER"
        ],
        "outer_a": [
          "OUTER"
        ],
        "outer_b": [
          "OUTER"
        ]
      },
      "shallow": {
        "INNER": ["OUTER"],
        "inner_s": ["INNER"],
        "inner_t": ["INNER"],
        "outer_a": ["OUTER"],
        "outer_b": ["OUTER"]
      }
    },
    "stateList": [
      "OUTER",
      "INNER",
      "inner_s",
      "inner_t",
      "outer_a",
      "outer_b",
      "z"
    ]
  }, `...`);
});
