import * as QUnit from "qunitjs"
import * as Rx from "rx"
import { F, merge, T } from "ramda"
import { ACTION_IDENTITY, computeTimesCircledOn, generateTestsFromFSM, INIT_EVENT, INIT_STATE, NO_OUTPUT } from "../src"
import { formatResult } from "./helpers"

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

const a_value = "some value";
const another_value = "another value";
const model_initial = {
  a_key: a_value,
  another_key: another_value
};

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
    transitions: [
      {
        from: INIT_STATE, to: 'A', event: INIT_EVENT, gen: function genFn(extendedState) {
          return { input: extendedState, hasGeneratedInput: true }
        }
      }
    ],
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
    ],
    outputs: NO_OUTPUT
  }
}

function setCinvalidData(extendedState, eventData) {
  return {
    model_update: [
      { op: 'add', path: '/c', value: { error: eventData.error, data: eventData.data } },
      { op: 'add', path: '/switch', value: false },
    ],
    outputs: NO_OUTPUT
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
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
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
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
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
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
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
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
        NO_OUTPUT,
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
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          {
            predicate: function isSwitchOn(x, e) {return x.switch}, to: 'A', gen: function genINIT2A(extS) {
              return {
                input: extS, // does not matter, the guard does not depend on e
                hasGeneratedInput: extS.switch
              }
            }
          },
          {
            predicate: function isSwitchOff(x, e) {return !x.switch}, to: 'B', gen: function genINIT2B(extS) {
              return {
                input: extS, // does not matter, the guard does not depend on e
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
      { "init": fsmDef.initial_extended_state },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "init": fsmDef.initial_extended_state },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }],
    [
      { "init": fsmDef.initial_extended_state },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "reviewA": null },
      { "click": null },
      { "save": null }
    ],
    [
      { "init": fsmDef.initial_extended_state },
      { "click": { "keyB": "valueB" } },
      { "click": { "data": "invalid key for C", "valid": false } },
      { "click": { "data": "valueC", "valid": true } },
      { "save": null }
    ]
  ], `...`);
  assert.deepEqual(formattedResults.map(x => x.outputSequence), [
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": false,
      "switch": true
    }
    ],
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
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
QUnit.test("eventless transitions, inner INIT event transitions, loops", function exec_test(assert) {
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
            predicate: function isNotReviewed(x, e) {return !x.reviewed},
            to: 'EVENTLESS',
            gen: function genA2eventLess(extS) {
              return {
                input: null, // does not matter, the guard does not depend on e
                hasGeneratedInput: !extS.reviewed
              }
            }
          }
        ]
      },
      { from: 'EVENTLESS', to: 'B' },
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
    ["nok", "EVENTLESS", "B", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "EVENTLESS", "B", "C", "INNER_GROUP_D", "D", "E"],
    ["nok", "EVENTLESS", "B", "C", "C", "INNER_GROUP_D", "D", "A", "OUTER_GROUP_D", "INNER_GROUP_D", "D", "E"],
    ["nok", "EVENTLESS", "B", "C", "C", "INNER_GROUP_D", "D", "E"]
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
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": false,
      "switch": true
    }
    ],
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": true,
      "switch": true
    }
    ],
    [
      NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, NO_OUTPUT, {
      "b": { "keyB": "valueB" },
      "c": { "data": "valueC", "error": null },
      "reviewed": false,
      "switch": true
    }
    ]
  ], `...`);
});
