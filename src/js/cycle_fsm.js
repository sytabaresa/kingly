define(function (require) {
    var utils = require('utils');
    var Err = require('custom_errors');
    var Ractive_component = require('cd_player_view').template;
    var cd_player_api = require('cd_player_api');
    var cd_player_state_chart = require('cd_player_state_chart');
    var fsm = require('asynchronous_fsm');
    var Cycle = require('cycle');

    function make_ractive_driver(Ractive_component) {
        var ractive_component;

        return function (fsm_state$) {
            fsm_state$.subscribe(function display(model) {
                console.log("Displaying model", model);
                ractive_component = ractive_component || new Ractive_component();
                ractive_component.set(model);
            });
        };
    }

    var drivers = {
        // DOM : not used for now
        ractive: make_ractive_driver(Ractive_component)
    };

    var hfsm;

    function main(sources) {
        function intent(sources, cd_player_api, cd_player_state_chart) {
            // set mousedown and mouseup intents
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
        hfsm = fsm.make_fsm(cd_player_state_chart, intent$);

        return {
            // DOM : Cycle.makeDomDriver(...) ; I want to avoid ES6 so I don't use the DOM driver for now
            // Also for some reasons, it is mandatory to put ractive first in the hashmap
            ractive: hfsm.output$
        }
    }

    Cycle.run(main, drivers);
    setTimeout(function (){hfsm.start();}, 10);
    // hfsm.stop();

});


