var utils = require_utils(Rx);
var Err = require_custom_errors(utils, _);
var Ractive_component = require_cd_player_view(Ractive).template;
var cd_player_api = require_cd_player(utils);
var cd_player_state_chart = require_cd_player_def(cd_player_api, utils);
var fsm = require_async_fsm(utils);

function make_action_driver(action_hash) {
    // action_list is a list (array) of actions (function :: model -> event_data -> fsm -> cd_player_events)
    // for now, should be simplified to model -> event_data
    // 1. From the function list, we derive an enumeration from the function names
    //    By construction there cannot be two functions with the same name
    //    The function names will serve as the DSL to represent the actions
    // The resulting DSL is generated to serve as input to the main
    // action_req maker
    return function action_req_interpreter(action_req$) {
        // 1. Look up action_req in list of actions
        // 2. If not there, return error code or send error through subject
        // 3. If there, then execute the action
        var action_res$ = action_req$
            .flatMap(function (action_req) {
                var action_payload = action_req.payload;
                var action_enum = action_req.action_req;
                var model = action_req.model;
                var action = action_hash[action_enum];
                if (action) {
                    // CASE : we do have some actions to execute
                    var action_res = Err.tryCatch(function execute_action(action, action_payload) {
                        console.info("THEN : we execute the action " + action.name);
                        return action(model, action_payload);
                    })(action, action_payload);
                    if (action_res instanceof Error) {
                        return Rx.Observable.return(action_res);
                    }
                    else return utils.to_observable(action_res);
                }
                else {
                    // TODO : be careful, they say flatMap swallow errors, That should be a fatal error
                    return Rx.Observable.throw('no action found for action code ' + action_enum);
                }
            });
        return action_res$;
    }
}

function make_ractive_driver(Ractive_component) {
    var ractive_component;

    return function (fsm_state$) {
        // var shared_fsm_state = fsm_state$.share();
        // NOTE : model$ is in fact fsm_state
        // use the model to display the view
        ///*
        fsm_state$
            .filter(function filter_in_new_model(fsm_state) {
                return fsm_state.internal_state.is_model_dirty;
            })
            .subscribe(function display(fsm_state) {
                console.log("Going to display model", fsm_state.model);
                //debugger;
                ractive_component = ractive_component || new Ractive_component();
                ractive_component.set(fsm_state.model);
            });

        var automatic_intent$ = fsm_state$
            .filter(function filter_in_auto_intents(fsm_state) {
                return fsm_state.automatic_event;
            })
            .map(function pick_automatic_event(fsm_state) {
                //debugger;
                return fsm_state.automatic_event;
            });
        return automatic_intent$;
        // */
    };
}

var drivers = {
    // DOM : not used for now
    effect: make_action_driver(cd_player_state_chart.action_hash),
    ractive: make_ractive_driver(Ractive_component)
};

function main(sources) {
    function intent(sources, cd_player_api, cd_player_state_chart) {
        // set mousedown and mouseup intents
        // TODO : get the intents from sources.DOM instead of directly from `fromEvent`
        var concat = Array.prototype.concat;
        var id_list = [
            'eject', 'pause', 'play', 'stop', 'next_track', 'previous_track'
        ];
        var mousedown_intents = id_list.map(function add_click_listener(button_id) {
            return Rx.Observable.fromEvent(document.getElementById(button_id), 'mousedown')
                .map(function (ev) {
                    return {code: button_id.toUpperCase(), payload: undefined}
                });
        });

        var mouseup_list = ['reverse_down', 'forward_down'];
        var mouseup_id_list = ['reverse_up', 'forward_up'];
        var mouseup_intents = mouseup_list.map(function add_mouseup_listener(button_id, index) {
            return Rx.Observable.fromEvent(document.getElementById(button_id), 'mouseup')
                .map(function (ev) {
                    return {code: mouseup_id_list[index].toUpperCase(), payload: undefined}
                });
        });

        // we use a mouseup on the window rather than on the button as the user could keep the mouse button down
        // while moving the pointer out of the button area, hence we would not detect a mouseup in that case
        var global_mouseup_event = Rx.Observable.fromEvent(document.body, 'mouseup');

        var forward_and_backward_down_intents = mouseup_list.map(function add_mouseup_listener(button_id, index) {
            return Rx.Observable.fromEvent(document.getElementById(button_id), 'mousedown')
                .flatMapLatest(function repeat_key() {
                    return Rx.Observable.interval(cd_player_state_chart.FORWARD_INTERVAL)
                        .map(function get_intent() {
                            return {code: cd_player_state_chart.cd_player_events.TIMER_EXPIRED, payload: undefined};
                        })
                        //                        .takeUntil(mouseup_intents[index])
                        .takeUntil(global_mouseup_event)
                        .startWith({code: cd_player_state_chart.cd_player_events[button_id.toUpperCase()], payload: undefined})
                });
        });

        // Add cd stop event through polling
        // This is to keep the cd player api the same. Otherwise we could request the cd player api to have an
        // end of cd stream
        var cd_stop_event = Rx.Observable
            .interval(1000 /* ms */)
            .scan(function detect_cd_stop_event(is_end_of_cd, _) {
                return cd_player_api.is_end_of_cd();
            }, false)
            .distinctUntilChanged()
            .filter(utils.identity)
            .map(function () {
                return {code: 'STOP', payload: 'undefined'}
            });

        return Rx.Observable.merge(concat.call(mousedown_intents, mouseup_intents, forward_and_backward_down_intents, cd_stop_event));
    }

    // We have to defer the computation of intent as nothing is displayed yet,
    // so there will be no element to select for the given DOM ids
    var intent$ = Rx.Observable.defer(function () {
        return intent(sources, cd_player_api, cd_player_state_chart);
    });

    // Build the sinks :
    // - merge the user intents with the automatic actions from the state machine
    // - pass the action and intent streams to the state machine
    // In the action stream, the result of the execution of actions will be passed
    // In the intent stream, both the user actions and the automatic actions (automatic transitions) will be passed
    //    var fsm_sinks = fsm.make_fsm(cd_player_state_chart, Rx.Observable.merge(intent(sources), sources.ractive), sources.action);
    var fsm_sinks = fsm.make_fsm(cd_player_state_chart, intent$, sources.effect, sources.ractive);

    return {
        // DOM : Cycle.makeDomDriver(...) ; I want to avoid ES6 so I don't use the DOM driver for now
        // Also for some reasons, it is mandatory to put ractive first in the hashmap
        ractive: fsm_sinks.fsm_state$,
        effect: fsm_sinks.action_req$,
    }
}

Cycle.run(main, drivers);

// TODO : reproduce the problem of cycling and not having a starting with and post on SO
// TODO : maybe remove or optionalize the internal state metadata passing in the model
// TODO : try to understand what's happening when there are conditions but none are satisfied
// TODO : also guard against an action res coming not associated with the action_res we are expecting
