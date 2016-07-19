// References
// DOM query selectors : https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector

define(function (require) {
  var utils = require('utils');
  var Err = require('custom_errors');
  var constants = require('constants');
  var circuits = require('circuits');
  var circuit_utils = require('circuits_utils');
  var Ractive = require('ractive');
  var todo_item_template = require('text!../../../test/qunit_specs/assets/todo_app/todo_item_template.html'); // TODO : check require for text
  var make_link = circuits.make_link;
  var get_port_uri = circuits.get_port_uri;
  var get_default_simulate_conn = circuits.get_default_simulate_conn;
  var rxlog = utils.rxlog;

  // Constants
  var COMMAND_PLUG_IN_CIRCUIT = constants.COMMAND_PLUG_IN_CIRCUIT;
  var COMMAND_UNPLUG_CIRCUIT = constants.COMMAND_UNPLUG_CIRCUIT;
  var CIRCUIT_OR_CHIP_TYPE = constants.CIRCUIT_OR_CHIP_TYPE;
  var TEST_CASE_PORT_NAME = constants.TEST_CASE_PORT_NAME;

  // Template variables
  // The keycode for the 'enter' and 'escape' keys
  var ENTER_KEY = 13;
  var ESCAPE_KEY = 27;
  var filters = {
    completed: function (item) { return item.completed; },
    active: function (item) { return !item.completed; }
  };


  var controller_IN_port_name = 'order$';
  var controller_OUT_port_name = 'circuits_state$';
  var controller_uri = 'controller_1';
  var controller_setup = {
    uri: controller_uri,
    ports: {
      IN: [controller_IN_port_name],
      OUT: [controller_OUT_port_name]
    },
  };
  var make_controller_setup = function make_controller_setup(controller_subscribe_fn) {
    var extended_controller_set_up = utils.clone_deep(controller_setup);
    extended_controller_set_up.settings = extended_controller_set_up.settings || {};
    // set up the function to subscribe to the controller's OUT port (only one OUT port)
    extended_controller_set_up.settings.controller_subscribe_fn = controller_subscribe_fn;
    return extended_controller_set_up;
  };

  function catch_error_test_results(e) {
    console.error('catch_error_test_results', e);
  }

  function DOM_qs(element) {
    return element.querySelector.bind(element);
  }

  QUnit.test("todo item component test", function test_controller(assert) {
    var done = assert.async(1);

    var view_chip_uri = 'view_chip_1';
    var view_chip_simulate_conn = get_default_simulate_conn(view_chip_uri);
    var view_chip = circuits.make_chip({
      serie: 'ractive',
      uri: 'view_chip_1',
      ports: {
        IN: ['update', 'delete'],
        OUT: []
      },
      transform: ractive_driver,
      settings: {
        template: todo_item_template, // TODO : remove the first and last lines, so first look at format
        twoway: false,
        data: {// TODO : put the css for that
          filter: function filter_item(item) {
            // Because we're doing `this.get('currentFilter')`, Ractive understands
            // that this function needs to be re-executed reactively when the value of
            // `currentFilter` changes
            var currentFilter = this.get('currentFilter');

            if (currentFilter === 'all') {
              return true;
            }

            return filters[currentFilter](item);
          },
          // completedTasks() and activeTasks() are computed values, that will update
          // our app view reactively whenever `items` changes (including changes to
          // child properties like `items[1].completed`)
          completedTasks: function () {
            return this.get('items').filter(filters.completed);
          },
          activeTasks: function () {
            return this.get('items').filter(filters.active);
          },
          // By default todo item is empty
          description: '',
          // By default, show all tasks. This value changes when the route changes
          // (see routes.js)
          currentFilter: 'all'
        }
      },
      test: {
        simulate: view_chip_simulate_conn
      },
      dispose: ractive_dispose
    });

    function ractive_driver(update$, delete$, settings) {
      var ractive_view = undefined;

      // 0. Contract : Both `el` and `template` must be defined to display the view
      if (!(settings.el && settings.template)) {
        throw 'ractive_driver : Insufficient data to display view! DOM element where ' +
        'to anchor the view and the view template are both necessary!'
      }

      // TODO : check that settings are correctly merged
      console.log('settings', settings);
      // 1. Create/Display the view if the necessary data is present
      ractive_view = new Ractive(settings);

      // 2. Update the view with incoming data stream
      update$.subscribe(function (data) {
        if (ractive_view) {
          ractive_view.set(data);
        }
        else {
          console.warn('received data : %O while view is not displayed yet!', data);
        }
      });

      // 3. Destroy the view on reception of destroy message
      delete$.subscribe(function dispose_ractive_view() {
        if (ractive_view) {
          ractive_view.teardown(); // TODO : check ractive API
        }
        else {
          console.warn('received teardown message with a view which is not displayes yet!');
        }
      });
    }

    function ractive_dispose() {
      // TODO : nothing for now, but should be used to test disposal
      console.warn('DISPOSING!!');
    }

    var todo_item_update_uri = 'todo_item_update_1';
    var todo_item_update_simulate_conn = get_default_simulate_conn(todo_item_update_uri);
    //    var todo_item_update_readout_conn = get_default_readout_conn(todo_item_update_uri);
    //    todo_item_update_readout_conn.spy='there';
    var todo_item_update_chip = circuits.make_chip({
      serie: 'todo_item_update',
      uri: todo_item_update_uri,
      ports: {
        IN: ['update_todo_text', 'edit', 'cancel', 'toggle_visibility', 'delete_todo', 'external_intent'],
        OUT: ['update_model', 'destroy', 'notify']
      },
      transform: update_todo_model,
      test: {
        simulate: todo_item_update_simulate_conn,
        //        readout: todo_item_update_readout_conn,
      }
    });

    // TODO : DOCUMENT : settings must be there even if not used as the number of arguments of the function is checked!!
    function update_todo_model(update_todo_text$, edit$, cancel$, toggle_visibility$, delete_todo$, external_intent$, settings) {
      return {
        update_model: Rx.Observable.merge(
          update_todo_text$
            .merge(external_intent$.filter(utils.is_label('update_todo_text')).map(utils.remove_label)),
          toggle_visibility$
            .merge(external_intent$.filter(utils.is_label('toggle_visibility')).map(utils.remove_label))
            .map(function update_visibility(is_visible) {
              return {
                prop: is_visible // TODO : cf. template to see which property to put here
              }
            }),
          edit$
            .merge(external_intent$.filter(utils.is_label('edit')).map(utils.remove_label)),
          cancel$
            .merge(external_intent$.filter(utils.is_label('cancel')).map(utils.remove_label))
        ),
        destroy: delete_todo$,
        // Outward flow to inform whomever it may concern of the actions taken in the chip
        // Here we only notify of a child's `destroy` action to the parent
        notify: delete_todo$.map(utils.label('delete_todo'))
      }
    }

    var todo_item_intent_uri = 'todo_item_intent_1';
    var todo_item_intent = circuits.make_chip({
      serie: 'todo_item_intent',
      uri: todo_item_intent_uri,
      ports: {
        IN: [],
        OUT: ['update_todo_text', 'toggle_visibility', 'delete_todo', 'edit', 'cancel']
      },
      transform: compute_todo_item_intents
    });

    function compute_todo_item_intents(settings) {
      var element = document.getElementById(settings.el);
      var qs = DOM_qs(element);
      var item_id = "" + settings.data.item_id;

      return {
        update_todo_text: Rx.Observable.defer(function () {
          return Rx.Observable.merge(
            Rx.Observable.fromEvent(element, 'keydown'),
            Rx.Observable.fromEvent(element, 'blur')
          )
            .filter(function filter_key(event) { return event.which === ENTER_KEY })
            .map(function get_todo_text(event) {
              var description = event.target.value.trim();

              return {
                description: description,
                editing: false
              }
            })
        }),
        edit: Rx.Observable.defer(function () {
          return Rx.Observable.fromEvent(qs('#' + item_id), 'dblclick')
            .map(function dbl_click_handler(event) { return {editing: true} })
        }),
        cancel: Rx.Observable.defer(function () {
          return Rx.Observable.fromEvent(qs('#' + item_id), 'keydown')
            .filter(function filter_key(event) { return event.which === ESCAPE_KEY })
            .map(function get_cancel_intent(event) {
              return {
                editing: false
              }
            })
        }),
        toggle_visibility: Rx.Observable.defer(function () {
          return Rx.Observable.fromEvent(qs('.toggle'), 'click')
            .map(function get_visibility(event) {
              return {
                completed: qs('.toggle').checked
              }
            })
        }), // prevent default to look so click still uncheck/check button
        delete_todo: Rx.Observable.defer(function () {
          return Rx.Observable.fromEvent(qs('.destroy'), 'click')
            .map(function make_remove_todo_intent(event) {
              return {
                remove_todo_item: item_id
              };
            })
        })
      }
    }

    // TODO:  update temmplate file to remove custom events
    // Build the circuit encapsulating the chips
    var todo_item_circuit_uri = 'todo_item_circuit_1';
    var todo_item_simulate_conn = get_default_simulate_conn(todo_item_circuit_uri);
    //    var todo_item_readout_conn = get_default_readout_conn();
    var todo_item_circuit = utils.new_typed_object({
      serie: 'todo_item_circuit',
      uri: 'todo_item_circuit_1',
      chips: [todo_item_intent, todo_item_update_chip, view_chip],
      ports_map: {
        IN: {
          external_intent: {chip_uri: todo_item_update_chip.uri, port_name: 'external_intent'}
        },
        OUT: {
          notify: {chip_uri: todo_item_update_chip.uri, port_name: 'notify'}
        }
      },
      links: [
        make_link(todo_item_update_chip, view_chip, 'update_model', 'update'), // OUT: ['update_model', 'destroy', 'notify'] IN: ['update', 'delete'],
        make_link(todo_item_update_chip, view_chip, 'destroy', 'delete'),
        make_link(todo_item_intent, todo_item_update_chip, 'update_todo_text', 'update_todo_text'), // OUT: ['update_todo_text', 'toggle_visibility', 'delete_todo']
        make_link(todo_item_intent, todo_item_update_chip, 'toggle_visibility', 'toggle_visibility'), // IN: ['update_todo_text', 'edit', 'cancel', 'toggle_visibility', 'delete_todo', 'external_intent'],
        make_link(todo_item_intent, todo_item_update_chip, 'delete_todo', 'delete_todo'),
        make_link(todo_item_intent, todo_item_update_chip, 'edit', 'edit'),
        make_link(todo_item_intent, todo_item_update_chip, 'cancel', 'cancel')
      ], // TODO : to set to TODO manager when the time comes
      settings: {
        el: 'app',
        append: true,
        data: {item_id: 'i1'}
      },
      test: {
        simulate: todo_item_simulate_conn,
        //        readout: todo_item_circuit_test_readout
      }
    }, CIRCUIT_OR_CHIP_TYPE);
    // TODO : add a test parameter to the order which will hold the readout connector
    // TODO : or pass variables and fill them from inside as a pis-aller (workaround)

    // Testing todo item component
    // 0. Controller
    // Controller definition
    var controller = circuits.create_controller(controller_setup);
    var controller_IN_port_uri = get_port_uri({chip_uri: controller.uri, port_name: controller_IN_port_name});
    var simulate_conn = controller.test.simulate;

    // 1. Plug the todo-item
    var todo_item_plug_order = {};
    todo_item_plug_order[controller_IN_port_uri] = {
      command: COMMAND_PLUG_IN_CIRCUIT,
      parameters: {circuit: todo_item_circuit, links: undefined}
    };
    var test_order = {};
    var test_chip_obj = circuit_utils.make_test_chip();
    var test_chip = test_chip_obj.test_chip;
    var test_chip_simulate_conn = test_chip_obj.simulate_conn;
    test_order [controller_IN_port_uri] = {
      command: COMMAND_PLUG_IN_CIRCUIT,
      parameters: {
        circuit: test_chip, links: [
          make_link(controller, test_chip, 'circuits_state$', 'circuits_state')
        ]
      }
    };
    simulate_conn.onNext(todo_item_plug_order);
    simulate_conn.onNext(test_order);

    var test_case = {
      input_seq: [
        {to : "todo_item_update_1-|update_todo_text", input :  {description: 'description test value'}},
      ],
      expected_output_seq: [],
      test_success_message: [
        'TODO',
      ].join('\n'),
      output_transform_fn: test_case_output_transform_fn, // TODO: update if necessary
      readout_filter: utils.always(true),
      analyze_test_results_fn: analyze_test_results
    };
  // utils.contains_string('update')
    // Send test case inputs, the test should then execute
    var test_case_labelled_message = {};
    test_case_labelled_message[get_port_uri({chip_uri : test_chip.uri, port_name: TEST_CASE_PORT_NAME})] = test_case;
    test_chip_simulate_conn.onNext(test_case_labelled_message);


    function test_case_output_transform_fn(output_value) {
      var port_uri = utils.get_label(output_value);
      var readout = utils.remove_label(output_value).readout;

      return {
        port_uri: port_uri,
        readout: readout,
      };
    };

    function analyze_test_results(actual_output_seq, expected_output_seq, test_success_message) {
      assert.deepEqual(actual_output_seq, expected_output_seq, test_success_message);
      done();
    }
    // TODO : Edge case : error while processing test inputs
    // TODO : test all chips one by one with the simulate and test the circuit too with the same

  });

});

// component graph TODO list
// http://knsv.github.io/mermaid/live_editor/
//graph TB
//subgraph controller
//order
//end
//subgraph TODO_List
//event_plus-->intent
//intent-->|new item| action
//intent-->|remove item| action
//intent-->|update counter| model
//action-->order
//model-->DOM
//end
//subgraph TODO_Item
//TI_event_enter-->TI_intent
//TI_event_delete-->TI_intent
//TI_intent-->|new item| TI_action
//TI_intent-->|new item| TI_model
//TI_intent-->|delete item| intent
//TI_action-->Storage
//TI_model-->TI_DOM
//end
//
