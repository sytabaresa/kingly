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
    var is_DOM_readyS = new Rx.Subject();

    return function (fsm_state$) {
      fsm_state$.subscribe(function display(model) {
        console.log("Displaying model", model);
        ractive_component = ractive_component || new Ractive_component();
        // TODO cf. https://github.com/nervgh/object-traverse object traverse (in utils now) to generate the paths
        ractive_component.set(model);
        is_DOM_readyS.onNext(true);
      });

      // pass on the following to sources
      return {
        is_DOM_ready$: is_DOM_readyS
      }
    };
  }

  var drivers = {
    // DOM : not used for now
    ractive: make_ractive_driver(Ractive_component)
  };

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

      return Rx.Observable.merge(concat.call(mousedown_intents, mouseup_intents, forward_and_backward_down_intents,
        cd_stop_event));
    }

    // We have to defer the computation of intent as nothing is displayed yet,
    // so there will be no element to select for the given DOM ids
    // Hence we need to delay the inner cycle wiring
    // so the ractive driver receives the model initial value first

    var intent$ = sources.ractive.is_DOM_ready$.flatMapLatest(function get_intents(flag) {
        if (flag) { return intent(sources, cd_player_api, cd_player_state_chart); }
        throw 'is_DOM_ready$ sending falsy value??'
      }
    );

    // NOTE: hfsm made a global for testing in console
    hfsm = fsm.make_fsm(cd_player_state_chart, intent$);
    hfsm.fsm_state$.subscribe(function (fsm_state) {
      console.error('fsm_state', utils.clone_deep(fsm_state));
    });
    hfsm.start();
    // hfsm.start_trace();
    // hfsm.trace$.subscribe(utils.rxlog('Final trace array'));

    return {
      // NOTE : I want to avoid ES6/webpack and the like so I don't use the DOM driver for now
      ractive: hfsm.model_update$
    }
  }

  // NOTE : Implements a circular flow with : main(drivers(replayS)).subscribe(replayS)
  Cycle.run(main, drivers);
  // hfsm.stop();
});
