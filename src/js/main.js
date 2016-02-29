var utils = require_utils(Rx);
var cd_player_def = require_cd_player_def(utils);
var view = require_cd_player_view(Ractive, Rx);
var intent_emitter = new Rx.Subject();

function render(view, intent_emitter) {
    var initialized = false;
    var view_instance;
    return function render(model) {
        !initialized && (view_instance = new view.template({event_emitter: intent_emitter}));
        view_instance.set(model);
    }
}

// TODO : change the implementation of timers for play : no more interval but timeout instead renewed every time

fsm = create_state_machine(cd_player_def.cd_player_states, cd_player_def.cd_player_events, cd_player_def.cd_player_transitions, cd_player_def.model, Rx);
console.log("fsm", fsm);

// Emit
intent_emitter.subscribe(fsm.send_event);

// Render the model
fsm.new_model_event_emitter.subscribe(render(view, intent_emitter));

fsm.start();
