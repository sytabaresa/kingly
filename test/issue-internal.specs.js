import * as QUnit from "qunitjs";
import {ACTION_IDENTITY, createStateMachine} from "../src";
import {tracer} from "../devtool";

const f = (a, b) => [].concat(...a.map(d => b.map(e => [].concat(d, e))));
const cartesian = (a, b, ...c) => (b ? cartesian(f(a, b), ...c) : a);
const updateState = (extendedState, updates) => Object.assign({}, extendedState, updates);
const traceTransition = str => ({ outputs: [str], updates: {} });

const settings = {debug: {devtool:tracer}}

QUnit.module("Analyzing possible issue encountered while testing compiler", {});

QUnit.test("no_hierarchy_eventful_eventless_guards", function exec_test(assert) {
  // TODO: write an option that generates states, event, and transitions in the console or a file for debugging purposes
  const eventSpace = [{event: 1}, {event: 2}, {event: 4}, {event: 3}, {event: 6}, {event: 0}];
  const guards = {
    shouldReturnToA: (s, e, stg) => Boolean(s.shouldReturnToA),
    // This time we test on event data, so we test also the guard parameters
    // are as expected
    condition1: (s, e, stg) => Boolean(e & 1),
    condition2: (s, e, stg) => Boolean(e & 2),
    condition3: (s, e, stg) => Boolean(e & 4),
  };
  const actionFactories = {
    logAtoTemp1: (s, e, stg) => traceTransition('A -> Temp1'),
    logTemp1toA: (s, e, stg) => traceTransition('Temp1 -> A'),
    logAtoTemp2: (s, e, stg) => traceTransition('A -> Temp2'),
    logTemp2toA: (s, e, stg) => traceTransition('Temp2 -> A'),
    logAtoDone: (s, e, stg) => traceTransition('A -> Done'),
  };
  const doNothing = () => ({updates: [], outputs: []});

  const states = {
    n1ღA: '',
    n2ღTemp1: '',
    n3ღTemp2: '',
    n4ღDone: '',
  };
  const events = ['event'];
  const transitions = [
    {
      "from": "nok",
      "event": "init",
      "to": "n1ღA",
      "action": doNothing
    },
    {
      "from": "n1ღA",
      "event": "event",
      "guards": [
        {
          "predicate": guards.condition1,
          "to": "n2ღTemp1",
          "action": actionFactories.logAtoTemp1
        },
        {
          "predicate": guards.condition2,
          "to": "n3ღTemp2",
          "action": actionFactories.logAtoTemp2
        },
        {"predicate": guards.condition3, "to": "n4ღDone", "action": actionFactories.logAtoDone}
      ]
    },
    {"from": "n2ღTemp1", "event": "", "to": "n1ღA", "action": actionFactories.logTemp1toA},
    {
      "from": "n3ღTemp2",
      "event": "",
      "to": "n1ღA",
      "action": actionFactories.logTemp2toA
    },
    {
      "from": "n4ღDone",
      "event": "",
      "guards": [{"predicate": guards.shouldReturnToA, "to": "n1ღA", "action": doNothing}]
    }
  ];


  // Two machines to test the guard and achieve all-transition coverage
  const fsmDef1 = {
    updateState,
    initialExtendedState: {shouldReturnToA: false},
    events,
    states,
    transitions,
  };
  const inputSpace = cartesian([0, 1, 2, 3, 4, 5], [0, 1, 2, 3, 4, 5]);
  const cases = inputSpace.map(scenario => {
    return [eventSpace[scenario[0]], eventSpace[scenario[1]]];
  });
  const outputs1 = cases.map(scenario => {
    const fsm1 = createStateMachine(fsmDef1, settings);
    return scenario.map(fsm1);
  });
  const expected1 = [
    // [cond1, cond1]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    // [cond1, cond2]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    // [cond1, cond3]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Done', null]],
    // [cond1, cond12]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    // [cond1, cond23]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    // [!cond]
    [['A -> Temp1', 'Temp1 -> A'], null],
    // [cond2, x]
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Done', null]],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], null],
    // [cond3, x]
    [['A -> Done', null], null],
    [['A -> Done', null], null],
    [['A -> Done', null], null],
    [['A -> Done', null], null],
    [['A -> Done', null], null],
    [['A -> Done', null], null],
    // [cond12, x]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Done', null]],
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp1', 'Temp1 -> A'], null],
    // [cond23, x]
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Done', null]],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], null],
    // [!cond, x]
    [null, ['A -> Temp1', 'Temp1 -> A']],
    [null, ['A -> Temp2', 'Temp2 -> A']],
    [null, ['A -> Done', null]],
    [null, ['A -> Temp1', 'Temp1 -> A']],
    [null, ['A -> Temp2', 'Temp2 -> A']],
    [null, null],
  ];

  const fsmDef2 = {
    updateState,
    initialExtendedState: {shouldReturnToA: true},
    events,
    states,
    transitions,
  };
  const outputs2 = cases.map(scenario => {
    const fsm2 = createStateMachine(fsmDef2, settings);
    return scenario.map(fsm2);
  });
  const expected2 = [
    // [cond1, cond1]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    // [cond1, cond2]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    // [cond1, cond3]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Done', null]],
    // [cond1, cond12]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    // [cond1, cond23]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    // [!cond]
    [['A -> Temp1', 'Temp1 -> A'], null],
    // [cond2, x]
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Done', null]],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], null],
    // [cond3, x]
    [['A -> Done', null], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Done', null], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Done', null], ['A -> Done', null]],
    [['A -> Done', null], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Done', null], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Done', null], null],
    // [cond12, x]
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Done', null]],
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp1', 'Temp1 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp1', 'Temp1 -> A'], null],
    // [cond23, x]
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Done', null]],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp1', 'Temp1 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], ['A -> Temp2', 'Temp2 -> A']],
    [['A -> Temp2', 'Temp2 -> A'], null],
    // [!cond, x]
    [null, ['A -> Temp1', 'Temp1 -> A']],
    [null, ['A -> Temp2', 'Temp2 -> A']],
    [null, ['A -> Done', null]],
    [null, ['A -> Temp1', 'Temp1 -> A']],
    [null, ['A -> Temp2', 'Temp2 -> A']],
    [null, null],
  ];

  assert.deepEqual(outputs1, expected1, `Branch machine initialized with number ok`);
  // TODO: possible error is there, in the third scenario, the null at the end should not be there
  assert.deepEqual(outputs2, expected2, `Branch machine initialized with string ok`);

});

