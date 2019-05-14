const t = window.StateTransducer = {}
const e = ".",
  n = "--\x3e",
  s = ":",
  o = "H",
  i = "history.",
  a = "nok",
  r = "init",
  c = "auto",
  u = "State",
  l = [],
  d = null,
  f = function() {
    return {
      outputs: d,
      updates: l
    }
  },
  p = {},
  m = "shallow",
  h = "deep",
  g = "The machine received an event which does not have the proper format. Expecting an object whose unique key is the event name, and value is the event data.",
  y = (t, e) => `Exception thrown when executing ${e} ${t||""}`,
  b = (t, e) => `${y(t,e)}\nThe ${e} returned a value which is not an action.`,
  v = (t, e) => `${y(t,e)}\nThe ${e} returned a value which is not a boolean.`,
  T = "action factory",
  S = "(decorating) entry action",
  E = "update state function",
  O = "predicate",
  A = [0],
  _ = "PRE_ORDER";

function w(t) {
  return void 0 === t ? void 0 : JSON.parse(JSON.stringify(t))
}

function C(t, e) {
  return Object.assign({}, t, e)
}

function j(t, e, n) {
  n.forEach((n, s) => {
    const o = t.get(e),
      i = t.get(n),
      a = i && i.path;
    t.set(n, C(i, {
      isAdded: !0,
      isVisited: !1,
      path: a || o.path.concat(s)
    }))
  })
}

function F(t, e) {
  t.set(e, C(t.get(e), {
    isVisited: !0
  }))
}

function N(t, e) {
  const {
    store: n,
    lenses: s,
    traverse: o
  } = t, {
    empty: i,
    add: a,
    takeAndRemoveOne: r,
    isEmpty: c
  } = n, {
    getChildren: u
  } = s, {
    visit: l,
    seed: d
  } = o, f = new Map, p = "function" == typeof d ? new(d()) : w(d);
  let m = "function" == typeof i ? new(i()) : w(i),
    h = p;
  for (a([e], m), f.set(e, {
    isAdded: !0,
    isVisited: !1,
    path: A
  }); !c(m);) {
    const t = r(m),
      e = u(f, t);
    a(e, m), j(f, t, e), h = l(h, f, t), F(f, t)
  }
  return f.clear(), h
}

function k(t, e, n) {
  const {
    getChildren: s
  } = t;
  return N({
    store: {
      empty: [],
      takeAndRemoveOne: t => t.shift(),
      isEmpty: t => 0 === t.length,
      add: (t, e) => e.push.apply(e, t)
    },
    lenses: {
      getChildren: (t, e) => s(e)
    },
    traverse: e
  }, n)
}

function x(t, e, n) {
  const {
    getChildren: s
  } = t;
  return N({
    store: {
      empty: [],
      takeAndRemoveOne: t => t.shift(),
      isEmpty: t => 0 === t.length,
      add: (t, e) => e.unshift(...t)
    },
    lenses: {
      getChildren: (t, e) => s(e)
    },
    traverse: e
  }, n)
}

function I(t, e, n) {
  const {
    getChildren: s
  } = t, {
    seed: o,
    visit: i
  } = e, a = (t, e) => e.get(t).isVisited || ((t, e) => 0 === s(t, e).length)(t, e);
  return N({
    store: {
      empty: [],
      takeAndRemoveOne: t => t.shift(),
      isEmpty: t => 0 === t.length,
      add: (t, e) => e.unshift(...t)
    },
    lenses: {
      getChildren: (t, e) => a(e, t) ? [] : s(e, t).concat([e])
    },
    traverse: {
      seed: o,
      visit: (t, e, n) => a(n, e) ? i(t, e, n) : t
    }
  }, n)
}
const M = {
  isLeafLabel: function(t) {
    return 0 === M.getChildren(t).length
  },
  getLabel: t => {
    if ("object" != typeof t || Array.isArray(t) || 1 !== Object.keys(t).length) throw "getLabel > unexpected object tree value";
    return t
  },
  getChildren: t => {
    if ("object" != typeof t || Array.isArray(t) || 1 !== Object.keys(t).length) throw "getChildren > unexpected value"; {
      let e = Object.values(t)[0];
      return e && "object" == typeof e && !Array.isArray(e) ? Object.keys(e).map(t => ({
        [t]: e[t]
      })) : []
    }
  },
  constructTree: (t, e) => {
    const n = t && Object.keys(t) && Object.keys(t)[0];
    return 0 === e.length ? t : {
      [n]: Object.assign.apply(null, e)
    }
  }
};

function R(t, e) {
  const n = {
      root: e
    },
    {
      strategy: s,
      seed: o,
      visit: i
    } = t;
  return ({
    BFS: k,
    PRE_ORDER: x,
    POST_ORDER: I
  }[s] || x)(M, {
    seed: o,
    visit: function(t, e, n) {
      const {
        path: s
      } = e.get(n);
      return JSON.stringify(s) === JSON.stringify(A) ? t : i(t, e, n)
    }
  }, n)
}
const D = {
    getLabel: t => Array.isArray(t) ? t[0] : t,
    getChildren: t => Array.isArray(t) ? t[1] : [],
    constructTree: (t, e) => e && Array.isArray(e) && e.length > 0 ? [t, e] : t
  },
  $ = () => {},
  L = {
    log: $,
    warn: $,
    info: $,
    debug: $,
    error: $,
    trace: $
  };

function H(t) {
  return "boolean" == typeof t
}

function P(t) {
  return "function" == typeof t
}

function B(t) {
  return t && "string" == typeof t || gt(t)
}

function U(t) {
  return t && "string" == typeof t
}

function V(t) {
  return t && "function" == typeof t
}

function W(t) {
  return /^[\s\r\n]*function[\s\r\n]*([^\(\s\r\n]*?)[\s\r\n]*\([^\)\s\r\n]*\)[\s\r\n]*\{((?:[^}]*\}?)+)\}\s*$/.exec(t.toString())[1]
}

function Y(t) {
  return ["-", t, "-"].join("")
}

function J(t, e) {
  return Array.apply(null, {
    length: e
  }).map(Number.call, Number).map(t)
}

function X(t) {
  return Object.keys(t)
}

function z(t) {
  return t.to.startsWith(i)
}

function q(t) {
  return t.event === r
}

function G(t) {
  return function(e) {
    return e.from === t
  }
}

function K(t) {
  return function(e) {
    return Q(t, e.to)
  }
}

function Q(t, e) {
  return e.substring(i.length) === t
}

function Z(t, e, n) {
  const s = t || "";
  return e && n ? `${s} [${e.name}] / ${n.name}` : e ? `${s} [${e.name}]}` : n ? `${s} / ${n.name}` : `${s}`
}

function tt({
              from: t,
              to: e
            }) {
  return `${t}.${e.substring(i.length)}.${o}`
}

function et(t) {
  const {
    from: e,
    event: n,
    guards: s
  } = t;
  return s ? s.map(({
                      predicate: t,
                      to: s,
                      action: o
                    }) => ({
    from: e,
    event: n,
    predicate: t,
    to: s,
    action: o
  })) : [t]
}

function nt(t) {
  return t.replace(/_/g, " ")
}

function st(t) {
  const {
    getLabel: e
  } = M;
  return R({
    strategy: _,
    seed: {},
    visit: (t, n, s) => {
      const o = e(s);
      return t[Object.keys(o)[0]] = "", t
    }
  }, t)
}

function ot(t) {
  const {
    getLabel: e,
    isLeafLabel: n
  } = M;
  return R({
    strategy: _,
    seed: {},
    visit: (t, s, o) => {
      const i = e(o),
        a = Object.keys(i)[0];
      return n(i) ? (t[a] = !1, t) : (t[a] = !0, t)
    }
  }, t)
}

function it(t) {
  const {
    getLabel: e
  } = M;
  return R({
    strategy: _,
    seed: {},
    visit: (t, n, s) => {
      const o = n.get(s).path.join("."),
        i = e(s);
      return t[Object.keys(i)[0]] = o, t
    }
  }, t)
}

function at(t) {
  return t.reduce((t, e) => {
    const {
      from: n,
      event: s
    } = e;
    return gt(n) ? t : (t[n] = t[n] || {}, t[n][s] = e, t)
  }, {}) || {}
}

function rt(t) {
  return t.reduce((t, e) => {
    const {
      from: n,
      event: s
    } = e;
    return gt(n) ? t : (t[n] = t[n] || {}, t[n][s] = t[n][s] ? t[n][s].concat(e) : [e], t)
  }, {}) || {}
}

function ct(t) {
  return t.reduce((t, e) => {
    const {
      from: n,
      event: s
    } = e;
    return gt(n) ? t : (t[s] = t[s] || {}, t[s][n] = t[s][n] ? t[s][n].concat(e) : [e], t)
  }, {}) || {}
}

function ut(t) {
  return mt((t, e, n, s) => {
    const {
      from: o,
      event: i,
      to: a,
      action: r,
      predicate: c,
      gen: u
    } = e;
    if (gt(o)) {
      const n = bt(o);
      t.set(n, (t.get(n) || []).concat([e]))
    } else if (gt(a)) {
      const n = bt(a);
      t.set(n, (t.get(n) || []).concat([e]))
    }
    return t
  }, new Map, t) || {}
}

function lt(t) {
  return mt((t, e, n, s) => {
    const {
      to: o
    } = e;
    return t.set(o, (t.get(o) || []).concat([e])), t
  }, new Map, t) || {}
}

function dt(t) {
  const {
    getLabel: e,
    getChildren: n
  } = M;
  return R({
    strategy: _,
    seed: {},
    visit: (t, s, o) => {
      const i = e(o),
        a = Object.keys(i)[0];
      return n(o).map(t => Object.keys(e(t))[0]).forEach(e => {
        t[e] = t[e] || [], t[e] = t[e].concat(a)
      }), t
    }
  }, t)
}

function ft(t) {
  if (0 === Object.keys(t).length) throw "computeHistoryMaps : passed empty control states parameter?";
  const {
    getLabel: e,
    isLeafLabel: n
  } = M, s = {
    strategy: _,
    seed: {
      stateList: [],
      stateAncestors: {
        [h]: {},
        [m]: {}
      }
    },
    visit: (t, n, s) => {
      const o = e(s),
        i = Object.keys(o)[0];
      t.stateList = t.stateList.concat(i);
      const {
        path: r
      } = n.get(s);
      n.set(JSON.stringify(r), i);
      const c = r.slice(0, -1);
      if (1 === c.length) n.set(JSON.stringify(c), a);
      else {
        const e = n.get(JSON.stringify(c));
        t.stateAncestors[m][i] = [e];
        const {
          ancestors: s
        } = r.reduce((t, e) => {
          const s = t.path.slice(0, -1);
          if (t.path = s, s.length > 1) {
            const e = n.get(JSON.stringify(s));
            t.ancestors = t.ancestors.concat(e)
          }
          return t
        }, {
          ancestors: [],
          path: r
        });
        t.stateAncestors[h][i] = s
      }
      return t
    }
  }, {
    stateList: o,
    stateAncestors: i
  } = R(s, t);
  return {
    stateList: o,
    stateAncestors: i
  }
}

function pt(t, e) {
  return mt(function(e, n, s, o) {
    const {
      from: i,
      event: a,
      to: r,
      action: c,
      predicate: u
    } = n, l = t(c, n, s, o);
    return l.displayName = l.displayName || c && (c.name || c.displayName || function(t, e, n, s, o) {
      const i = o ? o.name : "",
        a = i ? `[${i}]` : "",
        r = t ? t.name : "identity";
      return `${r||"unnamed action"}:${e}-${n}->${s} ${a}`
    }(c, i, a, r, u)), void 0 === u ? e.push({
      from: i,
      event: a,
      to: r,
      action: l
    }) : 0 === s ? e.push({
      from: i,
      event: a,
      guards: [{
        to: r,
        predicate: u,
        action: l
      }]
    }) : e[e.length - 1].guards.push({
      to: r,
      predicate: u,
      action: l
    }), e
  }, [], e)
}

function mt(t, e, n) {
  return n.reduce((e, n, s) => {
    let {
      from: o,
      event: i,
      to: a,
      gen: r,
      action: c,
      guards: u
    } = n;
    return u || (u = r ? [{
      to: a,
      action: c,
      gen: r,
      predicate: void 0
    }] : [{
      to: a,
      action: c,
      predicate: void 0
    }]), u.reduce((e, n, a) => {
      const {
        to: r,
        action: c,
        gen: u,
        predicate: l
      } = n;
      return t(e, u ? {
        from: o,
        event: i,
        to: r,
        action: c,
        predicate: l,
        gen: u
      } : {
        from: o,
        event: i,
        to: r,
        action: c,
        predicate: l
      }, a, s)
    }, e)
  }, e)
}

function ht(t) {
  return t === d ? d : Array.isArray(t) ? t : [t]
}

function gt(t) {
  return "object" == typeof t && (h in t || m in t)
}

function yt(t) {
  return t[h] ? h : m
}

function bt(t) {
  return t[yt(t)]
}

function vt(t) {
  const e = () => t.reduce((t, e) => (t[e] = "", t), {});
  return {
    [h]: e(),
    [m]: e()
  }
}

function Tt(t, e) {
  const {
    statesAdjacencyList: n
  } = t;
  return n[e] && 0 !== n[e].length
}

function St(t, e, n) {
  return n === a ? t : ([m, h].forEach(s => {
    (e[s][n] || []).forEach(e => {
      t[s][e] = n
    })
  }), t)
}

function Et(t) {
  return t.find(t => t.from === a && t.event === r)
}

function Ot(t, e) {
  return function(...n) {
    try {
      return t.apply(t, n)
    } catch (t) {
      return e(t, n)
    }
  }
}

function At(t, e, n = []) {
  return Ot(e, (s, o) => {
    const i = new Error(s),
      a = _t(e),
      r = y(a, t);
    i.probableCause = s.probableCause ? [s.probableCause, r].join("\n") : r;
    const c = {
      fnName: a,
      params: n.reduce((t, e, n) => (t[e] = o[n], t), {})
    };
    return i.info = s.info ? [].concat([s.info]).concat([c]) : c, i
  })
}

function _t(t) {
  return t.name || t.displayName || "anonymous"
}

function wt(t, e) {
  const n = t.apply(null, e);
  if (!0 !== n) {
    const e = n.info;
    throw console.error(`ERROR: failed contract ${t.name||""}. ${e?"Error info:":""}`, n.info), n
  }
}

function Ct(t, e) {
  t.error(e), e.probableCause && t.error(`Probable cause: ${e.probableCause}`), e.info && t.error("ERROR: additional info", e.info)
}

function jt(t, e, n, s, o, i) {
  const {
    debug: a,
    console: r
  } = t;
  return a && n instanceof Error ? (o({
    debug: a,
    console: r
  }, n, e), !0) : !(!a || s(n)) && (i({
    debug: a,
    console: r
  }, n, e), !0)
}

function Ft({
              debug: t,
              console: e
            }, n) {
  throw Ct(e, n), n
}

function Nt({
              debug: t,
              console: e
            }, n, s) {
  const {
    action: o,
    extendedState: i,
    eventData: a,
    settings: r
  } = s, c = _t(o), u = new Error(b(c, T));
  throw u.info = {
    fnName: _t(o),
    params: {
      updatedExtendedState: i,
      eventData: a,
      settings: r
    },
    returned: n
  }, Ct(e, u), u
}

function kt({
              debug: t,
              console: e
            }, n, s) {
  const o = _t(s.predicate),
    i = new Error(v(o, O));
  throw i.info = {
    predicateName: o,
    params: s,
    returned: n
  }, Ct(e, i), i
}

function xt({
              debug: t,
              console: e
            }, n, s) {
  const {
    action: o,
    extendedState: i,
    eventData: a,
    settings: r
  } = s, c = _t(o), u = new Error(b(c, S));
  throw u.info = {
    fnName: _t(o),
    params: {
      updatedExtendedState: i,
      eventData: a,
      settings: r
    },
    returned: n
  }, Ct(e, u), u
}

function It(t) {
  return t && "updates" in t && "outputs" in t && (t.outputs === d || Array.isArray(t.outputs)) && Array.isArray(t.updates)
}

function Mt(t) {
  let e;
  return t && "object" == typeof t ? Object.keys(t).length > 1 ? (e = new Error(g)).info = {
    event: t,
    cause: "Event objects must have only one key which is the event name!"
  } : e = !0 : (e = new Error(g)).info = {
    event: t,
    cause: "not an object!"
  }, e
}

function Rt(t) {
  const {
    from: e,
    event: n,
    guards: s,
    to: o,
    action: i
  } = t;
  return void 0 === s && o && B(e) && U(n) && B(o) && V(i)
}

function Dt(t) {
  const {
    to: e,
    predicate: n,
    action: s
  } = t;
  return e && B(e) && P(n) && V(s)
}

function $t(t) {
  const {
    from: e,
    event: n,
    guards: s,
    to: o
  } = t;
  return s && Array.isArray(s) && s.length > 0 && !o && B(e) && U(n) && s.every(Dt)
}
const Lt = {
  computed: (t, e) => ({
    statesType: ot(t.states),
    initTransition: Et(t.transitions),
    statesTransitionsMap: at(t.transitions),
    statesTransitionsMaps: rt(t.transitions),
    eventTransitionsMaps: ct(t.transitions),
    ancestorMap: dt(t.states),
    statesPath: it(t.states),
    historyStatesMap: ut(t.transitions),
    targetStatesMap: lt(t.transitions)
  }),
  description: "FSM structure",
  contracts: [{
    name: "isValidFsmDef",
    shouldThrow: !1,
    predicate: (t, e) => {
      const {
        transitions: n,
        states: s,
        events: o,
        initialExtendedState: i
      } = t, a = n && Array.isArray(n), r = s && "object" == typeof s, c = o && Array.isArray(o);
      return a ? r ? c ? {
        isFulfilled: !0,
        blame: void 0
      } : {
        isFulfilled: !1,
        blame: {
          message: "The events property for a machine definition must be an array!",
          info: {
            events: o
          }
        }
      } : {
        isFulfilled: !1,
        blame: {
          message: "The states property for a machine definition must be an object!",
          info: {
            states: s
          }
        }
      } : {
        isFulfilled: !1,
        blame: {
          message: "The transitions property for a machine definition must be an array!",
          info: {
            transitions: n
          }
        }
      }
    }
  }, {
    name: "isValidSettings",
    shouldThrow: !1,
    predicate: t => ({
      isFulfilled: !0,
      blame: void 0
    })
  }, {
    name: "isInitialControlStateDeclared",
    shouldThrow: !1,
    predicate: (t, e, {
      initTransition: n,
      statesType: s
    }) => {
      const {
        initialControlState: o,
        transitions: i
      } = t, a = Object.keys(s);
      return o ? {
        isFulfilled: a.indexOf(o) > -1,
        blame: {
          message: "Configured initial control state must be a declared state. Cf. log",
          info: {
            initialControlState: o,
            declaredStates: a
          }
        }
      } : {
        isFulfilled: !0,
        blame: void 0
      }
    }
  }, {
    name: "isInitialStateOriginState",
    shouldThrow: !1,
    predicate: (t, e, {
      targetStatesMap: n
    }) => Array.from(n.keys()).indexOf(a) > -1 ? {
      isFulfilled: !1,
      blame: {
        message: "Found at least one transition with the initial state as target state! CF. log",
        info: {
          targetStates: Array.from(n.keys()),
          transitions: t.transitions
        }
      }
    } : {
      isFulfilled: !0,
      blame: void 0
    }
  }, {
    name: "eventsAreStrings",
    shouldThrow: !1,
    predicate: (t, e) => ({
      isFulfilled: t.events.every(t => "string" == typeof t),
      blame: {
        message: "Events must be an array of strings!",
        info: {
          events: t.events
        }
      }
    })
  }, {
    name: "haveTransitionsValidTypes",
    shouldThrow: !1,
    predicate: (t, e) => {
      const {
        transitions: n
      } = t, s = n.map((t, e) => !Rt(t) && !$t(t) && {
        transition: t,
        index: e
      }).filter(Boolean), o = Object.keys(s).length;
      return {
        isFulfilled: 0 === o,
        blame: {
          message: `Found ${o} transitions with invalid format! Check logs for more details.`,
          info: {
            wrongTransitions: s,
            transitions: n
          }
        }
      }
    }
  }, {
    name: "noDuplicatedStates",
    shouldThrow: !1,
    predicate: (t, e) => {
      const {
        getLabel: n
      } = M, s = {
        strategy: _,
        seed: {
          duplicatedStates: [],
          statesHashMap: {}
        },
        visit: (t, e, s) => {
          const {
            duplicatedStates: o,
            statesHashMap: i
          } = t, a = n(s), r = Object.keys(a)[0];
          return r in i ? {
            duplicatedStates: o.concat(r),
            statesHashMap: i
          } : {
            duplicatedStates: o,
            statesHashMap: (i[r] = "", i)
          }
        }
      }, {
        duplicatedStates: o
      } = R(s, t.states);
      return {
        isFulfilled: 0 === o.length,
        blame: {
          message: "State names must be unique! Found duplicated state names. Cf. log",
          info: {
            duplicatedStates: o
          }
        }
      }
    }
  }, {
    name: "noReservedStates",
    shouldThrow: !1,
    predicate: (t, e, {
      statesType: n
    }) => ({
      isFulfilled: -1 === Object.keys(n).indexOf(a),
      blame: {
        message: "You cannot use a reserved control state name for any of the configured control states for the machine! Cf. log",
        info: {
          reservedStates: [a],
          statesType: n
        }
      }
    })
  }, {
    name: "atLeastOneState",
    shouldThrow: !1,
    predicate: (t, e, {
      statesType: n
    }) => ({
      isFulfilled: Object.keys(n).length > 0,
      blame: {
        message: "Machine configuration must define at least one control state! Cf. log",
        info: {
          statesType: n
        }
      }
    })
  }, {
    name: "areEventsDeclared",
    shouldThrow: !1,
    predicate: (t, e, {
      eventTransitionsMaps: n
    }) => {
      const s = Object.keys(n),
        o = t.events,
        i = o.map(t => -1 === s.indexOf(t) && t).filter(Boolean),
        a = s.map(t => -1 === o.indexOf(t) && t).filter(Boolean).filter(t => t !== r);
      return {
        isFulfilled: 0 === i.length && 0 === a.length,
        blame: {
          message: "All declared events must be used in transitions. All events used in transition must be declared! Cf. log",
          info: {
            eventsDeclaredButNotTriggeringTransitions: i,
            eventsNotDeclaredButTriggeringTransitions: a
          }
        }
      }
    }
  }, {
    name: "areStatesDeclared",
    shouldThrow: !1,
    predicate: (t, e, {
      statesTransitionsMaps: n,
      targetStatesMap: s,
      statesType: o
    }) => {
      const i = Object.keys(n),
        r = Array.from(s.keys()),
        c = Object.keys([i, r].reduce((t, e) => (e.forEach(e => t[e] = !0), t), {})),
        u = Object.keys(o),
        l = u.map(t => -1 === c.indexOf(t) && t).filter(Boolean),
        d = c.map(t => t !== a && -1 === u.indexOf(t) && t).filter(Boolean);
      return {
        isFulfilled: 0 === l.length && 0 === l.length,
        blame: {
          message: "All declared states must be used in transitions. All states used in transition must be declared! Cf. log",
          info: {
            statesDeclaredButNotTriggeringTransitions: l,
            statesNotDeclaredButTriggeringTransitions: d
          }
        }
      }
    }
  }, {
    name: "validInitialConfig",
    shouldThrow: !1,
    predicate: (t, e, {
      initTransition: n
    }) => {
      const {
        initialControlState: s
      } = t;
      return n && s ? {
        isFulfilled: !1,
        blame: {
          message: "Invalid machine configuration : defining an initial control state and an initial transition at the same time may lead to ambiguity and is forbidden!",
          info: {
            initialControlState: s,
            initTransition: n
          }
        }
      } : n || s ? {
        isFulfilled: !0,
        blame: void 0
      } : {
        isFulfilled: !1,
        blame: {
          message: "Invalid machine configuration : you must define EITHER an initial control state OR an initial transition! Else in which state is the machine supposed to start?",
          info: {
            initialControlState: s,
            initTransition: n
          }
        }
      }
    }
  }, {
    name: "validInitialTransition",
    shouldThrow: !1,
    predicate: (t, e, {
      initTransition: n
    }) => {
      const {
        initialControlState: s,
        transitions: o
      } = t, i = o.reduce((t, e) => (e.from === a && t.push(e), t), []);
      return {
        isFulfilled: s && !n || !s && n && 1 === i.length && n.event === r && (Rt(n) || $t(n)),
        blame: {
          message: "Invalid configuration for initial transition! Cf. log",
          info: {
            initTransition: n,
            initTransitions: i,
            initialControlState: s
          }
        }
      }
    }
  }, {
    name: "initEventOnlyInCompoundStates",
    shouldThrow: !1,
    predicate: (t, e, {
      statesTransitionsMap: n,
      statesType: s,
      statesPath: o
    }) => {
      const i = Object.keys(s).filter(t => !s[t]).map(t => ({
        [t]: n[t] && n[t][r]
      })).filter(t => Object.values(t)[0]);
      return {
        isFulfilled: 0 === i.length,
        blame: {
          message: "Found at least one atomic state with an entry transition! That is forbidden! Cf. log",
          info: {
            initTransitions: i
          }
        }
      }
    }
  }, {
    name: "validInitialTransitionForCompoundState",
    shouldThrow: !1,
    predicate: (t, e, {
      statesTransitionsMap: n,
      statesType: s,
      statesPath: o
    }) => {
      const i = Object.keys(s).filter(t => s[t]),
        a = i.map(t => n[t] && n[t][r]),
        c = a.every(Boolean);
      if (!c) return {
        isFulfilled: !1,
        blame: {
          message: "Found at least one compound state without an entry transition! Cf. log",
          info: {
            hasEntryTransitions: i.map(t => ({
              [t]: !(!n[t] || !n[t][r])
            }))
          }
        }
      };
      const u = c && a.every(t => {
        const {
          guards: e,
          to: n
        } = t;
        return !e && "string" == typeof n
      });
      return u ? u && a.every(t => {
        const {
          from: e,
          to: n
        } = t;
        return e !== n && o[n] && o[n].startsWith(o[e])
      }) ? {
        isFulfilled: !0,
        blame: void 0
      } : {
        isFulfilled: !1,
        blame: {
          message: "Found at least one compound state with an invalid entry transition! Entry transitions for compound states must have a target state which is strictly below the compound state in the state hierarchy! ",
          info: {
            states: t.states,
            statesPath: o,
            entryTransitions: a
          }
        }
      } : {
        isFulfilled: !1,
        blame: {
          message: "Found at least one compound state with an invalid entry transition! Entry transitions for compound states must be inconditional and the associated target control state cannot be a history pseudo-state. Cf. log",
          info: {
            entryTransitions: a
          }
        }
      }
    }
  }, {
    name: "validEventLessTransitions",
    shouldThrow: !1,
    predicate: (t, e, {
      statesTransitionsMap: n,
      statesType: s,
      statesPath: o
    }) => {
      const i = Object.keys(s).map(t => ({
        [t]: n[t] && "undefined" in n[t] && 1 !== Object.keys(n[t]).length
      })).filter(t => void 0 !== Object.values(t)[0] && Object.values(t)[0]);
      return {
        isFulfilled: 0 === i.length,
        blame: {
          message: "Found at least one control state without both an eventless transition and a competing transition! Cf. log",
          info: {
            failingOriginControlStates: i
          }
        }
      }
    }
  }, {
    name: "isValidSelfTransition",
    shouldThrow: !1,
    predicate: (t, e, {
      targetStatesMap: n,
      statesType: s
    }) => {
      const o = Array.from(n.keys()).map(t => {
        return n.get(t).map(e => {
          const {
            from: n,
            event: o
          } = e;
          if (t in s && !s[t] && n && n === t && !o) return {
            state: t,
            flatTransition: e
          }
        }).filter(Boolean)
      }).filter(t => t.length > 0);
      return {
        isFulfilled: 0 === o.length,
        blame: {
          message: "Found at least one eventless self-transition involving an atomic state! This is forbidden to avoid infinity loop! Cf. log",
          info: {
            wrongSelfTransitions: o
          }
        }
      }
    }
  }, {
    name: "allStateTransitionsOnOneSingleRow",
    shouldThrow: !1,
    predicate: (t, e, {
      statesTransitionsMaps: n
    }) => {
      const s = Object.keys(n).reduce((t, e) => {
        const s = Object.keys(n[e]).filter(t => n[e][t].length > 1);
        return s.length > 0 && (t[e] = s), t
      }, {});
      return {
        isFulfilled: 0 === Object.keys(s).length,
        blame: {
          message: "Found at least one control state and one event for which the associated transition are not condensated under a unique row! Cf. log",
          info: {
            statesTransitionsInfo: s
          }
        }
      }
    }
  }, {
    name: "noConflictingTransitionsWithAncestorState",
    shouldThrow: !1,
    predicate: (t, e, {
      statesTransitionsMaps: n,
      eventTransitionsMaps: s,
      ancestorMap: o
    }) => {
      const i = Object.keys(s).reduce((t, e) => {
        const n = Object.keys(s[e]),
          i = n.filter(t => t !== a).map(t => o[t] && {
            [t]: o[t].find(t => n.indexOf(t) > -1)
          }).filter(t => t && Object.values(t).filter(Boolean).length > 0);
        return i.length > 0 && (t[e] = i), t
      }, {});
      return {
        isFulfilled: 0 === Object.keys(i).length,
        blame: {
          message: "Found two conflicting transitions! A -ev-> X, and B -ev-> Y leads to ambiguity if A < B or B < A. Cf. log",
          info: {
            eventTransitionsInfo: i
          }
        }
      }
    }
  }, {
    name: "isHistoryStatesExisting",
    shouldThrow: !1,
    predicate: (t, e, {
      historyStatesMap: n,
      statesType: s
    }) => {
      const o = Array.from(n.entries()).map(([t, e]) => !(t in s) && {
          historyState: t,
          flatTransitions: e
        }).filter(Boolean),
        i = Object.keys(o).length;
      return {
        isFulfilled: 0 === i,
        blame: {
          message: `Found ${i} history pseudo state referring to a control state that is not declared! Check the states property of the state machine definition.`,
          info: {
            invalidTransitions: o,
            states: t.states
          }
        }
      }
    }
  }, {
    name: "isHistoryStatesTargetStates",
    shouldThrow: !1,
    predicate: (t, e, {}) => {
      const n = t.transitions.reduce((t, e) => gt(e.from) ? t.concat(e) : t, []);
      return {
        isFulfilled: 0 === Object.keys(n).length,
        blame: {
          message: "Found a history pseudo state configured as the origin control state for a transition. History pseudo states should only be target control states. Cf. log",
          info: {
            wrongHistoryStates: n
          }
        }
      }
    }
  }, {
    name: "isHistoryStatesCompoundStates",
    shouldThrow: !1,
    predicate: (t, e, {
      statesTransitionsMaps: n,
      statesType: s
    }) => {
      const o = Object.keys(n).map(t => {
        if (t === a) return [];
        return Object.keys(n[t]).reduce((e, o) => {
          const i = n[t][o][0],
            {
              guards: a,
              to: r
            } = i;
          return a ? a.reduce((t, e) => {
            const {
              to: n
            } = e;
            return gt(n) && !s[bt(n)] ? t.concat(i) : t
          }, e) : gt(r) && !s[bt(r)] ? e.concat(i) : e
        }, [])
      }).reduce((t, e) => t.concat(e), []);
      return {
        isFulfilled: 0 === Object.keys(o).length,
        blame: {
          message: "Found a history pseudo state connected to an atomic state! History pseudo states only refer to compound states. Cf. log",
          info: {
            wrongHistoryStates: o,
            states: t.states
          }
        }
      }
    }
  }]
};
const Ht = (t, e, n) => (function(t) {
    const e = t.description;
    return function(...n) {
      const s = [],
        o = t.computed.apply(null, n);
      return {
        isFulfilled: t.contracts.reduce((t, i) => {
          const {
            name: a,
            predicate: r,
            shouldThrow: c
          } = i, u = n.concat(o), {
            isFulfilled: l,
            blame: d
          } = r.apply(null, u), f = `${e} FAILS ${a}!`, {
            message: p,
            info: m
          } = d || {};
          if (l) return t;
          if (s.push({
            name: a,
            message: p,
            info: m
          }), console.error(f), console.error([a, p].join(": ")), console.debug("Supporting error data:", m), c) throw new Error([f, "check console for information!"].join("\n"));
          return !1
        }, !0),
        failingContracts: s
      }
    }
  })(n)(t, e),
  Pt = () => !0;

function Bt(t) {
  const {
    initialControlState: e,
    transitions: n
  } = t, s = Et(n);
  return e ? n.concat([{
    from: a,
    event: r,
    to: e,
    action: f
  }]) : s ? n : void 0
}

function Ut(t, e) {
  const {
    states: n,
    events: s,
    initialExtendedState: o,
    updateState: i
  } = t, {
    debug: l
  } = e || {}, p = l && l.checkContracts || void 0;
  let g = l && l.console ? l.console : L;
  if (p) {
    const {
      failingContracts: n
    } = Ht(t, e, p);
    if (n.length > 0) throw new Error("createStateMachine: called with wrong parameters! Cf. logs for failing contracts.")
  }
  const y = At(E, i, ["extendedState, updates"]),
    b = function(t) {
      return (t = t.reduce ? t : Array.prototype.slice.call(arguments)).push(r), t.reduce(function(t, e) {
        return t[e] = e, t
      }, {})
    }(s),
    v = Bt(t),
    S = function(t) {
      const e = "State";
      let n = {},
        s = {};

      function o() {}
      return t = {
        nok: t
      }, o.prototype = {
        current_state_name: a
      }, n[a] = new o, n[u] = new o,
        function t(o, i) {
          X(o).forEach(function(a) {
            const r = o[a];
            if (n[a] = new i, n[a].name = a, n[a].parent_name = W(i), n[a].root_name = e, "object" == typeof r) {
              s[a] = !0;
              const e = function() {};
              e.displayName = a, e.prototype = n[a], t(r, e)
            }
          })
        }(t, o), {
        hash_states: n,
        is_group_state: s
      }
    }(n);
  let A = o;
  const {
    stateList: _,
    stateAncestors: w
  } = ft(n);
  let C = vt(_),
    j = {},
    F = {};
  const N = S.is_group_state;
  let k = S.hash_states;

  function x(t, e) {
    var n, s;
    g.debug("send event", t), n = Mt, s = [t], p && wt(n, s);
    const o = X(t)[0],
      i = t[o],
      u = k[a].current_state_name;
    return e && o === r && u !== a ? (g.warn("The external event INIT_EVENT can only be sent when starting the machine!"), d) : function(t, e, n, s) {
      const o = t[a].current_state_name,
        i = t[o][e];
      if (i) {
        g.log("found event handler!"), g.info("WHEN EVENT ", e);
        const {
          stop: u,
          outputs: d
        } = i(s, n, o);
        l && !u && g.warn("No guards have been fulfilled! We recommend to configure guards explicitly to cover the full state space!");
        const f = ht(d),
          p = t[a].current_state_name;
        if (F[p] && p !== o) {
          const t = j[p] ? r : c;
          return [].concat(f).concat(x({
            [t]: n
          }, !1))
        }
        return f
      }
      return g.warn(`There is no transition associated to the event |${e}| in state |${o}|!`), d
    }(S.hash_states, o, i, A)
  }
  return v.forEach(function(t) {
    let {
      from: n,
      to: s,
      action: o,
      event: u,
      guards: p
    } = t;
    p || (p = [{
      predicate: Pt,
      to: s,
      action: o
    }]), u === r && (j[n] = !0);
    let v = k[n];
    if (u && !(u in b)) throw `unknown event ${u} found in state machine definition!`;
    u || (u = c, F[n] = !0), N[n] && j[n] && (F[n] = !0), v[u] = p.reduce((t, s, o) => {
      const r = s.action || f,
        c = r.name || r.displayName,
        u = function(t, e) {
          let s = "";
          const u = function(u, f, p) {
            n = p || n;
            const b = t.predicate,
              v = b || Pt,
              S = !b || At(O, v, ["extendedState", "eventData", "settings"])(u, f, e),
              E = t.to;
            if (s = v ? "_checking_condition_" + o : "", jt({
              debug: l,
              console: g
            }, {
              predicate: t.predicate,
              extendedState: u,
              eventData: f,
              settings: e
            }, S, H, Ft, kt), S) {
              g.info("IN STATE ", n), b && g.info(`CASE: guard ${v.name} for transition is fulfilled`), !b && g.info("CASE: unguarded transition"), g.info("THEN : we execute the action " + c);
              const t = At(T, r, ["extendedState", "eventData", "settings"])(u, f, e);
              jt({
                debug: l,
                console: g
              }, {
                action: r,
                extendedState: u,
                eventData: f,
                settings: e
              }, t, It, Ft, Nt);
              const {
                updates: s,
                outputs: o
              } = t;
              ! function(t, e, n) {
                const s = n[t].name;
                C = St(C, w, s), g.info("left state", Y(t))
              }(n, 0, k);
              const d = y(u, s);
              jt({
                debug: l,
                console: g
              }, {
                updateStateFn: i,
                extendedState: u,
                updates: s
              }, d, Pt, Ft, $), A = d;
              const p = function(t, e, n) {
                let s, o;
                if (gt(t)) {
                  const e = t.deep ? h : t.shallow ? m : void 0,
                    i = t[e];
                  o = C[e][i] || i, s = n[o]
                } else {
                  if (!t) throw "enter_state : unknown case! Not a state name, and not a history state to enter!";
                  s = n[t], o = s.name
                }
                return n[a].current_state_name = o, l && g.info("AND TRANSITION TO STATE", o), o
              }(E, 0, k);
              return g.info("ENTERING NEXT STATE : ", p), {
                stop: !0,
                outputs: o
              }
            }
            return {
              stop: !1,
              outputs: d
            }
          };
          return u.displayName = n + s, u
        }(s, e);
      return function(e, n, s) {
        const o = t(e, n, s);
        return o.stop ? o : u(e, n, s)
      }
    }, function() {
      return {
        stop: !1,
        outputs: d
      }
    })
  }), x({
    [r]: o
  }, !0),
    function(t) {
      return x(t, !0)
    }
}

function Vt(t) {
  return t.reduce((t, e) => t.concat(e), [])
}

function Wt(t, e) {
  return e ? `state "${e}" as ${t} <<NoContent>>` : `state "${nt(t)}" as ${t} <<NoContent>>`
}
t.fsmContracts = Lt, t.build_state_enum = function(t) {
  let e = {
    history: {}
  };
  return e.NOK = a,
    function t(n) {
      X(n).forEach(function(s) {
        const o = n[s];
        e[s] = s, "object" == typeof o && t(o)
      })
    }(t), e
}, t.normalizeTransitions = Bt, t.normalizeFsmDef = function(t) {
  return Object.assign({}, t, {
    transitions: Bt(t)
  })
}, t.create_state_machine = function(t, e) {
  return Ut(t, e)
}, t.createStateMachine = Ut, t.makeWebComponentFromFsm = function({
                                                                     name: t,
                                                                     eventHandler: e,
                                                                     fsm: n,
                                                                     commandHandlers: s,
                                                                     effectHandlers: o,
                                                                     options: i
                                                                   }) {
  return customElements.define(t, class extends HTMLElement {
    constructor() {
      if (t.split("-").length <= 1) throw "makeWebComponentFromFsm : web component's name MUST include a dash! Please review the name property passed as parameter to the function!";
      super();
      const a = this,
        {
          subjectFactory: r
        } = e;
      this.eventSubject = r(), this.options = Object.assign({}, i);
      const c = this.options.NO_ACTION || d;
      this.eventSubject.subscribe({
        next: t => {
          const e = n(t);
          e !== c && e.forEach(t => {
            if (t === c) return;
            const {
              command: e,
              params: n
            } = t;
            s[e](this.eventSubject.next, n, o, a)
          })
        }
      })
    }
    static get observedAttributes() {
      return []
    }
    connectedCallback() {
      this.options.initialEvent && this.eventSubject.next(this.options.initialEvent)
    }
    disconnectedCallback() {
      this.options.terminalEvent && this.eventSubject.next(this.options.terminalEvent), this.eventSubject.complete()
    }
    attributeChangedCallback(t, e, n) {
      this.constructor(), this.connectedCallback()
    }
  })
}, t.makeNamedActionsFactory = function(t) {
  return Object.keys(t).reduce((e, n) => {
    const s = t[n];
    return s.displayName = n, e[n] = s, e
  }, {})
}, t.mergeOutputsFn = Vt, t.decorateWithEntryActions = function(t, e, n) {
  if (!e) return t;
  const {
    transitions: s,
    states: o,
    initialExtendedState: i,
    initialControlState: a,
    events: r,
    updateState: c,
    settings: u
  } = t, l = st(o), d = Object.keys(e).every(t => null != l[t]), f = n || Vt;
  if (d) return {
    initialExtendedState: i,
    initialControlState: a,
    states: o,
    events: r,
    transitions: pt((t, n, s, o) => {
      const {
        to: i
      } = n, a = e[i];
      return a ? function(t, e, n, s) {
        const o = function(o, i, a) {
          const {
            debug: r
          } = a, c = At(S, e, ["extendedState", "eventData", "settings"]), u = t(o, i, a), l = u.updates, d = At(E, s, ["extendedState, updates"]), f = d(o, l);
          jt({
            debug: r,
            console: console
          }, {
            updateStateFn: s,
            extendedState: o,
            actionUpdate: l
          }, f, Pt, Ft, $);
          const p = f,
            m = c(p, i, a),
            h = jt({
              debug: r,
              console: console
            }, {
              action: e,
              extendedState: p,
              eventData: i,
              settings: a
            }, m, It, Ft, xt);
          if (!h) return {
            updates: [].concat(l, m.updates),
            outputs: n([u.outputs, m.outputs])
          }
        };
        return o.displayName = `Entry_Action_After_${_t(t)}`, o
      }(t, a, f, c) : t
    }, s),
    updateState: c,
    settings: u
  };
  throw "decorateWithEntryActions : found control states for which entry actions are defined, and yet do not exist in the state machine!"
}, t.traceFSM = function(t, e) {
  const {
    initialExtendedState: n,
    initialControlState: s,
    events: o,
    states: i,
    transitions: a,
    updateState: r
  } = e;
  return {
    initialExtendedState: n,
    initialControlState: s,
    events: o,
    states: i,
    updateState: r,
    transitions: pt((t, e, n, s) => (function(o, i, a) {
      const {
        from: c,
        event: u,
        to: l,
        predicate: d
      } = e, f = At(T, t, ["extendedState", "eventData", "settings"])(o, i, a), {
        outputs: p,
        updates: m
      } = f;
      return {
        updates: m,
        outputs: [{
          outputs: p,
          updates: m,
          extendedState: o,
          newExtendedState: At(E, r, ["extendedState, updates"])(o, m || []),
          controlState: c,
          event: {
            eventLabel: u,
            eventData: i
          },
          settings: a,
          targetControlState: l,
          predicate: d,
          actionFactory: t,
          guardIndex: n,
          transitionIndex: s
        }]
      }
    }), a)
  }
}, t.makeHistoryStates = function(t) {
  const e = Object.keys(st(t));
  return (t, n) => {
    if (!e.includes(n)) throw "makeHistoryStates: the state for which a history state must be constructed is not a configured state for the state machine under implementation!!";
    return {
      [t]: n,
      type: p
    }
  }
}, t.historyState = function(t, e) {
  return {
    [t]: e
  }
}, t.toPlantUml = function(t, i) {
  const {
    states: r,
    transitions: c
  } = t, {
    getChildren: u,
    constructTree: l,
    getLabel: d
  } = M, f = t => t.join(e), p = I(M, {
    seed: () => Map,
    visit: (t, e, i) => {
      const {
        path: r
      } = e.get(i), l = d(i), p = function(t, e, i) {
        return [`${Wt(t,"")} {`, e.join("\n"), function(t, e) {
          const n = e.reduce((e, n) => {
            const s = et(n);
            return s.filter(z).filter(K(t)).reduce((t, e) => (t[tt(e)] = void 0, t), e)
          }, {});
          return Object.keys(n).map(t => `${Wt(t,o)}`).join("\n")
        }(t, i), function(t, e) {
          return e.reduce((e, o) => {
            const i = et(o);
            return i.filter(q).filter(G(t)).reduce((t, e) => {
              const {
                from: o,
                to: i,
                predicate: a,
                action: r
              } = e;
              return t.push(`[*] ${n} ${i} ${s} ${Z("",a,r)}`), t
            }, e)
          }, []).join("\n")
        }(t, i), "}", function(t, e) {
          const o = function(t, e) {
              return e.map(e => {
                const o = et(e);
                return o.filter(G(t)).filter(z).map(({
                                                       from: t,
                                                       event: e,
                                                       predicate: o,
                                                       to: i,
                                                       action: a
                                                     }) => [t, n, tt({
                  from: t,
                  to: i
                }), s, Z(e, o, a)].join(" ")).join("\n")
              }).filter(Boolean).join("\n")
            }(t, e),
            i = function(t, e) {
              return t === a ? "" : e.map(e => {
                const o = et(e);
                return o.filter(G(t)).filter(t => !q(t)).filter(t => !z(t)).map(({
                                                                                   from: t,
                                                                                   event: e,
                                                                                   predicate: o,
                                                                                   to: i,
                                                                                   action: a
                                                                                 }) => [t, n, i, s, Z(e, o, a)].join(" ")).join("\n")
              }).filter(Boolean).join("\n")
            }(t, e);
          return [o, i].filter(Boolean).join("\n")
        }(t, i)].filter(t => "\n" !== t && "" !== t).join("\n")
      }(Object.keys(l)[0], J(e => t.get(f(r.concat(e))), ((t, e) => u(t, e).length)(i, e)), c);
      return t.set(f(r), p), t
    }
  }, {
    [a]: r
  }), m = p.get("0");
  return p.clear(), m
}, t.toDagreVisualizerFormat = function(t) {
  const {
    states: n,
    transitions: s
  } = t, {
    getLabel: o,
    getChildren: i
  } = M, {
    constructTree: r
  } = D, c = t => t.join(e), u = I(M, {
    seed: () => Map,
    visit: (t, e, n) => {
      const {
        path: s
      } = e.get(n), a = o(n), u = Object.keys(a)[0], l = J(e => t.get(c(s.concat(e))), ((t, e) => i(t, e).length)(n, e));
      return t.set(c(s), r(u, l)), t
    }
  }, {
    [a]: n
  }).get("0"), l = s.map(t => {
    const {
      from: e,
      to: n,
      event: s,
      guards: o,
      action: i
    } = t;
    return o ? {
      from: e,
      event: s,
      guards: o.map(t => {
        const {
          predicate: e,
          to: n,
          action: s
        } = t;
        return {
          predicate: e.name,
          to: n,
          action: s.name
        }
      })
    } : {
      from: e,
      to: n,
      event: s,
      action: i.name || "no action name?"
    }
  });
  return JSON.stringify({
    states: u,
    transitions: l
  })
}, t.CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE = "Model update function must return valid update operations!", t.SEP = e, t.TRANSITION_SYMBOL = n, t.TRANSITION_LABEL_START_SYMBOL = s, t.HISTORY_STATE_NAME = o, t.HISTORY_PREFIX = i, t.INIT_STATE = a, t.INIT_EVENT = r, t.AUTO_EVENT = c, t.STATE_PROTOTYPE_NAME = u, t.NO_STATE_UPDATE = l, t.NO_OUTPUT = d, t.ACTION_IDENTITY = f, t.history_symbol = p, t.SHALLOW = m, t.DEEP = h, t.WRONG_EVENT_FORMAT_ERROR = g, t.FUNCTION_THREW_ERROR = y, t.INVALID_ACTION_FACTORY_EXECUTED = b, t.INVALID_PREDICATE_EXECUTED = v, t.ACTION_FACTORY_DESC = T, t.ENTRY_ACTION_FACTORY_DESC = S, t.UPDATE_STATE_FN_DESC = E, t.PREDICATE_DESC = O, t.noop = $, t.emptyConsole = L, t.isBoolean = H, t.isFunction = P, t.isControlState = B, t.isEvent = U, t.isActionFactory = V, t.make_states = function(t) {
  return t.reduce((t, e) => (t[e] = "", t), {})
}, t.make_events = function(t) {
  return t
}, t.get_fn_name = W, t.wrap = Y, t.times = J, t.always = function(t) {
  return t
}, t.keys = X, t.merge = function(t, e) {
  return Object.assign({}, t, e)
}, t.is_history_transition = z, t.is_entry_transition = q, t.is_from_control_state = G, t.is_to_history_control_state_of = K, t.is_history_control_state_of = Q, t.format_transition_label = Z, t.format_history_transition_state_name = tt, t.get_all_transitions = et, t.getDisplayName = nt, t.mergeModelUpdates = function(t) {
  return function(e, n, s) {
    return {
      updates: t.reduce((t, o) => {
        const i = o(e, n, s).updates;
        return i ? t.concat(i) : t
      }, []),
      outputs: d
    }
  }
}, t.chainModelUpdates = function(t) {
  return function(e, n, s) {
    const {
      updateState: o
    } = s;
    return {
      updates: t.reduce((t, e) => {
        const {
          extendedState: i,
          updates: a
        } = t, r = e(i, n, s).updates;
        return {
          extendedState: o(i, a),
          updates: r
        }
      }, {
        extendedState: e,
        updates: []
      }).updates || [],
      outputs: d
    }
  }
}, t.mergeActionFactories = function(t, e) {
  return function(n, s, o) {
    const i = e.map(t => t(n, s, o)),
      a = i.map(t => t.updates || []),
      r = i.map(t => t.outputs || {});
    return {
      updates: [].concat(...a),
      outputs: t(r)
    }
  }
}, t.identity = function(t, e, n) {
  return {
    updates: [],
    outputs: d
  }
}, t.lastOf = function(t) {
  return t[t.length - 1]
}, t.getFsmStateList = st, t.getStatesType = ot, t.getStatesPath = it, t.getStatesTransitionsMap = at, t.getStatesTransitionsMaps = rt, t.getEventTransitionsMaps = ct, t.getHistoryStatesMap = ut, t.getTargetStatesMap = lt, t.getAncestorMap = dt, t.computeHistoryMaps = ft, t.mapOverTransitionsActions = pt, t.reduceTransitions = mt, t.everyTransition = function(t, e) {
  return mt((e, n) => e && t(n), !0, [e])
}, t.computeTimesCircledOn = function(t, e) {
  return t.reduce((t, n) => n === e ? t + 1 : t, 0)
}, t.isInitState = function(t) {
  return t === a
}, t.isInitEvent = function(t) {
  return t === r
}, t.isEventless = function(t) {
  return void 0 === t
}, t.arrayizeOutput = ht, t.isHistoryControlState = gt, t.getHistoryParentState = function(t) {
  return t[m] || t[h]
}, t.isShallowHistory = function(t) {
  return t[m]
}, t.isDeepHistory = function(t) {
  return t[h]
}, t.getHistoryType = yt, t.getHistoryUnderlyingState = bt, t.isHistoryStateEdge = function(t) {
  return void 0 !== t.history
}, t.initHistoryDataStructure = vt, t.isCompoundState = Tt, t.isAtomicState = function(t, e) {
  return !Tt(t, e)
}, t.updateHistory = St, t.computeHistoryState = function(t, e, n, s) {
  const {
    stateList: o,
    stateAncestors: i
  } = ft(t);
  let a = vt(o);
  return (a = e.reduce((t, e) => St(t, i, e), a))[n][s]
}, t.findInitTransition = Et, t.tryCatch = Ot, t.tryCatchMachineFn = At, t.getFunctionName = _t, t.assert = wt, t.notifyThrows = Ct, t.handleFnExecError = jt, t.notifyAndRethrow = Ft, t.throwIfInvalidActionResult = Nt, t.throwIfInvalidGuardResult = kt, t.throwIfInvalidEntryActionResult = xt, t.isActions = It, t.isEventStruct = Mt, Object.defineProperty(t, "__esModule", {
  value: !0
})

