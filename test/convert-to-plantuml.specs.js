import * as QUnit from "qunitjs"
import { INIT_EVENT, INIT_STATE, toPlantUml } from "../src"

function always_true() {return true}

function always_false() {return false}

const EVENT1 = 'event1';
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

function dummy_action(model, event_data, settings) {
  return dummy_action_result
}

function another_dummy_action(model, event_data, settings) {
  return another_dummy_action_result
}

QUnit.module("Testing plant UML graph specs conversion", {});

QUnit.test("transition labelling with guards and actions, but no events", function exec_test(assert) {
  const fsmDef = {
    states: { A: '' },
    events: [],
    transitions: [
      {
        from: INIT_STATE, event: INIT_EVENT, guards: [
          { predicate: always_true, to: 'A', action: dummy_action },
          { predicate: always_false, to: 'A', action: another_dummy_action }
        ]
      }
    ],
    initial_extended_state: model_initial
  };
  const translation = toPlantUml(fsmDef, {});
  assert.deepEqual(translation, `state "nok" as nok <<NoContent>> {
state "A" as A <<NoContent>> {
}
[*] --> A :  [always_true] / dummy_action
[*] --> A :  [always_false] / another_dummy_action
}`,
    `works`);
});

QUnit.test("2 states", function exec_test(assert) {
  const fsmDef = {
    states: { A: '', B: '' },
    events: [EVENT1],
    transitions: [
      { from: INIT_STATE, to: 'A', event: INIT_EVENT, action: dummy_action },
      { from: 'A', to: 'B', event: EVENT1, action: another_dummy_action },
    ],
    initial_extended_state: model_initial
  };
  const translation = toPlantUml(fsmDef, {});
  assert.deepEqual(
    translation,
    `state "nok" as nok <<NoContent>> {
state "A" as A <<NoContent>> {
}
A --> B : event1 / another_dummy_action
state "B" as B <<NoContent>> {
}
[*] --> A :  / dummy_action
}`,
    `works`
  );
});

QUnit.test("History states, entry states, standard states, and all transitions : CD player", function exec_test(assert) {
  debugger

  function identity() {}

  function fsm_initialize_model() {}

  function open_drawer() {}

  function close_drawer() {}

  function play() {}

  function stop() {}

  function eject() {}

  function go_next_track() {}

  function go_track_1() {}

  function go_previous_track() {}

  function pause_playing_cd() {}

  function resume_paused_cd() {}

  function go_forward_1_s() {}

  function go_backward_1_s() {}

  function create_pause_timer() {}

  function stop_forward_timer() {}

  function stop_backward_timer() {}

  function is_not_cd_in_drawer() {}

  function is_cd_in_drawer() {}

  function is_last_track() {}

  function is_not_last_track() {}

  function is_track_gt_1() {}

  function is_track_eq_1() {}

  function is_not_end_of_cd() {}

  function is_end_of_cd() {}

  const states = {
    no_cd_loaded: {
      cd_drawer_closed: '', cd_drawer_open: '', closing_cd_drawer: ''
    },
    cd_loaded: {
      cd_loaded_group: {
        cd_paused_group: {
          time_and_track_fields_not_blank: '', time_and_track_fields_blank: ''
        },
        cd_playing: '',
        cd_stopped: ''
      },
      stepping_forwards: '',
      stepping_backwards: ''
    }
  };
  const transitions = [
    { from: INIT_STATE, to: "no_cd_loaded", event: INIT_EVENT, action: fsm_initialize_model },
    { from: "no_cd_loaded", to: "cd_drawer_closed", event: INIT_EVENT, action: identity },
    { from: "cd_drawer_closed", to: "cd_drawer_open", event: "EJECT", action: open_drawer },
    { from: "cd_drawer_open", to: "closing_cd_drawer", event: "EJECT", action: close_drawer },
    {
      from: "closing_cd_drawer", guards: [
        { predicate: is_not_cd_in_drawer, to: "cd_drawer_closed", action: identity },
        { predicate: is_cd_in_drawer, to: "cd_loaded", action: identity }
      ]
    },
    { from: "cd_loaded", to: "cd_loaded_group", event: INIT_EVENT, action: identity },
    { from: "cd_playing", to: "cd_paused_group", event: "PAUSE", action: pause_playing_cd },
    { from: "cd_paused_group", to: "cd_playing", event: "PAUSE", action: resume_paused_cd },
    { from: "cd_paused_group", to: "cd_playing", event: "PLAY", action: resume_paused_cd },
    { from: "cd_paused_group", to: "time_and_track_fields_not_blank", event: INIT_EVENT, action: identity },
    {
      from: "time_and_track_fields_not_blank",
      to: "time_and_track_fields_blank",
      event: "TIMER_EXPIRED",
      action: create_pause_timer
    },
    {
      from: "time_and_track_fields_blank",
      to: "time_and_track_fields_not_blank",
      event: "TIMER_EXPIRED",
      action: create_pause_timer
    },
    { from: "cd_paused_group", to: "cd_stopped", event: "STOP", action: stop },
    { from: "cd_stopped", to: "cd_playing", event: "PLAY", action: play },
    { from: "cd_playing", to: "cd_stopped", event: "STOP", action: stop },
    { from: "cd_loaded_group", to: "cd_stopped", event: INIT_EVENT, action: stop },
    {
      from: "cd_loaded_group", event: "NEXT_TRACK", guards: [
        { predicate: is_last_track, to: "cd_stopped", action: stop },
        { predicate: is_not_last_track, to: "history.cd_loaded_group", action: go_next_track }
      ]
    },
    {
      from: "cd_loaded_group", event: "PREVIOUS_TRACK", guards: [
        { predicate: is_track_gt_1, to: "history.cd_loaded_group", action: go_previous_track },
        { predicate: is_track_eq_1, to: "history.cd_loaded_group", action: go_track_1 }
      ]
    },
    { from: "cd_loaded", to: "cd_drawer_open", event: "EJECT", action: eject },
    {
      from: "stepping_forwards", event: "TIMER_EXPIRED", guards: [
        { predicate: is_not_end_of_cd, to: "stepping_forwards", action: go_forward_1_s },
        { predicate: is_end_of_cd, to: "cd_stopped", action: stop }
      ]
    },
    { from: "stepping_forwards", to: "history.cd_loaded_group", event: "FORWARD_UP", action: stop_forward_timer },
    { from: "cd_loaded_group", to: "stepping_forwards", event: "FORWARD_DOWN", action: go_forward_1_s },
    { from: "stepping_backwards", to: "stepping_backwards", event: "TIMER_EXPIRED", action: go_backward_1_s },
    { from: "stepping_backwards", to: "history.cd_loaded_group", event: "REVERSE_UP", action: stop_backward_timer },
    { from: "cd_loaded_group", to: "stepping_backwards", event: "REVERSE_DOWN", action: go_backward_1_s }
  ];

  const fsmDef = {
    states,
    transitions,
  };
  const translation = toPlantUml(fsmDef, {});
  assert.deepEqual(
    translation,
    `state "nok" as nok <<NoContent>> {
state "no cd loaded" as no_cd_loaded <<NoContent>> {
state "cd drawer closed" as cd_drawer_closed <<NoContent>> {
}
cd_drawer_closed --> cd_drawer_open : EJECT / open_drawer
state "cd drawer open" as cd_drawer_open <<NoContent>> {
}
cd_drawer_open --> closing_cd_drawer : EJECT / close_drawer
state "closing cd drawer" as closing_cd_drawer <<NoContent>> {
}
closing_cd_drawer --> cd_drawer_closed :  [is_not_cd_in_drawer] / identity
closing_cd_drawer --> cd_loaded :  [is_cd_in_drawer] / identity
[*] --> cd_drawer_closed :  / identity
}
state "cd loaded" as cd_loaded <<NoContent>> {
state "cd loaded group" as cd_loaded_group <<NoContent>> {
state "cd paused group" as cd_paused_group <<NoContent>> {
state "time and track fields not blank" as time_and_track_fields_not_blank <<NoContent>> {
}
time_and_track_fields_not_blank --> time_and_track_fields_blank : TIMER_EXPIRED / create_pause_timer
state "time and track fields blank" as time_and_track_fields_blank <<NoContent>> {
}
time_and_track_fields_blank --> time_and_track_fields_not_blank : TIMER_EXPIRED / create_pause_timer
[*] --> time_and_track_fields_not_blank :  / identity
}
cd_paused_group --> cd_playing : PAUSE / resume_paused_cd
cd_paused_group --> cd_playing : PLAY / resume_paused_cd
cd_paused_group --> cd_stopped : STOP / stop
state "cd playing" as cd_playing <<NoContent>> {
}
cd_playing --> cd_paused_group : PAUSE / pause_playing_cd
cd_playing --> cd_stopped : STOP / stop
state "cd stopped" as cd_stopped <<NoContent>> {
}
cd_stopped --> cd_playing : PLAY / play
state "H" as cd_loaded_group.cd_loaded_group.H <<NoContent>>
state "H" as stepping_forwards.cd_loaded_group.H <<NoContent>>
state "H" as stepping_backwards.cd_loaded_group.H <<NoContent>>
[*] --> cd_stopped :  / stop
}
cd_loaded_group --> cd_loaded_group.cd_loaded_group.H : NEXT_TRACK [is_not_last_track] / go_next_track
cd_loaded_group --> cd_loaded_group.cd_loaded_group.H : PREVIOUS_TRACK [is_track_gt_1] / go_previous_track
cd_loaded_group --> cd_loaded_group.cd_loaded_group.H : PREVIOUS_TRACK [is_track_eq_1] / go_track_1
cd_loaded_group --> cd_stopped : NEXT_TRACK [is_last_track] / stop
cd_loaded_group --> stepping_forwards : FORWARD_DOWN / go_forward_1_s
cd_loaded_group --> stepping_backwards : REVERSE_DOWN / go_backward_1_s
state "stepping forwards" as stepping_forwards <<NoContent>> {
}
stepping_forwards --> stepping_forwards.cd_loaded_group.H : FORWARD_UP / stop_forward_timer
stepping_forwards --> stepping_forwards : TIMER_EXPIRED [is_not_end_of_cd] / go_forward_1_s
stepping_forwards --> cd_stopped : TIMER_EXPIRED [is_end_of_cd] / stop
state "stepping backwards" as stepping_backwards <<NoContent>> {
}
stepping_backwards --> stepping_backwards.cd_loaded_group.H : REVERSE_UP / stop_backward_timer
stepping_backwards --> stepping_backwards : TIMER_EXPIRED / go_backward_1_s
[*] --> cd_loaded_group :  / identity
}
cd_loaded --> cd_drawer_open : EJECT / eject
[*] --> no_cd_loaded :  / fsm_initialize_model
}`,
    `works`
  );
});
