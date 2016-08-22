// References
// DOM query selectors : https://developer.mozilla.org/en-US/docs/Web/API/Document/querySelector
//
// TODO : still pending, 1.mark all as complete in conjunction with. item complete, 2.doubleclick on item does not do editingxx
// TODO : maybe also 3. duplication of output
// TODO : test delete of component with children
// TODO : add mermaid chip (with replay? version 1 : only show current state of graph and last message)
// TODO : write documentation (concepts doc, user doc, API doc)
// TODO : refactor (utils, underscore -> R?), choose (model, model_update) system
// TODO : separate circuits.js (circuitry.js, ic.js?) and deliver (build?) v1.0
// TODO : error management for version 2.0
// TODO : TODO with other view driver (SnabDOM?) for version 2.1
// TODO : better TODO (with firebase storage) for version 2.2


define(function (require) {
  var utils = require('utils');
  var Err = require('custom_errors');
  var constants = require('constants');
  var circuits = require('circuits');
  var circuit_utils = require('circuits_utils');
  var Ractive = require('ractive');
  var mermaid = require('mermaid');
  var todo_item_template = require('text!../../../test/qunit_specs/assets/todo_app/todo_item_template.html');
  var todo_manager_template = require('text!../../../test/qunit_specs/assets/todo_app/todo_manager_template.html');
  var make_link = circuits.make_link;
  var get_port_uri = circuits.get_port_uri;
  var get_default_simulate_conn = circuits.get_default_simulate_conn;
  var get_simulate_port_uri = circuits.get_simulate_port_uri;
  var rxlog = utils.rxlog;
  var clone_circuit = circuit_utils.clone_circuit;

//  mermaid
//  var element = document.querySelector("#mermaid");
//
//  var insertSvg = function (svgCode, bindFunctions) {
//    element.innerHTML = svgCode;
//  };
//
//  var graphDefinition = 'graph TB\na-->b';
//  var graph = mermaid.render('mermaid', graphDefinition, insertSvg);


  // Constants
  var COMMAND_PLUG_IN_CIRCUIT = constants.COMMAND_PLUG_IN_CIRCUIT;
  var COMMAND_UNPLUG_CIRCUIT = constants.COMMAND_UNPLUG_CIRCUIT;
  var CIRCUIT_OR_CHIP_TYPE = constants.CIRCUIT_OR_CHIP_TYPE;
  var TEST_CASE_PORT_NAME = constants.TEST_CASE_PORT_NAME;
  var SIMULATE_PORT_NAME = constants.SIMULATE_PORT_NAME;
  var CONTROLLER_CHIP_URI = constants.CONTROLLER_CHIP_URI;
  var FROM_CHILD_PORT_NAME = constants.FROM_CHILD_PORT_NAME;
  var FROM_PARENT_PORT_NAME = constants.FROM_PARENT_PORT_NAME;
  var TO_CHILDREN_PORT_NAME = constants.TO_CHILDREN_PORT_NAME;
  var TO_PARENT_PORT_NAME = constants.TO_PARENT_PORT_NAME;
  var TO_CONTROLLER_PORT_NAME = constants.TO_CONTROLLER_PORT_NAME;
  var FROM_CONTROLLER_PORT_NAME = constants.FROM_CONTROLLER_PORT_NAME;
  var ALL = constants.ID_ALL;

  // Template variables
  // The keycode for the 'enter' and 'escape' keys
  var ENTER_KEY = 13;
  var ESCAPE_KEY = 27;
  var filters = {
    completed: function (item) { return item.completed; },
    active: function (item) { return !item.completed; }
  };


  var controller_IN_port_name = TO_CONTROLLER_PORT_NAME;
  var controller_OUT_port_name = FROM_CONTROLLER_PORT_NAME;
  var controller_uri = CONTROLLER_CHIP_URI;
  var controller_setup = {
    uri: controller_uri,
    ports: {
      IN: [controller_IN_port_name],
      OUT: [controller_OUT_port_name]
    }
  };
  var make_controller_setup = function make_controller_setup(controller_subscribe_fn) {
    var extended_controller_set_up = utils.clone_deep(controller_setup);
    extended_controller_set_up.settings = extended_controller_set_up.settings || {};
    // set up the function to subscribe to the controller's OUT port (only one OUT port)
    extended_controller_set_up.settings.controller_subscribe_fn = controller_subscribe_fn;
    return extended_controller_set_up;
  };

  function is_destined_to(id) {
    return function (message) {
      return message.item_id === ALL
        ? true
        : message.item_id === id
    }
  }

  function catch_error_test_results(e) {
    console.error('catch_error_test_results', e);
  }

  function DOM_qs(element) {
    return element.querySelector.bind(element);
  }

  function ractive_driver(update$, delete$, settings) {
    var ractive_view = undefined;

    // 0. Contract : Both `el` and `template` must be defined to display the view
    if (!(settings.el && settings.template)) {
      throw 'ractive_driver : Insufficient data to display view! DOM element where ' +
      'to anchor the view and the view template are both necessary!'
    }

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
        ractive_view.teardown();
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

  function get_todo_item_circuit(item_id) {
    var item_id = item_id || '0';

    var view_chip = circuits.make_chip({
      serie: 'ractive',
      uri: ['view_chip', item_id].join('_'),
      ports: {
        IN: ['update', 'delete'],
        OUT: []
      },
      transform: ractive_driver,
      settings: {
        template: todo_item_template,
        twoway: false,
        data: {// TODO : put the css for that
          filter: function filter_item(item) {
            // Because we're doing `this.get('currentFilter')`, Ractive understands
            // that this function needs to be re-executed reactively when the value of
            // `currentFilter` changes
            var current_filter = this.get('current_filter');

            if (current_filter === 'all') {
              return true;
            }

            return filters[current_filter](item);
          },
          // By default todo item is empty
          description: '',
          // TODO : By default, show all tasks. This value changes when the route changes
          // (see routes.js)
          current_filter: 'all' // TODO : might have to update that, as this is set in parent
        }
      },
      dispose: ractive_dispose
    });

    var todo_item_intent_uri = 'todo_item_intent';
    var todo_item_intent = circuits.make_chip({
      serie: 'todo_item_intent',
      uri: [todo_item_intent_uri, item_id].join('_'),
      ports: {
        IN: [],
        OUT: ['update_todo_text', 'delete_todo', 'edit', 'cancel', 'status']
      },
      transform: compute_todo_item_intents
    });

    function compute_todo_item_intents(settings) {
      var element = document.querySelector(settings.el);
      var qs = DOM_qs(element);
      var item_id = "" + settings.data.item_id;

      var selectors = {
        toggle_item: '.toggle',
        input_edit: '.edit',
        destroy: '.destroy'
      };

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
            .do(utils.rxlog('intent : update_todo_text'))
        }),
        edit: Rx.Observable.defer(function () {
          return utils.from_event(element, selectors.input_edit, 'dblclick')
            .map(function dbl_click_handler(event) { return {editing: true} })
            .do(utils.rxlog('intent : edit'))
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
        status: Rx.Observable.defer(function () {
          return Rx.Observable.fromEvent(qs(selectors.toggle_item), 'click')
            .map(function get_completed_status(event) {
              return {
                completed: qs(selectors.toggle_item).checked
              }
            })
            .do(utils.rxlog('intent : status'))
        }),
        delete_todo: Rx.Observable.defer(function () {
          return Rx.Observable.fromEvent(qs(selectors.destroy), 'click')
            .map(function make_remove_todo_intent(event) {
              return {
                remove_todo_item: item_id
              };
            })
        })
      }
    }

    var todo_item_update_uri = 'todo_item_update';
    var todo_item_update_chip = circuits.make_chip({
      serie: 'todo_item_update',
      uri: [todo_item_update_uri, item_id].join('_'),
      ports: {
        IN: ['update_todo_text', 'status', 'edit', 'cancel', 'delete_todo', FROM_PARENT_PORT_NAME],
        OUT: ['update_model', 'destroy', TO_PARENT_PORT_NAME]
      },
      transform: update_todo_model
    });

    function update_todo_model(update_todo_text$, status$, edit$, cancel$, delete_todo$, from_parent_port_name$, settings) {
      var item_id = settings.item_id;
      var model_0 = {
        completed: false,
        editing: false,
        description: '',
        item_id: item_id
      };
      var OUT_ports = {};

      OUT_ports.update_model = Rx.Observable.merge(
        update_todo_text$.do(utils.rxlog('update_todo_text$')),
        status$.do(utils.rxlog('status$')),
        edit$.do(utils.rxlog('edit$')),
        cancel$.do(utils.rxlog('cancel$')),
        from_parent_port_name$.filter(is_destined_to(settings.item_id)).do(utils.rxlog('from_parent_port_name$'))
      )
        .startWith(settings.data);

      // NOTE : this is another way to do this, cf. the update chip in the parent to see another way.
      // TODO : choose ONE of those ways
      var model$ = OUT_ports.update_model
        .scan(function update_model(model, update) {
          _.forEach(update, function update(value, key) {
            model[key] = value;
          });
          return model;
        }, {});

      OUT_ports.destroy = Rx.Observable.merge(
        delete_todo$,
        // Clear completed order from parent
        from_parent_port_name$
          .filter(utils.is_label('clear_completed'))
          .withLatestFrom(model$, function (model) {
            return model.completed;
          })
          .filter(utils.identity)
      );

      // Outward flow to inform the parent of the actions taken in the child :
      // 1. Delete action
      // 2. Toggling active/completed status
      OUT_ports[TO_PARENT_PORT_NAME] = Rx.Observable.merge(
        // Here we only notify of a child's `destroy` action to the parent
        OUT_ports.destroy.map(utils.always({delete_todo: item_id})),
        status$.map(function (status) {
          return {
            completed: status.completed,
            item_id: item_id
          }
        })
      );

      return OUT_ports;
    }

    // TODO:  update temmplate file to remove custom events
    // Build the circuit encapsulating the chips
    var todo_item_circuit_ports_map_IN = {};
    var todo_item_circuit_ports_map_OUT = {};
    todo_item_circuit_ports_map_IN[FROM_PARENT_PORT_NAME] = {
      chip_uri: todo_item_update_chip.uri,
      port_name: FROM_PARENT_PORT_NAME
    };
    todo_item_circuit_ports_map_OUT[TO_PARENT_PORT_NAME] = {
      chip_uri: todo_item_update_chip.uri,
      port_name: TO_PARENT_PORT_NAME
    };
    var todo_item_circuit = utils.new_typed_object({
      serie: 'todo_item_circuit',
      uri: ['todo_item_circuit', item_id].join('_'),
      chips: [todo_item_intent, todo_item_update_chip, view_chip],
      ports_map: {
        IN: todo_item_circuit_ports_map_IN,
        OUT: todo_item_circuit_ports_map_OUT
      },
      links: [
        make_link(todo_item_update_chip, view_chip, 'update_model', 'update'),
        make_link(todo_item_update_chip, view_chip, 'destroy', 'delete'),
        make_link(todo_item_intent, todo_item_update_chip, 'update_todo_text', 'update_todo_text'),
        make_link(todo_item_intent, todo_item_update_chip, 'status', 'status'),
        make_link(todo_item_intent, todo_item_update_chip, 'delete_todo', 'delete_todo'),
        make_link(todo_item_intent, todo_item_update_chip, 'edit', 'edit'),
        make_link(todo_item_intent, todo_item_update_chip, 'cancel', 'cancel')
      ],
      settings: {
        el: '#app',
        append: true,
        data: {item_id: item_id}
      }
    }, CIRCUIT_OR_CHIP_TYPE);

    return todo_item_circuit;
  }

  function get_todo_manager_circuit(todo_item_circuit_factory) {
    // TODO : view chip, intent chip, model chip : VIM factoring
    // TODO : rule : when all todo items are checked as completed, then todo manager should also be checked
    // Selectors used as events' current target
    var selectors = {
      new_todo_input: '#new-todo',
      toggle_all_input: '#toggle-all',
      id_todo_list_start: '#todo-list',
      clear_completed_button: '#clear-completed'
    };

    // 0. View chip
    var model_0 = {
      todo_mgr_text: '',
      active_tasks: 0,
      completed_tasks: 0
    };
    var view_chip = circuits.make_chip({
      serie: 'ractive',
      // TODO : study impact of using same name - should be ok because only ports are in the hash and they use the port_name, but if port name and uri were the same : BOOM!!
      // TODO : so how to ensure unique uri???
      uri: 'todo_manager_view_chip_1',
      ports: {
        IN: ['update', 'delete'],
        OUT: []
      },
      transform: ractive_driver,
      settings: {
        template: todo_manager_template,
        twoway: false,
        data: model_0
      },
      dispose: ractive_dispose
    });

    // 1. Intent chip
    var user_intents = ['new_todo', 'toggle_all', 'clear_completed'];
    var todo_manager_intent_uri = 'todo_manager_intent_1';
    var todo_manager_intent_chip = circuits.make_chip({
      serie: 'todo_manager_intent',
      uri: todo_manager_intent_uri,
      ports: {
        IN: [],
        OUT: user_intents
      },
      transform: compute_todo_item_intents
    });

    function compute_todo_item_intents(settings) {
      var element = document.querySelector(settings.el); // TODO : change that to use selector for consistency
      var qs = DOM_qs(element);

      return {
        new_todo: Rx.Observable.defer(function () {
          return Rx.Observable.fromEvent(qs(selectors.new_todo_input), 'keydown')
            .filter(function filter_key(event) { return event.which === ENTER_KEY })
            .map(function get_todo_text(event) { return {new_todo_text: event.target.value.trim()}})
            .filter(utils.identity)
        }),
        toggle_all: Rx.Observable.defer(function () {
          return Rx.Observable.fromEvent(qs(selectors.toggle_all_input), 'change')
            // Actually I don't need to return anything, just the information that it is a toggle_all is enough
            .map(function (event) { return {check_all: event.target.checked} })
        }),
        clear_completed: Rx.Observable.defer(function () {
          return utils.from_event(element, selectors.clear_completed_button, 'click')
            .map(function (event) { return {clear_completed: true} })
        })
      }
    }

    // TODO : DOCUMENTATION : the to_child is necessary multicast, we can't have a dynamic number of ports on a chip - children must filter by id if necessary
    // TODO : DOCUMENTATION : same goes for the parent, children multiplex their messages : can be distinguished through id

    // 2. Update chip
    var todo_manager_update_uri = 'todo_manager_update_1';
    var start_id = 0;
    var todo_manager_update_chip = circuits.make_chip({
      serie: 'todo_manager_update',
      uri: todo_manager_update_uri,
      ports: {
        IN: ['new_todo', 'toggle_all', 'clear_completed', FROM_CHILD_PORT_NAME],
        OUT: ['update', TO_CONTROLLER_PORT_NAME, TO_CHILDREN_PORT_NAME]
      },
      transform: update_todo_model(start_id)
    });

    function update_todo_model(start_id) {
      var initial_id = start_id || 0;

      return function update_todo_model(new_todo$, toggle_all$, clear_completed$, from_child_port_name$, settings) {
        var OUT_ports = {};
        var child_circuit_factory = settings.child_circuit_factory;
        // TODO : document child_circuit_factory as part of settings
        var model_0 = {
          todo_mgr_text: '',
          active_tasks: 0,
          completed_tasks: 0
        };
        var model_update = {};

        var index_new_todo$ = new_todo$
          .scan(function (id, new_todo) {
            return ++id;
          }, initial_id)
          .map(function (x) {return 'item' + x});

        // Controller can receive two orders:
        // 1. Create a new todo item
        // 2. Delete an existing todo item
        OUT_ports[TO_CONTROLLER_PORT_NAME] = Rx.Observable.merge(
          new_todo$.withLatestFrom(index_new_todo$, function (new_todo_intent, next_id) {
            // returns an order for the controller to crate the todo item component and its corresponding flow
            var new_todo_item_circuit = child_circuit_factory(next_id);
            return {
              command: COMMAND_PLUG_IN_CIRCUIT,
              parameters: {
                // circuit to add need a unique id which is provided by `initial_id`
                circuit: new_todo_item_circuit,
                links: [
                  make_link(todo_manager_circuit, new_todo_item_circuit, TO_CHILDREN_PORT_NAME, FROM_PARENT_PORT_NAME),
                  make_link(new_todo_item_circuit, todo_manager_circuit, TO_PARENT_PORT_NAME, FROM_CHILD_PORT_NAME)
                ],
                settings: { // TODO : check that the order settings is mixed with the circuit/chip settings!!
                  el: selectors.id_todo_list_start,
                  append: true,
                  // Pass the child item its unique id
                  // We put it in data as ultimately it will end up in the child's data property, so the merge does the job itself
                  item_id: next_id,
                  data: {
                    description: new_todo_intent.new_todo_text,
                    editing: true,
                  }
                }
              }
            }
          }),
          // child notification of delete : remove the todo item circuit
          from_child_port_name$
            .filter(function (from_child_message) {return from_child_message.delete_todo})
            .map(function (from_child_message) {
              var item_id = from_child_message.delete_todo;
              var new_todo_item_circuit = child_circuit_factory(item_id);

              // NOTE : In the case of an unplug order, it should be enough to pass `parameters.circuit`
              // However, we pass for now the same `parameters` object than with the plug order
              // TODO : modify the implementation of unplug to remove the need for links BUT NOT settings (is a parameter of the creation function, so should be a parameter of the destroy function)
              return {
                command: COMMAND_UNPLUG_CIRCUIT,
                parameters: {
                  circuit: new_todo_item_circuit,
                  links: [
                    make_link(todo_manager_circuit, new_todo_item_circuit, TO_CHILDREN_PORT_NAME, FROM_PARENT_PORT_NAME),
                    make_link(new_todo_item_circuit, todo_manager_circuit, TO_PARENT_PORT_NAME, FROM_CHILD_PORT_NAME)
                  ],
                  settings: {
                    el: selectors.id_todo_list_start,
                    append: true,
                    item_id: item_id // TODO : change that to item_id directly and in the function which uses it, read it and set it back
                  }
                }

              }
            })
        );

        // Child can receive three intents from parent :
        // 1. Set todo text
        // 2. Toggle completed/active state
        // 3. Remove itself if completed
        OUT_ports[TO_CHILDREN_PORT_NAME] = Rx.Observable.merge(
          // Unicast an update todo text message to child
          new_todo$.withLatestFrom(index_new_todo$, function (description, next_id) {
            return {
              item_id: next_id,
              description: description,
              completed: false
            }
          }),
          // Broadcast a toggle completed message to children
          toggle_all$.map(function (toggle_all) {
            return {
              item_id: ALL,
              completed: toggle_all.check_all
            };
          }),
          // Broadcast a delete completed todo message to children
          clear_completed$.map(function () {
            return {
              item_id: ALL,
              clear_completed: true
            };
          })
        );

        // TODO : this version of model/model_update is the one more generic to follow everywhere. Remove the other one in todoitem
        // TODO : extend rx.observable to add label function
        var model$ = Rx.Observable.merge(
          new_todo$.map(utils.label('new_todo')),
          from_child_port_name$.map(utils.label('from_child'))
        )
          .scan(function (model, intent) {
            var model_update = {};

            if (utils.is_label('new_todo')(intent)) {
              // Case : new todo
              // Initialize the input field to nothing when a new todo has been submitted
              model_update = {
                active_tasks: model.active_tasks + 1,
                todo_mgr_text: ''
              };
            }
            else if (utils.is_label('from_child')(intent)) {
              // Case : intent received from child
              // Here it is only toggling active/completed status
              var child_message = utils.remove_label(intent) || {};

              if ('completed' in child_message) {
                var completed = child_message.completed;
                model_update = completed
                  ? {completed_tasks: model.completed_tasks + 1, active_tasks: model.active_tasks - 1}
                  : {completed_tasks: model.completed_tasks - 1, active_tasks: model.active_tasks + 1}
              }
              else if ('delete_todo' in child_message) {
                model_update = {completed_tasks: model.completed_tasks + 1, active_tasks: model.active_tasks - 1}
              }
            }

            // Update the model with the update...
            _.merge(model, model_update);
            // ... and keep the update in a separate property as we need it for the ractive driver
            model._model_update = model_update;
            return model;
          }, model_0);

        OUT_ports['update'] = model$.map(utils.get_prop('_model_update'));

        return OUT_ports;
      }
    }

    // Build the circuit encapsulating the chips
    var todo_manager_circuit_ports_map_IN = {};
    var todo_manager_circuit_ports_map_OUT = {};
    todo_manager_circuit_ports_map_IN[FROM_CHILD_PORT_NAME] = {
      chip_uri: todo_manager_update_chip.uri,
      port_name: FROM_CHILD_PORT_NAME
    };
    todo_manager_circuit_ports_map_OUT[TO_CHILDREN_PORT_NAME] = {
      chip_uri: todo_manager_update_chip.uri,
      port_name: TO_CHILDREN_PORT_NAME
    };
    todo_manager_circuit_ports_map_OUT[TO_CONTROLLER_PORT_NAME] = {
      chip_uri: todo_manager_update_chip.uri,
      port_name: TO_CONTROLLER_PORT_NAME
    };
    var todo_manager_circuit = utils.new_typed_object({
      serie: 'todo_manager_circuit',
      uri: 'todo_manager_circuit_1',
      chips: [todo_manager_intent_chip, todo_manager_update_chip, view_chip],
      ports_map: {
        IN: todo_manager_circuit_ports_map_IN,
        OUT: todo_manager_circuit_ports_map_OUT
      },
      links: [
        make_link(todo_manager_update_chip, view_chip, 'update', 'update'),
        make_link(todo_manager_intent_chip, todo_manager_update_chip, 'new_todo', 'new_todo'),
        make_link(todo_manager_intent_chip, todo_manager_update_chip, 'toggle_all', 'toggle_all'),
        make_link(todo_manager_intent_chip, todo_manager_update_chip, 'clear_completed', 'clear_completed')
      ],
      settings: {
        child_circuit_factory: todo_item_circuit_factory
      }
    }, CIRCUIT_OR_CHIP_TYPE);

    return todo_manager_circuit;
  }

  QUnit.module("Testing with real applications", {});

  QUnit.skip("todo item component test", function test_controller(assert) {
    var done = assert.async(1);

    var todo_item_circuit = get_todo_item_circuit(0);

    // Testing todo item component
    // 0. Controller
    // Controller definition
    var controller = circuits.create_controller(controller_setup);
    var controller_IN_port_uri = get_port_uri({chip_uri: controller.uri, port_name: controller_IN_port_name});
    var simulate_conn = controller.test.simulate;

    // Make the todo item plug-in order
    var todo_item_plug_order = {};
    todo_item_plug_order[controller_IN_port_uri] = {
      command: COMMAND_PLUG_IN_CIRCUIT,
      parameters: {circuit: todo_item_circuit, links: undefined}
    };
    // Make the test chip plug-in order
    var test_order = {};
    var test_chip_obj = circuit_utils.make_test_chip();
    var test_chip = test_chip_obj.test_chip;
    var test_chip_simulate_conn = test_chip_obj.simulate_conn;
    test_order [controller_IN_port_uri] = {
      command: COMMAND_PLUG_IN_CIRCUIT,
      parameters: {
        circuit: test_chip, links: [
          make_link(controller, test_chip, 'circuits_state$', 'circuits_state')
        ],
        settings: {
          el: '#app',
          append: true
        }
      }
    };
    // Plug-in the todo_item circuit
    simulate_conn.onNext(todo_item_plug_order);
    // Plug-in the test chip
    simulate_conn.onNext(test_order);

    var test_case = {
      input_seq: [
        // Simulating intent <- [event keypress]* + event enter
        {to: "todo_item_update_1-|update_todo_text", input: {description: 'description test value'}},
        // Simulating intent <- event double-click
        {to: "todo_item_update_1-|edit", input: {editing: true}},
        // Simulating intent <- event keydown escape
        {to: "todo_item_update_1-|cancel", input: {editing: false}},
        // Simulating intent <- event button click delete
        {to: "todo_item_update_1-|delete_todo", input: {anything: 'does not matter'}},
      ],
      expected_output_seq: [
        // NOTE : there is no `notify` message as the notify OUT port is not subscribed to
        {
          "port_uri": "todo_item_circuit_1",
          "readout": {"description": "description test value"},
          "relayed_from": "todo_item_update_1-|update_model"
        },
        {
          "port_uri": "todo_item_circuit_1",
          "readout": {"editing": true},
          "relayed_from": "todo_item_update_1-|update_model"
        },
        {
          "port_uri": "todo_item_circuit_1",
          "readout": {"editing": false},
          "relayed_from": "todo_item_update_1-|update_model"
        },
        {
          "port_uri": "todo_item_circuit_1",
          "readout": {"anything": "does not matter"},
          "relayed_from": "todo_item_update_1-|destroy"
        }],
      test_success_message: [
        'TODO',
      ].join('\n'),
      output_transform_fn: test_case_output_transform_fn,
      readout_filter: utils.contains_string('circuit'),
      analyze_test_results_fn: analyze_test_results
    };
    // Send test case inputs, the test should then execute
    var test_case_labelled_message = {};
    test_case_labelled_message[get_port_uri({chip_uri: test_chip.uri, port_name: TEST_CASE_PORT_NAME})] = test_case;
    test_chip_simulate_conn.onNext(test_case_labelled_message);

    function test_case_output_transform_fn(output_value) {
      var port_uri = utils.get_label(output_value);
      var from = utils.get_label(utils.remove_label(output_value));
      var readout = utils.remove_label(utils.remove_label(output_value)).readout;

      return {
        port_uri: port_uri,
        relayed_from: from,
        readout: readout
      };
    }

    function analyze_test_results(actual_output_seq, expected_output_seq, test_success_message) {
      assert.deepEqual(actual_output_seq, expected_output_seq, test_success_message);
      done();
    }

    // TODO : Edge case : error while processing test inputs
    // TODO : test all chips one by one with the simulate and test the circuit too with the same

  });

  QUnit.test("todo manager component test", function test_todo_manager(assert) {
    var done = assert.async(1);

    var todo_manager_circuit = get_todo_manager_circuit(get_todo_item_circuit);

    // Testing todo manager
    // 0. Controller
    // Controller definition
    var controller = circuits.create_controller(controller_setup);
    var controller_IN_port_uri = get_port_uri({chip_uri: controller.uri, port_name: controller_IN_port_name});
    var simulate_conn = controller.test.simulate;

    // Make the todo manager plug-in order
    // This wires the todo manager to the controller order port to send new todo item's creation order
    // Note that we don't wire the children to the todo manager as they do not exist yet
    var todo_manager_plug_order = {};
    todo_manager_plug_order[controller_IN_port_uri] = {
      command: COMMAND_PLUG_IN_CIRCUIT,
      parameters: {
        circuit: todo_manager_circuit,
        links: [
          make_link(todo_manager_circuit, controller, TO_CONTROLLER_PORT_NAME, controller_IN_port_name),
        ],
        settings: {
          el: '#app',
          append: true
        }
      }
    };
    // Make the test chip plug-in order
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
    // Plug-in the todo_item circuit
    simulate_conn.onNext(todo_manager_plug_order);
    // Plug-in the test chip
    simulate_conn.onNext(test_order);

    // TODO : I am here
    var test_case = {
      input_seq: [
        // Simulating intent <- [event keypress]* + event enter
        {to: "todo_manager_update_1-|new_todo", input: {description: 'description test value'}},
        // Simulating intent <- event double-click
        {to: "todo_item_update_item1-|edit", input: {editing: true}},
      ],
      expected_output_seq: [
        // NOTE : there is no `notify` message as the notify OUT port is not subscribed to
        {
          "port_uri": "todo_item_circuit_1",
          "readout": {"description": "description test value"},
          "relayed_from": "todo_item_update_1-|update_model"
        },
        //        {
        //          "port_uri": "todo_item_circuit_1",
        //          "readout": {"anything": "does not matter"},
        //          "relayed_from": "todo_item_update_1-|destroy"
        //        }
      ],
      test_success_message: [
        'TODO',
      ].join('\n'),
      output_transform_fn: test_case_output_transform_fn,
      readout_filter: utils.contains_string('circuit'),
      analyze_test_results_fn: analyze_test_results
    };
    // Send test case inputs, the test should then execute
    var test_case_labelled_message = {};
    test_case_labelled_message[get_port_uri({chip_uri: test_chip.uri, port_name: TEST_CASE_PORT_NAME})] = test_case;
    test_chip_simulate_conn.onNext(test_case_labelled_message);

    function test_case_output_transform_fn(output_value) {
      var port_uri = utils.get_label(output_value);
      var from = utils.get_label(utils.remove_label(output_value));
      var readout = utils.remove_label(utils.remove_label(output_value)).readout;
      var transformed_readout;

      if (readout.command === COMMAND_PLUG_IN_CIRCUIT || readout.command === COMMAND_UNPLUG_CIRCUIT) {
        transformed_readout = {
          command: readout.command,
          circuit_uri: readout.parameters.circuit.uri
        }
      }

      return {
        port_uri: port_uri,
        relayed_from: from,
        readout: transformed_readout ? transformed_readout : readout
      };
    }

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
