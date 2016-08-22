// TODO : when separating circuits.js, remember that text.js is necessary to load text dependencies with require.js (it must be in baseurl directory)
// TODO : DOCUMENT : settings must be there in `transform` even if not used as the number of arguments of the function is checked!!
// TODO : use mermaid to draw graph from controller

// DOCUMENTATION :
// !! The readout connector are passing along the values that are emitted by the output ports AS IS without cloning.
// As they are semantically meant to reflect the value of an output at a specific moment in time, the output value should
// be cloned so it remains constant (inprevious to further modification of the output value downstream).
// However this has performance implications (deep cloning at every level of the circuit possibly big objects). So a choice
// is made to not deep-clone or clone any output value.
// The consequence for the user of the library is that whatever value are :
// - immediate and single usage of the output value (same tick, so before any other modification could happen)
// - in specific cases, deep cloning manually when really necessary instead of at the library level
// TODO : documentation : having intents out of the view means that we have to make sure that the selectors exist to compute the intent...
// This renders impossible after-the-fact intents, like conditional views which start invisible, their intent will never be computed (only computed once)
// So either the intents is linked to the view, in view -> intent -> (vm, actions)
// or the intents are IN the view... (view, events) -> intents -> (vm, actions)
// The todo list is an example of that
// {{#(active_tasks + completed_tasks > 0)}}
// <!-- Here, we compare the total number of tasks (`items.length`) with the number of completed tasks (`completedTasks().length`). This calculation happens reactively, so we never need to manually trigger an update. When the `change` event fires on the input, the `toggleAll` event fires on the Ractive instance. -->
// <input id="toggle-all" type="checkbox" on-change="toggleAll"  checked='{{toggle_all_checked}}'>
//   <label for="toggle-all">Mark all as complete</label>
// {{/}}
// #toggle-all does not exist in the beginning, so the intent errors

/**
 * @typedef {String} Name
 * CONTRACT : Name's string must start with a letter i.e. [a-zA-Z] (and miscellaneous letters from other languages' alphabet, but no _ or $)
 */
/**
 * @typedef {String} URI
 * CONTRACT : URI's string must start with a letter i.e. [a-zA-Z] (and miscellaneous letters from other languages' alphabet)
 */
/**
 * @typedef {Number} Identifier
 */
/**
 * @typedef {Name} Port_Name
 */
/**
 * @typedef {*} Settings
 */
/**
 * @typedef {Settings} Chip_Settings
 */
/**
 * @typedef {Object} Chip
 * @property {Name} serie
 * @property {URI} uri
 * - CONTRACT : MUST be unique
 * @property {Ports} ports
 * CONTRACT :
 * - order of Ports.IN/Ports.OUT is meaningful. Ports are connected in order of definition
 * NOTE : an helper function will make it possible to create a chip without having to duplicate `chip_uri` in all ports
 * @property {Transform} transform
 * @property {Chip_Settings} settings
 * @property {Chip_Test} test
 */
/**
 * @typedef {function() : Object<String, Rx.Observable>} Transform
 * - function which takes a variadic number of observables, and whose last argument is the `settings` parameter
 * - returns an object which contains a dictionary whose keys are port names, and whose values are the output observables
 */
/**
 * @typedef {Object} Ports
 * @property {Array<Port_Name>} IN
 * @property {Array<Port_Name>} OUT
 */
/**
 * @typedef {Object} Chip_Test
 * @property {Rx.Subject} simulate
 * @property {Rx.Subject} readout
 */

/**
 * @typedef {URI} Port_URI
 * - made from Port.chip_uri and Port.port_name (helper function provided to do so)
 */
/**
 * @typedef {Object<Port_URI, *>} Port_Labelled_Message
 * Type for messages with only one public key which is the port uri
 * - Contract : only one public enumerable own property
 */

/**
 * @typedef {Rx.Subject} IN_Connector
 */
/**
 * @typedef {Rx.Observable} OUT_Connector
 */
/**
 * @typedef {Object<Port_URI, IN_Connector>} IN_Connector_Dict
 * - dictionary for female connectors (IN subjects will subscribe to the OUT observables)
 * - OUT = transform(IN)
 */
/**
 * @typedef {Object<Port_URI, OUT_Connector>} OUT_Connector_Dict
 * - dictionary for male connectors (IN subjects will subscribe to the OUT observables)
 * - OUT = transform(IN)
 */
/**
 * @typedef {Object} Link
 * @property {IN_Port} IN_port
 * @property {OUT_Port} OUT_port
 */
/**
 * @typedef {Port} IN_Port
 */
/**
 * @typedef {Port} OUT_Port
 */
/**
 * @typedef {Object} Port
 * @property {URI} chip_uri
 * @property {Name} port_name
 */

/**
 * @typedef {Object} Circuit
 * @property {URI} uri
 * - CONTRACT : MUST be unique
 * - NOTE : UNUSED!!
 * @property {Array<Chip>} chips
 * - For instance, [Chip2, Chip1, Chip3]
 * CONTRACT :
 * - chips are connected/wired in array order
 * - However, it should be meaningless to the program as chips are plugged in connectionless
 * @property {Ports_Map} ports_map. Those ports are the interface the circuit exposes to outside.
 * CONTRACT : Each exposed port must correspond to a port of a chip in `chips`
 * NOTE : port order here is insignificant for circuits. Ports are linked to chips, and ports are connected in order of the chips port array
 * NOTE : ports are not wired till a containing circuit requests it
 * @property {Array<Link>} links
 * @property {Chip_Test} test. Same as for the chip
 */
/**
 * @typedef {Object} Ports_Map
 * @property {IN_Ports_Map} IN
 * @property {OUT_Ports_Map} OUT
 */
/**
 * @typedef {Object<String, IN_Port>} IN_Ports_Map
 * - Dictionnary where :
 *   + key is exposed port name
 *   + value is the IN port to map the exposed port to
 */
/**
 * @typedef {Object<String, OUT_Port>} OUT_Ports_Map
 * - Dictionnary where :
 *   + key is exposed port name
 *   + value is the OUT port to map the exposed port to
 */

/**
 * @typedef {Chip} Controller
 */
/**
 * @typedef {Object} Controller_Order
 * @property {String} command
 * @property {Order_Parameters} parameters
 */
/**
 * @typedef {{circuit: Circuit|Chip, links : Array<Link>, settings : Settings}} Order_Parameters
 */

define(function (require) {
  var Rx = require('rx');
  var _ = require('lodash');
  var utils = require('utils');
  var Err = require('custom_errors');
  var constants = require('constants');
  return require_circuits(Rx, _, utils, Err, constants);
});

function require_circuits(Rx, _, utils, Err, constants) {
  var SIMULATE_PORT_NAME = constants.SIMULATE_PORT_NAME;
  var READOUT_PORT_NAME = constants.READOUT_PORT_NAME;
  var COMMAND_PLUG_IN_CIRCUIT = constants.COMMAND_PLUG_IN_CIRCUIT;
  var COMMAND_UNPLUG_CIRCUIT = constants.COMMAND_UNPLUG_CIRCUIT;
  var CIRCUIT_OR_CHIP_TYPE = constants.CIRCUIT_OR_CHIP_TYPE;
  var SETTINGS_OVERRIDE = constants.SETTINGS_OVERRIDE;
  var ARROW_JOIN_STR = constants.ARROW_JOIN_STR;
  var CONTROLLER_CHIP_URI = constants.CONTROLLER_CHIP_URI;
  var TO_CONTROLLER_PORT_NAME = constants.TO_CONTROLLER_PORT_NAME;

  /**
   *
   * @param {Port} port
   * @constructor
   */
  function OUT_Port(port) {
    this.chip_uri = port.chip_uri;
    this.port_name = port.port_name;
  }

  function onNext_or_warn_if_disposed(input) {
    if (this.isDisposed) {
      console.warn('Received input %O for disposed chip/circuit\'s IN connector - Ignoring!', input);
      return;
    }
    return this.$_onNext(input);
  }

  function warn_completed(connector) {
    console.warn('IN_Connector : connector %s received completion notification of one of its source!', connector.uri);
  }

  function dispose_IN_connector(IN_connector) {
    console.warn('IN_Connector : disposing %s connector', IN_connector.uri);
    // Send completion signals for regular observables which are connected to the subject
    IN_connector.$_onCompleted();
    // Propagate disposal to cover also the case when a modified subject is connected to a modified subject (hence normal onCompleted is trapped)
    for (var i = 0, os = IN_connector.observers.slice(), len = os.length; i < len; i++) {
      var o = os[i];
      // o.onCompleted(); // should not have to, already done by $_onCompleted() but costs nothing
      // if observers are also IN_connector (for instance connections IN to IN in case of circuits), dispose them too
      o.$_dispose && o.$_dispose();
    }
    IN_connector.$_dispose && IN_connector.$_dispose();
  };

  /**
   *
   * @constructor
   */
  function Order_History() {
    // TODO : better data structure or reuse a graph library
    this.nodes = [];
    this.edges = [];
    this.history = []; // list of commands (basically add and delete)
  }

  /**
   *
   * @param circuits_state
   * @param {Controller_Order} order
   */
  Order_History.prototype.add = function add_to_order_history(circuits_state, order) {
    // TODO : better implementation, updating directly the circuit data structure to a graph data structure (node, edges)
    // NOTE : missing is the node information from circuits_state
    this.history.push(order);
  };


  function set_simulate_conn(/*-OUT-*/simulate_conn, uri) {
    simulate_conn.uri = uri;
    return simulate_conn;
  }

  function set_readout_conn(/*-OUT-*/readout_conn, uri) {
    readout_conn.uri = uri;
    return readout_conn;
  }

  function controller_transform(order$, settings) {
    var circuits_initial_state = settings;
    return {
      circuits_state$: order$
        .do(utils.rxlog('order'))
        .scan(process_order, circuits_initial_state)
        .catch(function (e) {
          // TODO : error management at the subject level? Think about a structure a la Erlang
          console.error(e);
          return Rx.Observable.throw(e);
        })
    }
  }

  function create_controller(controller) {
    var controller_simulate_conn = get_default_simulate_conn();
    var controller_readout_conn = get_default_readout_conn();
    var controller_settings = {
      IN_connector_hash: new utils.Hashmap(),
      OUT_connector_hash: new utils.Hashmap(),
      disposable_hash: new utils.Hashmap(),
      is_plugged: new utils.Hashmap(),
      order_history: new Order_History()
    };
    var controller_subscribe_fn = controller && controller.settings && controller.settings.controller_subscribe_fn
      || utils.rxlog('controller');

    var _controller = utils.set_custom_type({
      serie: controller.serie || 'controller',
      uri: controller.uri || CONTROLLER_CHIP_URI,
      ports: controller.ports || {
        IN: [TO_CONTROLLER_PORT_NAME],
        OUT: ['circuits_state$']
      },
      transform: controller.transform || controller_transform,
      settings: _.merge({}, controller.settings, controller_settings),
      test: controller.test || {
        simulate: controller_simulate_conn,
        readout: controller_readout_conn
      }
    }, CIRCUIT_OR_CHIP_TYPE);

    // TODO : do a better clone deep here, with test and ports, think about settings (clone it? merge not enough?)

    IN_connector_hash = _controller.settings.IN_connector_hash;
    OUT_connector_hash = _controller.settings.OUT_connector_hash;
    disposable_hash = _controller.settings.disposable_hash;
    is_plugged = _controller.settings.is_plugged;

    plug_in(_controller, _controller.settings, {});
    start(controller, _controller.settings);

    function start(controller, settings) {
      var OUT_port = get_OUT_port_conn(controller, controller.ports.OUT[0], settings);
      OUT_port.subscribe(controller_subscribe_fn);
    }

    return _controller;
  }

  function merge_settings(parent_settings, child_settings) {
    return SETTINGS_OVERRIDE
      ? _.merge({}, parent_settings, child_settings)
      : _.merge({}, child_settings, parent_settings);
  }

  // Get functions
  /**
   * Returns a customized subject which traps the `onCompleted` event.
   * To send `onCompleted` event, it exposes a `dispose` method
   * @param {URI} [uri]
   * @return {Subject}
   */
  function get_new_IN_connector(uri) {
    // TODO: adapt onError in function of error management decided.
    // Note that onError now will prevent additional onNext to pass through, but observers will still be registered on the subject
    var connector = new Rx.Subject();
    connector.uri = uri;
    // Trap dispose handler
    connector.$_dispose = connector.dispose && connector.dispose.bind(connector); // strange name to avoid overwriting existing `dispose` methods
    connector.dispose = dispose_IN_connector.bind(connector, connector);
    // Trap onCompleted handler
    connector.$_onCompleted = connector.onCompleted.bind(connector);
    connector.onCompleted = warn_completed.bind(connector, connector);
    connector.$_onNext = connector.onNext.bind(connector);
    connector.onNext = onNext_or_warn_if_disposed.bind(connector);
    return connector;
  }

  function get_default_IN_conn(uri) {
    return get_new_IN_connector(uri);
    // return new Rx.Subject();
  }

  function get_default_simulate_conn() {
    return new Rx.Subject();
  }

  function get_OUT_port_conn(chip, port_name, circuits_state) {
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    return OUT_connector_hash.get(get_port_uri({
      port_name: port_name,
      chip_uri: chip.uri
    }));
  }

  function get_IN_port_conn(chip, port_name, circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    return IN_connector_hash.get(get_port_uri({
      port_name: port_name,
      chip_uri: chip.uri
    }));
  }

  function get_default_readout_conn(uri) {
    var s = new Rx.ReplaySubject(1);
    s.uri = uri
    return s;
  }

  function get_active_simulate_conn(simulate_conn, uri) {
    return is_simulate_connector_active(simulate_conn)
      ? set_simulate_conn(simulate_conn, uri)
      : get_default_simulate_conn(uri);
  }

  function get_active_readout_conn(readout_conn, uri) {
    return trap(
      is_readout_connector_active(readout_conn)
        ? readout_conn
        : get_default_readout_conn(uri),
      'READOUT', uri);
  }

  function trap(subject, type, uri) {
    // TODO : I could have the trap subject without resorting to modifying the subject - more clean
    var s = {};
    s.onNext = subject.onNext;

    subject.onNext = function onNext_trapped(x) {
      console.log('%s subject %s emitting', type, uri, x);
      s.onNext.call(subject, x);
    };
    return subject;
  }

  /**
   *
   * @param {IN_Port | OUT_Port} port
   */
  function get_port_uri(port) {
    return port ? utils.join(port.chip_uri, port.port_name) : undefined;
  }

  function get_simulate_port_uri(chip_uri) {
    return get_port_uri({chip_uri: chip_uri, port_name: SIMULATE_PORT_NAME});
  }

  function get_port_from_port_uri(port_uri) {
    return port_uri ? utils.disjoin(port_uri) : undefined;
  }

  function get_readout_port(chip, circuits_state) {
    return get_OUT_port_conn(chip, READOUT_PORT_NAME, circuits_state);
  }

  function get_simulate_port(chip, circuits_state) {
    return get_IN_port_conn(chip, SIMULATE_PORT_NAME, circuits_state);
  }

  function get_port_uri_from_port_name(chip_or_circuit) {
    return function get_port_uri_from_port_name(IN_port_name) {
      return get_port_uri({chip_uri: chip_or_circuit.uri, port_name: IN_port_name});
    }
  }

  function get_chip_or_circuit_IN_port_uris(chip_or_circuit) {
    return chip_or_circuit.chips
      // Case Circuit
      ? utils.get_keys(chip_or_circuit.ports_map.IN).map(get_port_uri_from_port_name(chip_or_circuit))
      // Case Chip
      : utils.get_values(chip_or_circuit.ports.IN).map(get_port_uri_from_port_name(chip_or_circuit));
  }

  function get_chip_or_circuit_OUT_port_uris(chip_or_circuit) {
    return chip_or_circuit.chips
      // Case Circuit
      ? utils.get_keys(chip_or_circuit.ports_map.OUT).map(get_port_uri_from_port_name(chip_or_circuit))
      // Case Chip
      : utils.get_values(chip_or_circuit.ports.OUT).map(get_port_uri_from_port_name(chip_or_circuit));
  }

  // Predicates
  function is_in_circuit_IN_ports(chip_or_circuit) {
    return function is_in_circuit_ports(port_labelled_message) {
      var IN_port_uri = utils.get_label(port_labelled_message);
      var chips_port_uris = get_chip_or_circuit_IN_port_uris(chip_or_circuit);
      return chips_port_uris.indexOf(IN_port_uri) > -1
    }
  }

  function is_IN_port_in_circuit_IN_port(chip_or_circuit, IN_port) {
    return get_chip_or_circuit_IN_port_uris(chip_or_circuit).indexOf(get_port_uri(IN_port)) > -1
  }

  function is_OUT_port_in_circuit_OUT_port(chip_or_circuit, OUT_port) {
    return get_chip_or_circuit_OUT_port_uris(chip_or_circuit).indexOf(get_port_uri(OUT_port)) > -1
  }

  function is_registered_IN_port(IN_connector_hash, IN_port) {
    return IN_connector_hash.has(get_port_uri(IN_port));
  }

  function is_registered_OUT_port(OUT_connector_hash, OUT_port) {
    return OUT_connector_hash.has(get_port_uri(OUT_port));
  }

  function is_chip(circuit_or_chip) {
    return !circuit_or_chip.chips;
  }

  function is_simulate_connector_active(simulate_connector) {
    return simulate_connector && !(simulate_connector.isStopped || simulate_connector.isDisposed);
  }

  function is_readout_connector_active(readout_connector) {
    return readout_connector && !(readout_connector.isStopped || readout_connector.isDisposed);
  }

  // Contract checking
  function assert_links_contract(circuits_state, circuit, links) {
    // 0. links can be empty or undefined
    // 1. links is an array of Link
    // 2. NO : link MUST be existing in the connector register -> Some links could be created after the execution of this function
    // 3. At least one end of link MUST correspond to an end of the circuit
    //    i.e. the link must connect to, or from the circuit

    // 0.
    if (utils.is_undefined(links)) return;
    // 1.a.
    if (!utils.is_array(links)) throw 'assert_links_contract : links must be an array!'
    // 3.
    // var IN_connector_hash = circuits_state.IN_connector_hash;
    // var OUT_connector_hash = circuits_state.OUT_connector_hash;
    var fulfilled = links.every(function (link) {
      var IN_port = link.IN_port;
      var OUT_port = link.OUT_port;
      return is_IN_port_in_circuit_IN_port(circuit, IN_port) || is_OUT_port_in_circuit_OUT_port(circuit, OUT_port);
    });

    if (!fulfilled) throw Err.Circuit_Error({
      message: 'assert_links_contract : links must be connecting to a circuit\'s port',
      extended_info: {circuit: circuit, links: links}
    });

    return fulfilled;
  }

  function assert_order_contracts(circuits_state, order) {
    // Order must be an object...
    if (!order) throw 'assert_order_contracts : order must be a well-formed object!'

    // ... with a mandatory command property which is among the known commands...
    var order_command = get_order_command(order);
    if ([COMMAND_PLUG_IN_CIRCUIT, COMMAND_UNPLUG_CIRCUIT].indexOf(order_command) === -1)
      throw 'assert_order_contracts : unknown order_command !';

    var order_parameters = order.parameters;
    if (!order_parameters) throw 'assert_order_contracts : order_parameters must be an object!'

    var circuit = order_parameters.circuit; // Note : could also be a chip
    if (!circuit) throw 'assert_order_contracts : order_parameters.circuit must be an object!'
    utils.assert_type(circuit, CIRCUIT_OR_CHIP_TYPE, {
      message: 'assert_order_contracts : expected parameter of type circuit!',
      extended_info: {circuit: circuit}
    });

    var links = order_parameters.links;
    assert_links_contract(circuits_state, circuit, links);

    var is_plugged = circuits_state.is_plugged;
    // Specific contracts for plug command
    // 0. check that the circuit to plug is not active
    if (order_command === COMMAND_PLUG_IN_CIRCUIT) {
      // 0.
      if (is_plugged.get(circuit.uri)) throw Err.Circuit_Error({
        message: 'Plug-in order can be only refer to previously unplugged and/or not currently plugged in chips/circuits!',
        extended_info: {
          where: 'connect_mapped_circuit_OUT_ports',
          is_plugged: is_plugged,
          circuit: circuit
        }
      })
    }
    // Specific contract for unplug command
    // 0. Check that the circuit to unplug is plugged
    if (order_command === COMMAND_UNPLUG_CIRCUIT) {
      if (!is_plugged.get(circuit.uri)) throw Err.Circuit_Error({
        message: 'Unplug order can be only refer to previously and currently plugged-in chips/circuits!',
        extended_info: {
          where: 'connect_mapped_circuit_OUT_ports',
          is_plugged: is_plugged,
          circuit: circuit
        }
      });
    }

    // NOTE : no contracts for now on `settings`
  }

  function assert_circuit_contracts(circuit, circuits_state) {
    // Circuit must be defined
    if (!circuit) throw Err.Circuit_Error({
      message: 'Attempted to plug-in ill-defined or undefined circuit!',
      extended_info: {
        where: 'assert_circuit_contracts',
        circuit: circuit,
        circuits_state: circuits_state
      }
    });

    // Circuit must be a circuit, i.e. have children chips/circuits...
    var circuit_chips = circuit.chips;
    if (!circuit_chips) throw Err.Circuit_Error({
      message: 'Attempted to plug-in ill-defined or undefined circuit : no `chips` property found!',
      extended_info: {
        where: 'assert_circuit_contracts',
        circuit: circuit,
        chips: circuit_chips,
        circuits_state: circuits_state
      }
    });
    // ... which are gathered in an array
    if (!utils.is_array(circuit_chips)) throw Err.Circuit_Error({
      message: 'Attempted to plug-in ill-defined or undefined circuit : `chips` property must be an array!',
      extended_info: {
        where: 'assert_circuit_contracts',
        circuit: circuit,
        chips: circuit_chips
      }
    });

    // port mapping is optional : circuits need not have ports
    var circuit_ports_map = circuit.ports_map || {}; // allowed to be undefined for circuits

    // port mapping must be to a string which is the name of the port
    var circuit_ports_map_IN = circuit_ports_map.IN;
    _.forEach(circuit_ports_map_IN, function assert_mapped_port_contracts(port, port_name) {
      assert_port_contracts(port, circuits_state);
    });

    var circuit_ports_map_OUT = circuit_ports_map.OUT;
    _.forEach(circuit_ports_map_OUT, function assert_contracts(__, port_name) {
      if (!utils.is_string(port_name)) throw Err.Circuit_Error({
        message: 'Attempted to plug-in ill-defined or undefined circuit : ports mapping must be a string!',
        extended_info: {
          where: 'assert_circuit_contracts',
          circuit: circuit,
          circuit_ports_map_OUT: circuit_ports_map_OUT,
          circuits_state: circuits_state
        }
      });
    });

    var circuit_links = circuit.links || [];
    circuit_links.forEach(function connect_link(link) {
      assert_link_contracts(link, circuits_state);
    });

  }

  function assert_chip_contracts(chip) {
    // Chip must be defined
    if (!chip) throw Err.Circuit_Error({
      message: 'Attempted to define or use ill-defined or undefined chip!',
      extended_info: {
        where: 'assert_chip_contracts',
        chip: chip
      }
    });

    // ports must exist
    var ports = chip.ports;
    if (!ports) throw Err.Circuit_Error({
      message: 'Attempted to define or use ill-defined or undefined chip! `ports` property must be defined!',
      extended_info: {
        where: 'assert_chip_contracts',
        chip: chip
      }
    });

    // ports.IN must be an array
    var IN_ports = ports.IN;
    if (!utils.is_array(IN_ports)) throw Err.Circuit_Error({
      message: 'Attempted to plug-in ill-defined or undefined circuit : `ports.IN` property must be an array!',
      extended_info: {
        where: 'assert_circuit_contracts',
        chip: chip,
        IN_ports: chip.ports.IN
      }
    });

    // ports.OUT must be an array
    var OUT_ports = ports.OUT;
    if (!utils.is_array(OUT_ports)) throw Err.Circuit_Error({
      message: 'Attempted to plug-in ill-defined or undefined circuit : `ports.OUT` property must be an array!',
      extended_info: {
        where: 'assert_circuit_contracts',
        chip: chip,
        OUT_ports: chip.ports.OUT
      }
    });

    // transform must exist and be a function
    var transform = chip.transform;
    if (!transform || !utils.is_function(transform)) throw Err.Circuit_Error({
      message: 'Attempted to define or use ill-defined or undefined chip! `transform` property must be defined and be a function!',
      extended_info: {
        where: 'assert_chip_contracts',
        transform: transform
      }
    });

  }

  function assert_link_contracts(link, circuits_state) {
    var IN_port = link.IN_port;
    var OUT_port = link.OUT_port;
    assert_port_contracts(IN_port, circuits_state);
    assert_port_contracts(OUT_port, circuits_state);
  }

  function assert_port_contracts(port, circuits_state) {
    if (!port) throw Err.Circuit_Error({
      message: 'Encountered undefined port!',
      extended_info: {where: 'assert_port_contracts', port: port, circuits_state: circuits_state}
    });

    var uri = port.chip_uri;
    var name = port.port_name;
    if (!(utils.is_string(uri) && utils.is_string(name))) throw Err.Circuit_Error({
      message: 'Encountered ill-formed port! uri and name must be strings!',
      extended_info: {where: 'assert_port_contracts', port: port, circuits_state: circuits_state}
    });
  }

  function assert_transform_contracts(transform_fn, output, chip) {
    var out_port_names = chip.ports.OUT;
    var in_port_names = chip.ports.IN;
    var output_port_names = output ? Object.keys(output) : [];
    var transform_args_num = transform_fn.length;

    // The transform function must have been defined with all the configured out ports in parameter
    if (transform_args_num - 1 !== in_port_names.length) throw Err.Circuit_Error({
      message: 'transform function must be called with ALL the OUT port names plus `settings`! Mismatch in number of arguments',
      extended_info: {
        configured_in_ports: in_port_names,
        transform_args_num_minus_settings: transform_args_num - 1,
        fn_name: transform_fn.name
      }
    });

    // Output must only have keys configured in the chip as out ports
    var is_output_only_with_configured_ports = output_port_names.every(function (output_port_name) {
      return out_port_names.indexOf(output_port_name) > -1;
    });
    if (!is_output_only_with_configured_ports) throw Err.Circuit_Error({
      message: 'transform function returned OUT port which is not configured in chip definition!',
      extended_info: {transform_out_ports: output_port_names, configured_out_ports: out_port_names, fn_name: transform_fn.name }
    });
    // All configured out ports must be in the transform's output
    var is_all_configured_ports_in_output = out_port_names.every(function (out_port_name) {return output_port_names.indexOf(out_port_name) > -1;});
    if (!is_all_configured_ports_in_output) throw Err.Circuit_Error({
      message: 'transform function returned OUT port which is not configured in chip definition!',
      extended_info: {transform_out_ports: output_port_names, configured_out_ports: out_port_names}
    });
  }

  // Registry updating functions
  /**
   *
   * @param ports
   * @param chip
   * @param circuits_state
   * Side-effects : modify `circuits_state`
   */
  function register_IN_ports(ports, chip, /*-OUT-*/circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    ports.IN.forEach(function create_IN_connectors(port_name) {
      var port_uri = get_port_uri({chip_uri: chip.uri, port_name: port_name});
      var connector = get_default_IN_conn(port_uri);
      if (get_IN_port_conn(chip, port_name, circuits_state)) throw Err.Circuit_Error({
        message: 'There already exists a port with the same identifier!',
        extended_info: {where: 'register_IN_ports', port_uri: port_uri, IN_connector_hash: IN_connector_hash}
      });
      register_IN_conn(chip, port_name, connector, circuits_state);
    });
  }

  function register_IN_conn(chip, port_name, connector, /*-OUT-*/circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    IN_connector_hash.set(get_port_uri({chip_uri: chip.uri, port_name: port_name}), connector);
  }

  function register_OUT_conn(chip, port_name, connector, /*-OUT-*/circuits_state) {
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    OUT_connector_hash.set(get_port_uri({chip_uri: chip.uri, port_name: port_name}), connector);
  }

  function register_readout_conn(chip, connector, /*-OUT-*/circuits_state) {
    register_OUT_conn(chip, READOUT_PORT_NAME, connector, circuits_state);
  }

  function register_simulate_conn(chip, connector, /*-OUT-*/circuits_state) {
    register_IN_conn(chip, SIMULATE_PORT_NAME, connector, circuits_state);
  }

  /**
   *
   * @param {Ports_Map} ports_map
   * @param circuit
   * @param circuits_state
   * Side-effects : modifies `circuits_state`
   * @throws : if uri is not unique (exists already)
   */
  function register_circuit_IN_ports(ports_map, circuit, /*-OUT-*/circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    var uri = circuit.uri;
    _.forEach(ports_map.IN, function create_IN_connectors(__, port_name) {
      var port_uri = get_port_uri({chip_uri: uri, port_name: port_name});
      var connector = get_default_IN_conn(port_uri);
      if (IN_connector_hash.has(port_uri)) throw Err.Circuit_Error({
        message: 'There already exists a port with the same identifier!',
        extended_info: {where: 'register_circuit_IN_ports', port_uri: port_uri, IN_connector_hash: IN_connector_hash}
      });
      register_IN_conn(circuit, port_name, connector, circuits_state);
    });
  }

  /**
   * The message is labelled with the circuit's label and will be relabelled to the lower chip/circuit's label
   * @param {Circuit} circuit
   * @returns {function (Port_Labelled_Message) : Port_Labelled_Message}
   */
  function translate_circuit_IN_port_uri(circuit, IN_connector_hash) {
    var ports_map = circuit.ports_map;

    return function translate_circuit_IN_port_uri(port_labelled_message) {
      var IN_port_uri = utils.get_label(port_labelled_message);
      // Contract checking
      // 1. The message is labelled...
      if (utils.is_undefined(IN_port_uri)) throw Err.Invalid_Type_Error({
        message: 'Messages sent to circuit input ports must be labelled with the mapped lower-level circuit/chip port!',
        extended_info: {where: 'translate_circuit_IN_port_uri', port_labelled_message: port_labelled_message}
      });

      // 2. ... with a well-formed port_uri...
      /**@type {IN_Port}*/
      var circuit_IN_port = get_port_from_port_uri(IN_port_uri);
      if (utils.is_undefined(circuit_IN_port)) throw Err.Invalid_Type_Error({
        message: 'Undefined circuit IN port!',
        extended_info: {
          where: 'translate_circuit_IN_port_uri',
          port_labelled_message: port_labelled_message,
          IN_port_uri: IN_port_uri
        }
      });

      var circuit_uri = circuit_IN_port.chip_uri;
      if (circuit_uri !== circuit.uri) throw Err.Invalid_Type_Error({
        message: 'Message is not addressed to this circuit!!',
        extended_info: {
          where: 'translate_circuit_IN_port_uri',
          port_labelled_message: port_labelled_message,
          circuit_uri: circuit.uri,
          uri: circuit_uri
        }
      });

      var circuit_IN_port_name = circuit_IN_port.port_name;
      if (!circuit_IN_port_name) throw Err.Invalid_Type_Error({
        message: 'Invalid circuit IN port name!',
        extended_info: {
          where: 'translate_circuit_IN_port_uri',
          port_labelled_message: port_labelled_message,
          IN_port_uri: IN_port_uri,
          circuit_IN_port_name: circuit_IN_port_name
        }
      });

      // 3. ... for which a mapping is defined in the circuit's `ports_map` property...
      // NOTE : this is necessarily a circuit and not a chip
      var translated_IN_port = ports_map.IN[circuit_IN_port_name];
      if (!translated_IN_port) throw Err.Circuit_Error({
        message: 'Encountered message labelled with a port uri which does not correspond to a registered port in the corresponding circuit!',
        extended_info: {
          where: 'translate_circuit_IN_port_uri',
          port_labelled_message: port_labelled_message,
          IN_port_uri: IN_port_uri,
          circuit_IN_port_name: circuit_IN_port_name,
          circuit_IN: ports_map.IN
        }
      });

      // 4. ... mapping which corresponds to a circuit's lower-level chip/circuit's existing IN port
      var translated_IN_port_uri = get_port_uri(translated_IN_port);
      // Translate message
      var translated_message = {};
      translated_message[translated_IN_port_uri] = utils.remove_label(port_labelled_message);

      var is_in_circuits_ports_uri = circuit.chips.some(function to_port_names(chip_or_circuit) {
        return is_in_circuit_IN_ports(chip_or_circuit)(translated_message);
      });

      if (!is_in_circuits_ports_uri) throw Err.Circuit_Error({
        message: 'Circuit port mapping for port-labelled message does not correspond to a registered port in lower-level circuit/chips!',
        extended_info: {
          where: 'translate_circuit_IN_port_uri',
          port_labelled_message: port_labelled_message,
          IN_port_uri: IN_port_uri,
          translated_IN_port_uri: translated_IN_port_uri,
          children: circuit.chips
        }
      });

      return translated_message;
    }
  }

  /**
   * Readout connectors are receiving port-labelled values from lower-level chip/circuits.
   * If the readout's circuit has a port mapping defined, then the labelled value is relabelled accordingly.
   * @param {Circuit} circuit
   * @param {Ports_Map} ports_map
   * @returns {function (Port_Labelled_Message) : Port_Labelled_Message}
   */
  function translate_circuit_OUT_port_uri(circuit, ports_map) {
    ports_map = ports_map || {};
    return function translate_circuit_OUT_port_uri(port_labelled_message) {
      // NOTE : the good thing about the OUT ports is that they are generated by the program
      // hence the contract/type checking is already done by the compiler/IDE, so no special work to do here
      var OUT_port_uri = utils.get_label(port_labelled_message);
      var matching_circuit_OUT_port_name = undefined;

      // Look up for a mapped port corresponding to the labelled message
      var match = _.some(ports_map.OUT, function find_matching_circuit_OUT_port(mapped_OUT_port, circuit_OUT_port_name) {
        var mapped_OUT_port_uri = get_port_uri(mapped_OUT_port);
        matching_circuit_OUT_port_name = circuit_OUT_port_name;
        return OUT_port_uri === mapped_OUT_port_uri
      });

      var translated_OUT_port_uri = match
        ? get_port_uri({chip_uri: circuit.uri, port_name: matching_circuit_OUT_port_name})
        : OUT_port_uri;
      var translated_message = {};
      var readout = port_labelled_message[OUT_port_uri].readout;
      translated_message[translated_OUT_port_uri] = {
        timestamp: new Date(),
        readout: readout
      };
      return translated_message;
    }
  }

  /**
   *
   * @param {Rx.Subject} connector
   * @returns {Function}
   * @param {OUT_Port} port
   * Side-effects : None. But the returned function sends a message labelled with the port uri on the connector
   */
  function tap(connector, port) {
    return function tap(readout) {
      var port_uri = get_port_uri(port);
      var timestamp = new Date();
      var labelled_message = {};
      labelled_message[port_uri] = {
        timestamp: timestamp,
        readout: readout
      };
      console.info('sending labelled message', port_uri, labelled_message);
      connector.onNext(labelled_message);
    }
  }

  /**
   *
   * @param {Ports_Map} circuit_ports_map
   * @param circuits_state
   * @param circuit
   * Side-effects : subscribes exposed circuit IN connectors to mapped inner chip/circuits IN connector
   */
  function connect_mapped_circuit_IN_ports(circuit_ports_map, circuit, circuits_state) {
    circuit_ports_map = circuit_ports_map || {};
    var IN_connector_hash = circuits_state.IN_connector_hash;
    var disposable_hash = circuits_state.disposable_hash;
    _.forEach(circuit_ports_map.IN || {}, function connect_mapped_circuit_IN_ports(target_IN_port, circuit_IN_port_name) {
      var circuit_IN_connector = get_IN_port_conn(circuit, circuit_IN_port_name, circuits_state);
      var mapped_IN_connector = IN_connector_hash.get(get_port_uri(target_IN_port));
      disposable_hash.set(utils.join(get_port_uri({
          chip_uri: circuit.uri,
          port_name: circuit_IN_port_name
        }), get_port_uri(target_IN_port), ARROW_JOIN_STR),
        circuit_IN_connector.subscribe(mapped_IN_connector));
    });
  }

  /**
   *
   * @param {Ports_Map} ports_map
   * @param circuit
   * @param circuits_state
   */
  function connect_mapped_circuit_OUT_ports(ports_map, circuit, /*-OUT-*/circuits_state) {
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    var circuit_uri = circuit.uri;
    var circuit_readout_conn = OUT_connector_hash.get(get_port_uri({
      chip_uri: circuit_uri,
      port_name: READOUT_PORT_NAME
    }));

    _.forEach(ports_map.OUT, function create_OUT_connectors(mapped_port, circuit_port_name) {
      /**@type {Port}*/
      var port = new OUT_Port({chip_uri: circuit_uri, port_name: circuit_port_name});
      var port_uri = get_port_uri(port);
      var mapped_port_OUT_connector = OUT_connector_hash.get(get_port_uri(mapped_port));
      // !!! single instance is used here as we want to :
      // - unsubscribe to the source if there is no observers/subscribers (i.e. refCount behaviour)
      // - BUT resubscribe to the source if there again another observer
      // TODO : add materialize and dematerialize to have it logged in the subject
      var OUT_port$ = mapped_port_OUT_connector.do(tap(circuit_readout_conn, port)).singleInstance();

      if (OUT_connector_hash.get(port_uri)) throw Err.Circuit_Error({
        message: 'There already exists a port with the same identifier!',
        extended_info: {
          where: 'connect_mapped_circuit_OUT_ports',
          port_uri: port_uri,
          OUT_connector_hash: OUT_connector_hash
        }
      });
      OUT_connector_hash.set(port_uri, OUT_port$);
    });
  }

  /**
   *
   * @param {Array<Link>} links
   * @param {{IN_connector_hash : IN_Connector_Dict, OUT_connector_hash : OUT_Connector_Dict, disposable_hash: disposable_hash}} circuits_state
   * Side-effects : connects OUT connectors of one chip/circuit to mapped IN connector of another chip/circuit
   */
  function connect_links(links, circuits_state) {
    // 2. Wire links
    // - get IN_port, OUT_port from link
    // - get IN subject connector and OUT observable connector associated to link (from IN_Connector_Dict and OUT_Connector_Dict )
    //   + connector <- hashmap.get(IN_port)
    // - subscribe connector IN to connector OUT
    var IN_connector_hash = circuits_state.IN_connector_hash;
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    var disposable_hash = circuits_state.disposable_hash;

    links = links || []; // links is allowed to be undefined or empty
    links.forEach(function connect_link(link) {
      var IN_port = link.IN_port;
      var OUT_port = link.OUT_port;
      var IN_port_uri = get_port_uri(IN_port);
      var OUT_port_uri = get_port_uri(OUT_port);

      var IN_connector = IN_connector_hash.get(IN_port_uri);
      if (!IN_connector) throw Err.Circuit_Error({
        message: 'Invalid link configured! Cannot find a registered connector register for IN port!',
        extended_info: {where: 'connect_links', IN_port: IN_port, IN_connector_hash: IN_connector_hash}
      });

      var OUT_connector = OUT_connector_hash.get(OUT_port_uri);
      if (!OUT_connector) throw Err.Circuit_Error({
        message: 'Invalid link configured! Cannot find a registered connector register for OUT port!',
        extended_info: {where: 'connect_links', OUT_port: OUT_port, OUT_connector_hash: OUT_connector_hash}
      });

      disposable_hash.set(
        utils.join(OUT_port_uri, IN_port_uri, ARROW_JOIN_STR),
        OUT_connector.subscribe(IN_connector)
      );
    });
  }

  function disconnect_links(links, circuits_state) {
    if (!links) return;
    // disconnect the links in reverse connection order, and without modifying the input `links` parameter
    links.slice().reverse().forEach(function disconnect_link(link) {
      var disposable_hash = circuits_state.disposable_hash;
      var IN_port = link.IN_port;
      var OUT_port = link.OUT_port;
      var IN_port_uri = get_port_uri(IN_port);
      var OUT_port_uri = get_port_uri(OUT_port);
      var disposable_uri = utils.join(OUT_port_uri, IN_port_uri, ARROW_JOIN_STR);
      disposable_hash.get(disposable_uri).dispose();
      disposable_hash.remove(disposable_uri);
    });
  }

  /**
   *
   * @param {Circuit|Chip} circuit
   * @param {{IN_connector_hash, OUT_connector_hash, disposable_hash, is_plugged}} circuits_state
   * @param parent_settings
   * Side-effects : modifies `circuits_state` hashmaps
   */
  function plug_in(circuit, /*-OUT-*/circuits_state, parent_settings) {
    // TODO : parent_settings and chip_settings should be deep cloned or frozen to prevent impact from out of scope modification
    //        We leave it as is, the best solution to this, is to make all circuits a `constant` (ES6) or deep-frozen objects
    //        This problem is everywhere at the API surface.
    //        We will deep-clone only when there is an estimated high likelyhood or impact of changes
    var is_plugged = circuits_state.is_plugged;
    is_chip(circuit)
      ? plug_in_chip(circuit, /*-OUT-*/circuits_state, parent_settings)
      : plug_in_circuit(circuit, /*-OUT-*/circuits_state, parent_settings)
    ;
    is_plugged.set(circuit.uri, true);
  }

  function unplug(circuit, /*-OUT-*/circuits_state, parent_settings) {
    var is_plugged = circuits_state.is_plugged;
    is_chip(circuit)
      ? unplug_chip(circuit, /*-OUT-*/circuits_state, parent_settings)
      : unplug_circuit(circuit, /*-OUT-*/circuits_state, parent_settings)
    ;
    is_plugged.set(circuit.uri, false);
  }

  function unplug_circuit(circuit, /*-OUT-*/circuits_state, parent_settings) {
    // TODO : add error handling for malformed arguments like in the plug_circuit or check it is tested prior in the process order
    var IN_connector_hash = circuits_state.IN_connector_hash;
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    var disposable_hash = circuits_state.disposable_hash;
    var circuit_ports_map = circuit.ports_map;
    var circuit_links = circuit.links;
    var circuit_uri = circuit.uri;
    var circuit_chips = circuit.chips;
    var circuit_settings = merge_settings(parent_settings, circuit.settings);

    // 1. Dispose all subscription to the circuit's simulate connector...
    var circuit_simulate_port_uri = get_port_uri({chip_uri: circuit_uri, port_name: SIMULATE_PORT_NAME});
    circuit_chips.slice().reverse().forEach(function disconnect_circuit_simulate_to_chips(chip) {
      var simulate_disposable_uri = utils.join(circuit_simulate_port_uri, chip.uri, ARROW_JOIN_STR);
      disposable_hash.get(simulate_disposable_uri).dispose();
      disposable_hash.remove(simulate_disposable_uri);
    });
    // ... and also dispose the connector itself and remove it from the hashmap
    var circuit_simulate_conn = IN_connector_hash.get(circuit_simulate_port_uri);
    circuit_simulate_conn.onCompleted();
    circuit_simulate_conn.dispose();
    IN_connector_hash.remove(circuit_simulate_port_uri);

    // 2. Unwire links
    disconnect_links(circuit_links, circuits_state);

    // 3. Unregister circuit's OUT ports
    // In fact there is nothing more to do, they are observables, they will complete naturally when their inputs complete
    _.forEachRight(circuit_ports_map.OUT, function create_OUT_connectors(mapped_port, circuit_port_name) {
      OUT_connector_hash.remove(get_port_uri({chip_uri: circuit_uri, port_name: circuit_port_name}));
    });

    // 4. Disconnect and unregister readout connector
    var circuit_readout_port_uri = get_port_uri({chip_uri: circuit_uri, port_name: READOUT_PORT_NAME});
    OUT_connector_hash.get(circuit_readout_port_uri).onCompleted();
    circuit_chips.slice().reverse().forEach(function disconnect_circuit_readout_to_chips(chip) {
      var readout_port_uri = get_port_uri({chip_uri: chip.uri, port_name: READOUT_PORT_NAME});
      disposable_hash.get(utils.join(readout_port_uri, circuit_readout_port_uri, ARROW_JOIN_STR))
        .dispose();
    });
    OUT_connector_hash.remove(circuit_readout_port_uri);

    // 5. Disconnect chip's IN ports from circuit's IN ports from
    _.forEachRight(circuit_ports_map.IN || {}, function disconnect_mapped_circuit_IN_ports(target_IN_port, circuit_IN_port_name) {
      var circuit_IN_port_uri = get_port_uri({chip_uri: circuit.uri, port_name: circuit_IN_port_name});
      var mapped_IN_port_uri = get_port_uri(target_IN_port);
      disposable_hash
        .get(utils.join(circuit_IN_port_uri, mapped_IN_port_uri, ARROW_JOIN_STR))
        .dispose();
    });

    // 6. Unregister circuit's IN PORT
    _.forEachRight(circuit_ports_map.IN, function remove_IN_connectors(__, port_name) {
      IN_connector_hash.remove(get_port_uri({chip_uri: circuit_uri, port_name: port_name}));
    });

    // 7. Disconnect children chips/circuits
    circuit_chips.slice().reverse().forEach(function (chip) {
      unplug(chip, circuits_state, circuit_settings);
    });

  }

  function unplug_chip(chip, /*-OUT-*/circuits_state, parent_settings) {
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    var IN_connector_hash = circuits_state.IN_connector_hash;
    var uri = chip.uri;
    var chip_ports = chip.ports;
    var chip_settings = chip.settings;
    var merged_settings = merge_settings(parent_settings, chip_settings);
    var dispose_fn = chip.dispose;

    // 1. unregister OUT_ports (THOSE OBSERVEABLES SHOULD BE COMPLETED BY COMPLETING THEIR SOURCE!)
    chip_ports.OUT.slice().reverse().forEach(function create_OUT_connectors(port_name) {
      OUT_connector_hash.remove(get_port_uri({chip_uri: chip.uri, port_name: port_name}));
    });

    // 2. Dispose and unregister readout connectors
    var readout_port_uri = get_port_uri({chip_uri: chip.uri, port_name: READOUT_PORT_NAME});
    var OUT_connector = OUT_connector_hash.get(readout_port_uri);
    OUT_connector.onCompleted();
    OUT_connector.dispose();
    OUT_connector_hash.remove(readout_port_uri);

    //  3. Call the chip's dispose function to undo side-effects or else
    //  3.1 Merge settings from the parent with the chip's settings
    dispose_fn && dispose_fn(merged_settings);
    // TODO : should catch error in dispose function
    // TODO : what to do if an error happens in the middle of unplugging???

    // 4. Unregister simulate connector and complete outputs by completing inputs
    var simulate_port_uri = get_port_uri({chip_uri: chip.uri, port_name: SIMULATE_PORT_NAME});
    IN_connector_hash.get(simulate_port_uri).onCompleted();
    chip_ports.IN.forEach(function remove_merged_connectors(port_name) {
      var port_uri = get_port_uri({chip_uri: uri, port_name: port_name});
      IN_connector_hash.get(port_uri).onCompleted();
    });
    // At this point, the output observables should be completed.
    // So we can proceed with disposing the subject and removing references from the hashmap
    chip_ports.IN.forEach(function dispose_IN_connectors(port_name) {
      var port_uri = get_port_uri({chip_uri: uri, port_name: port_name});
      IN_connector_hash.get(port_uri).dispose();
      IN_connector_hash.remove(port_uri);
    });
    IN_connector_hash.remove(simulate_port_uri);

  }

  function plug_in_chip(chip, /*-OUT-*/circuits_state, parent_settings) {
    var uri = chip.uri;
    var chip_ports = chip.ports;
    var chip_settings = chip.settings;
    var chip_transform = chip.transform;
    var test = chip.test = chip.test || {}; // optional
    var simulate_conn = test.simulate;
    var readout_conn = test.readout;

    // Case chip : (`chips` is undefined)
    // 1. Create and register IN_ports connectors
    register_IN_ports(chip_ports, chip, circuits_state);

    // 2. Register simulate connector
    // If there is no simulate connector, we create one.
    // We need one, so that if we have a simulate connector at a higher level (enclosing chip),
    // that upper-level simulate connector can connect to the lower-level connector to send data
    // This done recursively in every level ensures an ininterrupted connector chain ending at the chip level.
    // Hence, the simulate connector at the chip level can forward data down to any other level.
    // The default connector is an Rx.Subject extended with a uri field for traceability purposes.
    // We should not need a replay functionality here as :
    // - the simulate connector is used by construction once all lower-level circuits are plugged
    // - there should only ever be one user/caller of a simulate connector (i.e. no concurrent simulations)
    // Note : if the `simulate` property is not defined, or the connector passed is inactive, we create a new one
    simulate_conn = get_active_simulate_conn(simulate_conn, chip.uri);
    register_simulate_conn(chip, simulate_conn, circuits_state);

    // 3. Add simulate functionality
    // This means passing simulate connector's input to each port, after filtering out input destined to other ports
    // NOTE : SIMULATE connectors do not send error notification if one sends messages relevant to no ports
    // NOTE : this is shared as the transform function could subscribe several times to the IN ports
    var merged_connectors = chip_ports.IN.map(function create_merged_connectors(port_name) {
      var port_uri = get_port_uri({chip_uri: uri, port_name: port_name});
      return Rx.Observable.merge(
        get_IN_port_conn(chip, port_name, circuits_state)
          .do(utils.rxlog('IN connector hash ' + port_uri)),
        simulate_conn
          .ensure(is_in_circuit_IN_ports(chip))
          .filter(utils.is_label(port_uri))
          .do(utils.rxlog('pre-filter simulated inputs sent to : ' + port_uri))
          .map(utils.remove_label)
          .doOnCompleted(utils.rxlog('simulate_conn (' + simulate_conn.uri + ') completed'))
      )
        .singleInstance()
        .doOnCompleted(utils.rxlog('merged connectors completed'));
    });

    //  4. Call the chip's transform function to process ports' inputs into outputs
    //  Edge case : there is no IN connector : `transform` in that case is called with [], that's fine
    if (!utils.is_function(chip_transform)) throw '`chip_transform` property is not a function!';
    //  4.1 Merge settings from the parent with the chip's settings
    //      - If SETTINGS_OVERRIDE config flag not set : parent_settings can add properties to chip's settings but not replace/modify them
    //      - Else : parent_settings will override properties with same name in chip's settings

    var merged_settings = merge_settings(parent_settings, chip_settings);
    merged_connectors.push(merged_settings);
    // TODO : add error management for when transform function returns error
    var output = chip_transform.apply(null, merged_connectors);
    assert_transform_contracts(chip_transform, output, chip);

    // Create and register readout connectors
    readout_conn = get_active_readout_conn(readout_conn, uri);
    register_readout_conn(chip, readout_conn, circuits_state);

    // 5. Create and register OUT_ports
    // If there is no readout connector, we create one.
    // We need one, so that if we have a readout connector at a higher level (enclosing chip),
    // that upper-level readout connector can connect to the lower-level connector to receive data
    // This done recursively in every level ensures an ininterrupted connector chain ending at the chip level.
    // Hence, the readout connector at the chip level can forward data up to any other level.
    // Default readout connector is a Rx.ReplaySubject(1) as while we are pluging in circuits and connecting
    // wires, data may be emitted before the readout connector to receive them.
    // In principle a replay(1) is sufficient. All pluging-in and wiring should happen in the same tick.
    chip_ports.OUT.forEach(function create_OUT_connectors(port_name) {
      var port = new OUT_Port({chip_uri: uri, port_name: port_name});
      var connector = output[port_name];

      // Checking contracts
      if (utils.is_undefined(connector)) throw Err.Circuit_Error({
        message: 'Could not find definition for declared port!',
        extended_info: {port_name: port_name, port_definitions: output}
      });
      if (!utils.has_type(connector, 'Observable')) throw Err.Circuit_Error({
        message: 'Port definition must be an observable!',
        extended_info: {port_name: port_name, port_definitions: output}
      });

      // OUT connector must be shared as it can have several IN ports subscribing to it
      // share is AFTER the readout side-effect, not to repeat it several times
      // and in fact it is `singleInstance` which is used as we want to reconnect seamlessly in the case of
      // having subcribers, then no subscribers, and then again new subscribers.
      var OUT_port$ = connector.do(tap(readout_conn, port)).singleInstance();
      register_OUT_conn(chip, port_name, OUT_port$, circuits_state);
    });
  }

  function plug_in_circuit(circuit, /*-OUT-*/circuits_state, parent_settings) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    var disposable_hash = circuits_state.disposable_hash;
    var uri = circuit.uri;
    var circuit_chips = circuit.chips;
    var circuit_ports_map = circuit.ports_map;
    var circuit_links = circuit.links;
    var circuit_settings = merge_settings(parent_settings, circuit.settings);
    var test = circuit.test = circuit.test || {}; // optional
    var simulate_conn = test.simulate;
    var readout_conn = test.readout;

    assert_circuit_contracts(circuit, circuits_state);

    // Case circuit :
    // 1. Plug-in each child chip/circuit in order of definition
    circuit_ports_map = circuit_ports_map || {}; // allowed to be undefined for circuits

    circuit_chips.forEach(function (chip) {
      plug_in(chip, circuits_state, circuit_settings);
    });

    // 2. Register circuit ports and link them to lower-level ports
    // Note : this has to be done prior to connecting the circuits links, as they might use the circuit IN_ports, and OUT_ports
    // Note : this has to be done after pluging-in the lower-level chips/circuits so their connectors are already created
    // and can be referred to.
    // 2a. IN_ports
    register_circuit_IN_ports(circuit_ports_map, circuit, circuits_state);
    connect_mapped_circuit_IN_ports(circuit_ports_map, circuit, circuits_state);

    // 5. Connect and register readout connector
    //   If !circuit.test.readout, create one default (Rx.ReplaySubject(1)) and set it up on the object
    //   Connect ALL children chips readout connectors to circuit's READOUT connector
    var circuit_readout_conn = get_active_readout_conn(readout_conn, circuit.uri);
    var circuit_readout_port_uri = get_port_uri({chip_uri: uri, port_name: READOUT_PORT_NAME});

    OUT_connector_hash.set(circuit_readout_port_uri, circuit_readout_conn);

    circuit_chips.forEach(function connect_circuit_readout_to_chips(chip) {
      var chip_test_readout_port_uri = get_port_uri({chip_uri: chip.uri, port_name: READOUT_PORT_NAME});
      var chip_test_readout = OUT_connector_hash.get(chip_test_readout_port_uri);
      disposable_hash.set(
        utils.join(chip_test_readout_port_uri, circuit_readout_port_uri, ARROW_JOIN_STR),
        chip_test_readout
          //          .map(translate_circuit_OUT_port_uri(circuit, circuit_ports_map))
          .subscribe(circuit_readout_conn));
      //          .do(utils.rxlog('readout ' + circuit.uri +':'))
    });

    // 2b. OUT_ports
    // circuit's OUT_ports are mapped to a lower-level circuit/chip's OUT_ports
    // No subscribe is made to connect those two OUT ports, as we want to start whether chip or circuits
    // only at actual subscription time (i.e. when linking).
    // Not doing so could lead to loose the homogeneous behaviour between chip and circuits and
    // give rise to some difficult to debug situations.
    connect_mapped_circuit_OUT_ports(circuit_ports_map, circuit, /*-OUT-*/circuits_state);

    // 3. Wire links
    connect_links(circuit_links, circuits_state);

    // 4. Connect and register simulate connector and disposable
    //   If !circuit.test.simulate, create one default (Rx.Subject) and set it up on the object
    //   Connect SIMULATE connector to ALL children chips
    //   NOTE : Circuits' simulate connector differ from chips' simulate connector:
    //   - They propagate messages to all given circuit's members, even if there is no corresponding exposed port
    //   - This is better for testing purposes which is the goal of the simulate connector in the first place
    //   - For instance, if we have a circuit representing a DOM component having an intent source chip,
    //     it will be possible to simulate the intents from the circuit's simulate connector, even as there is no exposed
    //     port to the intent source chip.
    //   NOTE : this works because all ports are filtering by port_uri, so no risk of pollution
    var circuit_simulate_conn = get_active_simulate_conn(simulate_conn, circuit.uri);
    var circuit_simulate_port_uri = get_port_uri({chip_uri: uri, port_name: SIMULATE_PORT_NAME});

    // NOTE : It is not really necessary to register also the simulate connectors,
    // unless we want to access them from out-of-scope parts of the programs OR we change the API and choose not
    // to reference the chip object directly (as in chip.test.simulate), but instead its uri
    IN_connector_hash.set(circuit_simulate_port_uri, circuit_simulate_conn);
    circuit_chips.forEach(function connect_circuit_simulate_to_chips(chip) {
      // Register the simulate subscription disposable
      var chip_test_simulate = get_simulate_port(chip, circuits_state);
      disposable_hash.set(
        // register the disposable under the key made by joining origin to destination ports
        utils.join(circuit_simulate_port_uri, chip.uri, ARROW_JOIN_STR),
        circuit_simulate_conn
          // NOTE : when passing a message from one port to a lower-level one, we must translate the message label
          .map(translate_circuit_IN_port_uri(circuit, IN_connector_hash))
          // We already made sure that the message was destined to one child chip/circuit
          // Now we make sure that only the messages destined that child is reaching it
          .filter(is_in_circuit_IN_ports(chip))
          .catch(function (e) {
            // TODO : error management at the subject level? Think about a structure a la Erlang
            console.error(e);
            return Rx.Observable.throw(e);
          })
          .subscribe(chip_test_simulate)
        // TODO : DOCUMENTATION : simulate ports can only send messages to IN port of the circuit to which the simulate is associated
        // so if circuit has IN : x1,x2, then on simulate the message is {label : message} with label : circuit|x1
      );
    });
  }

  /**
   *
   * @param circuits_state
   * @param {Controller_Order} order
   * @returns {*}
   */
  function process_order(/*-OUT-*/circuits_state, order) {
    // TODO : update history mechanism to specify
    assert_order_contracts(circuits_state, order);

    var order_command = get_order_command(order);
    /**@type {{circuit: Circuit|Chip, links : Array<Link>}}*/
    var order_parameters = order.parameters;
    var circuit = order_parameters.circuit; // Note : could also be a chip
    var links = order_parameters.links;
    var order_settings = order_parameters.settings;
    var order_history = circuits_state.order_history;
    var is_plugged = circuits_state.is_plugged;

    switch (order_command) {
      case COMMAND_PLUG_IN_CIRCUIT :
        // Case : we have a circuit that we want to plug-in and START (essentially equivalent terms in this context)
        // The circuit already has ample information as how to connect inward.
        // The `links` property allows to :
        // - connect to the controller, using the controller connector's uri which 'manages' the chip
        // - connect outwards, for instance to plug-in the circuit to prior existing circuits

        plug_in(circuit, /*-OUT-*/circuits_state, order_settings);
        // 2. Connect links
        connect_links(links, circuits_state);
        // 3. Record the chip/circuit as being plugged
        is_plugged.set(circuit.uri, true);
        // There is no simulate and readout here, they are at the circuit level
        // 3. update order history
        // This is so that one can reconstruct the current global circuit graph from the accumulated orders
        // TODO : The nodes of the graph are already in IN_(OUT)_connector_hash, I just miss the edges
        //        but have both information in the data structure so it is independent
        order_history.add(circuits_state, order);

        break;
      case COMMAND_UNPLUG_CIRCUIT :
        // Unplug circuit
        // Unplug has mirroring operations to plug-in
        // Mirroring operations are performed in reverse order
        // The mirror operation to `transform` is `dispose` and enable to undo/reverse any side-effects necessary
        // For instance, if a database connection was opened on transform, then it can be closed on dispose
        // Chips have a `transform`/`dispose` function. For circuits, it is implicit from their children components

        // 1. Disconnect links
        disconnect_links(links, circuits_state);
        // 2. Unplug the circuits
        unplug(circuit, /*-OUT-*/circuits_state, order_settings);

        // Update order history
        order_history.add(circuits_state, order);
        break;
      default :
        throw 'Unknown command! : ' + order_command;
    }

    return circuits_state;
  }

  function get_order_command(order) {
    return order.command;
  }

  function get_chip_port(chip, port_name) {
    return {
      chip_uri: chip.uri,
      port_name: port_name
    }
  }

  function make_link(chip_origin, chip_target, port_name_OUT, port_name_IN) {
    // TODO : complete signature and type checking
    if (!chip_origin || !chip_target) throw 'make_link : chip_origin or chip_target is falsy! Expected a chip!'
    // NOTE : port_name is an OUT port for chip_origin, and IN port for chip_target
    return {
      IN_port: get_chip_port(chip_target, port_name_IN),
      OUT_port: get_chip_port(chip_origin, port_name_OUT)
    }
  }

  function make_chip(chip) {
    assert_chip_contracts(chip);
    return utils.new_typed_object(chip, CIRCUIT_OR_CHIP_TYPE);
  }

  return {
    create_controller: create_controller,
    get_chip_port: get_chip_port,
    get_port_uri: get_port_uri,
    get_simulate_port_uri: get_simulate_port_uri,
    make_link: make_link,
    make_chip: make_chip,
    get_default_simulate_conn: get_default_simulate_conn,
    get_default_readout_conn: get_default_readout_conn
  }
}
