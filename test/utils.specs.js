import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { clone, F, merge, T } from "ramda"
import {
  ACTION_IDENTITY, computeTimesCircledOn, create_state_machine, generateTestsFromFSM, INIT_EVENT, INIT_STATE,
  mapOverTransitionsActions, reduceTransitions
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
  output: an_output
};
const another_dummy_action_result = {
  model_update: [],
  output: another_output
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
  output: an_output
};
const another_dummy_action_result_with_update = {
  model_update: update_model_ops_2,
  output: another_output
};

function dummy_action(model, event_data, settings) {
  return dummy_action_result
}

function another_dummy_action(model, event_data, settings) {
  return another_dummy_action_result
}

function dummy_action_with_update(model, event_data, settings) {
  return merge(dummy_action_result_with_update, {
    output: {
      // NOTE : ! this is the model before update!!
      model: clone(model),
      event_data: clone(event_data),
      settings: JSON.parse(JSON.stringify(settings))
    }
  })
}

function another_dummy_action_with_update(model, event_data, settings) {
  return merge(another_dummy_action_result_with_update, {
      output: {
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

QUnit.module("Testing generateTestsFromFSM(fsm, generators, settings)", {});

QUnit.test("INIT event, no action, no guard", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, to: 'A', event: INIT_EVENT, action: ACTION_IDENTITY
      }
    ],
    initial_extended_state: model_initial
  };
  const genFsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, to: 'A', event: INIT_EVENT, gen: function genFn(extendedState) {
          return { input: extendedState, hasGeneratedInput: true }
        }
      }
    ],
    initial_extended_state: model_initial
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 1;
  const target = 'A';
  /** @type SearchSpecs*/
  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestsFromFSM(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults, [
    {
      "controlStateSequence": [
        "nok",
        "A"
      ],
      "inputSequence": [
        {
          "init": {
            "a_key": "some value",
            "another_key": "another value"
          }
        }
      ],
      "outputSequence": [
        null
      ]
    }
  ], `...`);
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
  const genFsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: F, to: 'A', gen: extendedState => ({ input: null, hasGeneratedInput: false }) },
          {
            predicate: T,
            to: 'A',
            gen: function genFnF(extendedState) {return { input: extendedState, hasGeneratedInput: true }}
          },
        ]
      }
    ],
    initial_extended_state: model_initial
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 1;
  const target = 'A';
  /** @type SearchSpecs*/
  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestsFromFSM(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults, [
    {
      "controlStateSequence": [
        "nok",
        "A"
      ],
      "inputSequence": [
        {
          "init": {
            "a_key": "some value",
            "another_key": "another value"
          }
        }
      ],
      "outputSequence": [
        null
      ]
    }
  ], `...`);
});

QUnit.test("INIT event, 2 actions, 2 conditions", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: function yes({ branch }) {return branch === 'Y'}, to: 'A', action: ACTION_IDENTITY },
          { predicate: T, to: 'A', action: ACTION_IDENTITY }
        ]
      }
    ],
    initial_extended_state: { branch: 'Y' }
  };
  const genFsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          {
            predicate: function yes(x) {return x === 'Y'},
            to: 'A',
            gen: extendedState => ({ input: { branch: 'Y' }, hasGeneratedInput: true })
          },
          {
            predicate: T,
            to: 'A',
            gen: function genFnF(extendedState) {return { input: { branch: 'N' }, hasGeneratedInput: true }}
          },
        ]
      }
    ],
    initial_extended_state: model_initial
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 1;
  const target = 'A';
  /** @type SearchSpecs*/
  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestsFromFSM(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults, [
    {
      "controlStateSequence": [
        "nok",
        "A"
      ],
      "inputSequence": [
        {
          "init": {
            "branch": "Y"
          }
        }
      ],
      "outputSequence": [
        null
      ]
    },
    {
      "controlStateSequence": [
        "nok",
        "A"
      ],
      "inputSequence": [
        {
          "init": {
            "branch": "N"
          }
        }
      ],
      "outputSequence": [
        null
      ]
    }
  ], `...`);
});

function setBdata(extendedState, eventData) {
  return {
    model_update: [
      { op: 'add', path: '/b', value: eventData }
    ]
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
    ]
  }
}

function setReviewed(extendedState, eventData) {
  return {
    model_update: [
      { op: 'add', path: '/reviewed', value: true },
    ]
  }
}

function setReviewedAndOuput(extendedState, eventData) {
  return {
    model_update: [
      { op: 'add', path: '/reviewed', value: true },
    ],
    output: extendedState
  }
}

const dummyB = { keyB: 'valueB' };
const dummyCv = { valid: true, data: 'valueC' };
const dummyCi = { valid: false, data: 'invalid key for C' };

// NOTE : graph for fsm is in /test/assets
QUnit.test("INIT event multi transitions, self-loop, 1-loop, 2-loops, conditions", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { A: '', B: '', C: '', D: '', E: '' },
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
          { predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', action: ACTION_IDENTITY },
          { predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      { from: 'B', event: CLICK, to: 'C', action: setBdata },
      {
        from: 'C', event: CLICK, guards: [
          { predicate: function isValid(x, e) {return e.valid}, to: 'D', action: setCvalidData },
          { predicate: function isNotValid(x, e) {return !e.valid}, to: 'C', action: setCinvalidData }
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', action: setReviewed },
      { from: 'D', event: REVIEW_B, to: 'B', action: ACTION_IDENTITY },
      { from: 'D', event: SAVE, to: 'E', action: setReviewedAndOuput },
    ],
  };
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          {
            predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', gen: function genINIT2A(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.switch
              }
            }
          },
          {
            predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', gen: function genINIT2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.switch
              }
            }
          }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          {
            predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', gen: function genA2D(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.reviewed
              }
            }
          },
          {
            predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', gen: function genA2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.reviewed
              }
            }
          }
        ]
      },
      {
        from: 'B',
        event: CLICK,
        to: 'C',
        gen: function genB2C(extS) {return { input: dummyB, hasGeneratedInput: true }}
      },
      {
        from: 'C', event: CLICK, guards: [
          {
            predicate: function isValid(x, e) {return e.valid},
            to: 'D',
            gen: function genC2D(extS) {return { input: dummyCv, hasGeneratedInput: true }}
          },
          {
            predicate: function isNotValid(x, e) {return !e.valid},
            to: 'C',
            gen: function genC2C(extS) {return { input: dummyCi, hasGeneratedInput: true }}
          },
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: REVIEW_B, to: 'B', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: SAVE, to: 'E', gen: extS => ({ input: null, hasGeneratedInput: true }) },
    ],
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 1;
  const target = 'E';
  /** @type SearchSpecs*/
  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestsFromFSM(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults, [
    {
      "controlStateSequence": [
        "nok",
        "B",
        "C",
        "D",
        "A",
        "D",
        "E"
      ],
      "inputSequence": [
        {
          "init": null
        },
        {
          "click": {
            "keyB": "valueB"
          }
        },
        {
          "click": {
            "data": "valueC",
            "valid": true
          }
        },
        {
          "reviewA": null
        },
        {
          "click": null
        },
        {
          "save": null
        }
      ],
      "outputSequence": [
        null,
        undefined,
        undefined,
        undefined,
        null,
        {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": true,
          "switch": true
        }
      ]
    },
    {
      "controlStateSequence": [
        "nok",
        "B",
        "C",
        "D",
        "E"
      ],
      "inputSequence": [
        {
          "init": null
        },
        {
          "click": {
            "keyB": "valueB"
          }
        },
        {
          "click": {
            "data": "valueC",
            "valid": true
          }
        },
        {
          "save": null
        }
      ],
      "outputSequence": [
        null,
        undefined,
        undefined,
        {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        }
      ]
    },
    {
      "controlStateSequence": [
        "nok",
        "B",
        "C",
        "C",
        "D",
        "A",
        "D",
        "E"
      ],
      "inputSequence": [
        {
          "init": null
        },
        {
          "click": {
            "keyB": "valueB"
          }
        },
        {
          "click": {
            "data": "invalid key for C",
            "valid": false
          }
        },
        {
          "click": {
            "data": "valueC",
            "valid": true
          }
        },
        {
          "reviewA": null
        },
        {
          "click": null
        },
        {
          "save": null
        }
      ],
      "outputSequence": [
        null,
        undefined,
        undefined,
        undefined,
        undefined,
        null,
        {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": true,
          "switch": true
        }
      ]
    },
    {
      "controlStateSequence": [
        "nok",
        "B",
        "C",
        "C",
        "D",
        "E"
      ],
      "inputSequence": [
        {
          "init": null
        },
        {
          "click": {
            "keyB": "valueB"
          }
        },
        {
          "click": {
            "data": "invalid key for C",
            "valid": false
          }
        },
        {
          "click": {
            "data": "valueC",
            "valid": true
          }
        },
        {
          "save": null
        }
      ],
      "outputSequence": [
        null,
        undefined,
        undefined,
        undefined,
        {
          "b": {
            "keyB": "valueB"
          },
          "c": {
            "data": "valueC",
            "error": null
          },
          "reviewed": false,
          "switch": true
        }
      ]
    }
  ], `...`);
});

QUnit.test("INIT event multi transitions, self-loop, 1-loop, 2-loops, conditions, 2 cycles allowed", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { A: '', B: '', C: '', D: '', E: '' },
    events: [CLICK, REVIEW_A, REVIEW_B, SAVE],
    initial_extended_state: { switch: true, reviewed: false },
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', action: ACTION_IDENTITY },
          { predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          { predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', action: ACTION_IDENTITY },
          { predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', action: ACTION_IDENTITY }
        ]
      },
      { from: 'B', event: CLICK, to: 'C', action: setBdata },
      {
        from: 'C', event: CLICK, guards: [
          { predicate: function isValid(x, e) {return e.valid}, to: 'D', action: setCvalidData },
          { predicate: function isNotValid(x, e) {return !e.valid}, to: 'C', action: setCinvalidData }
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', action: setReviewed },
      { from: 'D', event: REVIEW_B, to: 'B', action: ACTION_IDENTITY },
      { from: 'D', event: SAVE, to: 'E', action: setReviewedAndOuput },
    ],
  };
  const genFsmDef = {
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          {
            predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', gen: function genINIT2A(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.switch
              }
            }
          },
          {
            predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', gen: function genINIT2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.switch
              }
            }
          }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          {
            predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', gen: function genA2D(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.reviewed
              }
            }
          },
          {
            predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', gen: function genA2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.reviewed
              }
            }
          }
        ]
      },
      {
        from: 'B',
        event: CLICK,
        to: 'C',
        gen: function genB2C(extS) {return { input: dummyB, hasGeneratedInput: true }}
      },
      {
        from: 'C', event: CLICK, guards: [
          {
            predicate: function isValid(x, e) {return e.valid},
            to: 'D',
            gen: function genC2D(extS) {return { input: dummyCv, hasGeneratedInput: true }}
          },
          {
            predicate: function isNotValid(x, e) {return !e.valid},
            to: 'C',
            gen: function genC2C(extS) {return { input: dummyCi, hasGeneratedInput: true }}
          },
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: REVIEW_B, to: 'B', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: SAVE, to: 'E', gen: extS => ({ input: null, hasGeneratedInput: true }) },
    ],
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 2;
  const target = 'E';
  /** @type SearchSpecs*/
  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestsFromFSM(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
    ["nok", "A", "B", "C", "D", "A", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "A", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "A", "D", "B", "C", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "B", "C", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "D", "B", "C", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "A", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "B", "C", "D", "A", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "B", "C", "D", "A", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "B", "C", "D", "E"],
    ["nok", "A", "B", "C", "C", "C", "D", "E"]
  ], `...`);
});

// NOTE : this is a state machine with the same semantics as the first test, only that we have extra compound state
QUnit.test("INIT event multi transitions, self-loop, 1-loop, 2-loops, conditions, inner INIT event transitions", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { A: '', B: '', C: '', OUTER_GROUP_D: { INNER_GROUP_D: { D: '' }, E: '' } },
    events: [CLICK, REVIEW_A, REVIEW_B, SAVE],
    initial_extended_state: { switch: false, reviewed: false },
    transitions: [
      // TODO : check if the actions are located where they should? Can I have actions on a group state?? not if I
      // have outputs THINK, maybe allow to aggregate outputs on the path, just like extended state is, but then
      // output can also be an array of outputs, can be annoying on the receiving end
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
  const genFsmDef = {
    transitions: [
      // TODO : check if the actions are located where they should? Can I have actions on a group state?? not if I
      // have outputs THINK, maybe allow to aggregate outputs on the path, just like extended state is, but then
      // output can also be an array of outputs, can be annoying on the receiving end
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
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          {
            predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', gen: function genINIT2A(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.switch
              }
            }
          },
          {
            predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', gen: function genINIT2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.switch
              }
            }
          }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          {
            predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', gen: function genA2D(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.reviewed
              }
            }
          },
          {
            predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', gen: function genA2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.reviewed
              }
            }
          }
        ]
      },
      {
        from: 'B',
        event: CLICK,
        to: 'C',
        gen: function genB2C(extS) {return { input: dummyB, hasGeneratedInput: true }}
      },
      {
        from: 'C', event: CLICK, guards: [
          {
            predicate: function isValid(x, e) {return e.valid},
            to: 'INNER_GROUP_D',
            gen: function genC2D(extS) {return { input: dummyCv, hasGeneratedInput: true }}
          },
          {
            predicate: function isNotValid(x, e) {return !e.valid},
            to: 'C',
            gen: function genC2C(extS) {return { input: dummyCi, hasGeneratedInput: true }}
          },
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: REVIEW_B, to: 'B', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: SAVE, to: 'E', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      // No need for input generators on automatic events (except at machine start time)
      { from: 'OUTER_GROUP_D', event: INIT_EVENT, to: 'INNER_GROUP_D' },
      { from: 'INNER_GROUP_D', event: INIT_EVENT, to: 'D' },
    ],
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 1;
  const target = 'E';
  /** @type SearchSpecs*/
  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestsFromFSM(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
    ["nok", "B", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "B", "C", "INNER_GROUP_D", "D", "E"],
    ["nok", "B", "C", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "B", "C", "C", "INNER_GROUP_D", "D", "E"]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.inputSequence), [
    [
      { "init": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "init": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }],
    [
      { "init": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "init": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }
    ]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.outputSequence), [
    [
      null, undefined, null, undefined, null, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      null, undefined, null, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": false,
      "switch": true
    }
    ],
    [
      null, undefined, undefined, null, undefined, null, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      null, undefined, undefined, null, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": false,
      "switch": true
    }
    ]
  ], `...`);

});

// NOTE : this is a state machine with the same semantics as the first test, only that we have extra eventless
// transition
QUnit.test("INIT event multi transitions, self-loop, 1-loop, 2-loops, conditions, inner INIT event transitions", function exec_test(assert) {
  const CLICK = 'click';
  const REVIEW_A = 'reviewA';
  const REVIEW_B = 'reviewB';
  const SAVE = 'save';
  const fsmDef = {
    states: { A: '', B: '', C: '', OUTER_GROUP_D: { INNER_GROUP_D: { D: '' }, E: '' } },
    events: [CLICK, REVIEW_A, REVIEW_B, SAVE],
    initial_extended_state: { switch: false, reviewed: false },
    transitions: [
      // TODO : check if the actions are located where they should? Can I have actions on a group state?? not if I
      // have outputs THINK, maybe allow to aggregate outputs on the path, just like extended state is, but then
      // output can also be an array of outputs, can be annoying on the receiving end
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
  const genFsmDef = {
    transitions: [
      // TODO : check if the actions are located where they should? Can I have actions on a group state?? not if I
      // have outputs THINK, maybe allow to aggregate outputs on the path, just like extended state is, but then
      // output can also be an array of outputs, can be annoying on the receiving end
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
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          {
            predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', gen: function genINIT2A(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.switch
              }
            }
          },
          {
            predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', gen: function genINIT2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.switch
              }
            }
          }
        ]
      },
      {
        from: 'A', event: CLICK, guards: [
          {
            predicate: function isReviewed(x, e) {return x.reviewed}, to: 'D', gen: function genA2D(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.reviewed
              }
            }
          },
          {
            predicate: function isNotReviewed(x, e) {return !x.reviewed}, to: 'B', gen: function genA2B(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.reviewed
              }
            }
          }
        ]
      },
      {
        from: 'B',
        event: CLICK,
        to: 'C',
        gen: function genB2C(extS) {return { input: dummyB, hasGeneratedInput: true }}
      },
      {
        from: 'C', event: CLICK, guards: [
          {
            predicate: function isValid(x, e) {return e.valid},
            to: 'INNER_GROUP_D',
            gen: function genC2D(extS) {return { input: dummyCv, hasGeneratedInput: true }}
          },
          {
            predicate: function isNotValid(x, e) {return !e.valid},
            to: 'C',
            gen: function genC2C(extS) {return { input: dummyCi, hasGeneratedInput: true }}
          },
        ]
      },
      { from: 'D', event: REVIEW_A, to: 'A', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: REVIEW_B, to: 'B', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      { from: 'D', event: SAVE, to: 'E', gen: extS => ({ input: null, hasGeneratedInput: true }) },
      // No need for input generators on automatic events (except at machine start time)
      { from: 'OUTER_GROUP_D', event: INIT_EVENT, to: 'INNER_GROUP_D' },
      { from: 'INNER_GROUP_D', event: INIT_EVENT, to: 'D' },
    ],
  };
  const generators = genFsmDef.transitions;
  const maxNumberOfTraversals = 1;
  const target = 'E';
  /** @type SearchSpecs*/
  const strategy = {
    isTraversableEdge: (edge, graph, pathTraversalState, graphTraversalState) => {
      return computeTimesCircledOn(pathTraversalState.path, edge) < (maxNumberOfTraversals || 1)
    },
    isGoalReached: (edge, graph, pathTraversalState, graphTraversalState) => {
      const { getEdgeTarget, getEdgeOrigin } = graph;
      const lastPathVertex = getEdgeTarget(edge);
      // Edge case : accounting for initial vertex
      const vertexOrigin = getEdgeOrigin(edge);

      const isGoalReached = vertexOrigin ? lastPathVertex === target : false;
      return isGoalReached
    },
  };
  const settings = merge(default_settings, { strategy });
  const results = generateTestsFromFSM(fsmDef, generators, settings);
  const formattedResults = results.map(formatResult);
  assert.deepEqual(formattedResults.map(x => x.controlStateSequence), [
    ["nok", "B", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "B", "C", "INNER_GROUP_D", "D", "E"],
    ["nok", "B", "C", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "B", "C", "C", "INNER_GROUP_D", "D", "E"]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.inputSequence), [
    [
      { "init": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "init": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }],
    [
      { "init": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "init": null },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }
    ]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.outputSequence), [
    [
      null, undefined, null, undefined, null, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      null, undefined, null, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": false,
      "switch": true
    }
    ],
    [
      null, undefined, undefined, null, undefined, null, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      null, undefined, undefined, null, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": false,
      "switch": true
    }
    ]
  ], `...`);

});
