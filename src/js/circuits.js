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
 * @property {Plug_In_Parameters} parameters
 * TODO : this is for create, add also for delete
 */
/**
 * @typedef {{circuit: Circuit|Chip, links : Array<Link>, settings : Settings}} Plug_In_Parameters
 */

  // DOCUMENTATION :
  // !! The readout connector are passing along the values that are emitted by the output ports AS IS without cloning.
  // As they are semantically meant to reflect the value of an output at a specific moment in time, the output value should
  // be cloned so it remains constant (inprevious to further modification of the output value downstream).
  // However this has performance implications (deep cloning at every level of the circuit possibly big objects). So a choice
  // is made to not deep-clone or clone any output value.
  // The consequence for the user of the library is that whatever value are :
  // - immediate and single usage of the output value (same tick, so before any other modification could happen)
  // - in specific cases, deep cloning manually when really necessary instead of at the library level

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

  /**
   *
   * @param {Port} port
   * @constructor
   */
  function IN_Port(port) {
    this.chip_uri = port.chip_uri;
    this.port_name = port.port_name;
  }

  /**
   *
   * @param {Port} port
   * @constructor
   */
  function OUT_Port(port) {
    this.chip_uri = port.chip_uri;
    this.port_name = port.port_name;
  }

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
    return connector;
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
      o.onCompleted();
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

  function get_default_IN_conn(uri) {
    return get_new_IN_connector(uri);
    // return new Rx.Subject();
  }

  function get_default_OUT_conn() {return new Rx.Subject();}

  function get_default_simulate_conn() {return new Rx.ReplaySubject(1);}

  function get_default_readout_conn() {return new Rx.ReplaySubject(1);}

  function controller_transform(order$, settings) {
    var circuits_initial_state = settings;
    return {
      circuits_state$: order$
        .do(utils.rxlog('order'))
        .scan(process_order, circuits_initial_state)
    }
  }

  function create_controller(controller) {
    var controller_simulate_conn = get_default_simulate_conn();
    var controller_readout_conn = get_default_readout_conn();
    var controller_settings = {
      IN_connector_hash: new utils.Hashmap(),
      OUT_connector_hash: new utils.Hashmap(),
      order_history: new Order_History()
    };

    var _controller = utils.set_custom_type({
      serie: controller.serie || 'controller',
      uri: controller.uri || 'controller_1',
      ports: controller.ports || {
        IN: ['order$'],
        OUT: ['circuits_state$']
      },
      transform: controller.transform || controller_transform,
      settings: controller.settings || controller_settings,
      test: controller.test || {
        simulate: controller_simulate_conn,
        readout: controller_readout_conn
      }
    }, CIRCUIT_OR_CHIP_TYPE);

    IN_connector_hash = _controller.settings.IN_connector_hash; // TODO: put the var back when finished testing
    OUT_connector_hash = _controller.settings.OUT_connector_hash;

    plug_in(_controller, _controller.settings, {});
    start(controller, _controller.settings);

    function start(controller, settings) {
      var IN_connector_hash = settings.IN_connector_hash;
      var OUT_connector_hash = settings.OUT_connector_hash;
      var OUT_port = OUT_connector_hash.get(get_port_uri({
        port_name: controller.ports.OUT[0],
        chip_uri: controller.uri
      }));
      OUT_port.subscribe(utils.rxlog('controller'))
    }

    return _controller;
  }

  /**
   *
   * @param {IN_Port | OUT_Port} port
   */
  function get_port_uri(port) {
    return port ? utils.join(port.chip_uri, port.port_name) : undefined;
  }

  function get_port_from_port_uri(port_uri) {
    return port_uri ? utils.disjoin(port_uri) : undefined;
  }

  function is_port_uri(port_uri) {
    return function is_port_uri(message) {
      return port_uri === get_uri_from_message(message);
    }
  }

  function get_uri_from_message(message) {
    // NOTE ; the encoding decided is to prefix the actual object passed by a property which is the uri sending the message
    //         So there should only be one such key in this object
    return utils.get_label(message);
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
      // In fact we only check that the label correspond to a registered circuit/chip port
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

      /*
       // 4. ... mapping which corresponds to a circuit's existing IN port (any circuit at any level)
       var translated_IN_port_uri = get_port_uri(translated_IN_port);
       if (!IN_connector_hash.has(translated_IN_port_uri)) throw Err.Circuit_Error({
       message: 'Circuit port mapping for port-labelled message does not correspond to a registered port!',
       extended_info: {
       where: 'translate_circuit_IN_port_uri',
       port_labelled_message: port_labelled_message,
       IN_port_uri: IN_port_uri,
       translated_IN_port_uri : translated_IN_port_uri,
       IN_connector_hash: IN_connector_hash
       }
       });
       */

      // 4. ... mapping which corresponds to a circuit's lower-level chip/circuit's existing IN port
      function get_port_uris(chip_or_circuit) {
        return function get_port_uris(IN_port_name) {
          return get_port_uri({chip_uri: chip_or_circuit.uri, port_name: IN_port_name});
        }
      }

      var translated_IN_port_uri = get_port_uri(translated_IN_port);
      var chips_port_uris = circuit.chips.map(function to_port_names(chip_or_circuit) {
        if (chip_or_circuit.chips) {
          // Case Circuit
          return utils.get_keys(chip_or_circuit.ports_map.IN).map(get_port_uris(chip_or_circuit));
        }
        else {
          // Case Chip
          return utils.get_values(chip_or_circuit.ports.IN).map(get_port_uris(chip_or_circuit));
        }
      });
      var flattened_chips_port_names = [].concat.apply([], chips_port_uris);
      if (flattened_chips_port_names.indexOf(translated_IN_port_uri) === -1) throw Err.Circuit_Error({
        message: 'Circuit port mapping for port-labelled message does not correspond to a registered port in lower-level circuit/chips!',
        extended_info: {
          where: 'translate_circuit_IN_port_uri',
          port_labelled_message: port_labelled_message,
          IN_port_uri: IN_port_uri,
          translated_IN_port_uri: translated_IN_port_uri,
          lower_level_port_names: flattened_chips_port_names
        }
      });

      // Translate message
      var translated_message = {};
      translated_message[translated_IN_port_uri] = utils.remove_label(port_labelled_message);
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
      connector.onNext(labelled_message);
    }
  }

  /**
   *
   * @param ports
   * @param circuits_state
   * @param uri
   * Side-effects : modify `circuits_state`
   */
  function register_IN_ports(ports, uri, /*-OUT-*/circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    ports.IN.forEach(function create_IN_connectors(port_name) {
      var port = new IN_Port({chip_uri: uri, port_name: port_name});
      var port_uri = get_port_uri(port);
      var connector = get_default_IN_conn(port_uri);
      if (IN_connector_hash.get(port_uri)) throw Err.Circuit_Error({
        message: 'There already exists a port with the same identifier!',
        extended_info: {where: 'register_IN_ports', port_uri: port_uri, IN_connector_hash: IN_connector_hash}
      });
      IN_connector_hash.set(port_uri, connector);
    });
  }

  /**
   *
   * @param {Ports_Map} ports_map
   * @param {URI} uri
   * @param circuits_state
   * Side-effects : modifies `circuits_state`
   * @throws : if uri is not unique (exists already)
   */
  function register_circuit_OUT_ports(ports_map, uri, /*-OUT-*/circuits_state) {
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    _.forEach(ports_map.OUT, function create_OUT_connectors(__, port_name) {
      var port = new OUT_Port({chip_uri: uri, port_name: port_name});
      var port_uri = get_port_uri(port);
      var connector = get_default_OUT_conn();
      if (OUT_connector_hash.get(port_uri)) throw Err.Circuit_Error({
        message: 'There already exists a port with the same identifier!',
        extended_info: {where: 'register_circuit_OUT_ports', port_uri: port_uri, OUT_connector_hash: OUT_connector_hash}
      });
      OUT_connector_hash.set(port_uri, connector);
    });
  }

  /**
   *
   * @param {Ports_Map} ports_map
   * @param {URI} uri
   * @param circuits_state
   * Side-effects : modifies `circuits_state`
   * @throws : if uri is not unique (exists already)
   */
  function register_circuit_IN_ports(ports_map, uri, /*-OUT-*/circuits_state) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    _.forEach(ports_map.IN, function create_IN_connectors(__, port_name) {
      var port = new IN_Port({chip_uri: uri, port_name: port_name});
      var port_uri = get_port_uri(port);
      var connector = get_default_IN_conn(port_uri);
      if (IN_connector_hash.get(port_uri)) throw Err.Circuit_Error({
        message: 'There already exists a port with the same identifier!',
        extended_info: {where: 'register_circuit_IN_ports', port_uri: port_uri, IN_connector_hash: IN_connector_hash}
      });
      IN_connector_hash.set(port_uri, connector);
    });
  }

  /**
   *
   * @param {Ports_Map} circuit_ports_map
   * @param circuits_state
   * @param circuit_uri
   * Side-effects : subscribes exposed circuit IN connectors to mapped inner chip/circuits IN connector
   */
  function connect_mapped_circuit_IN_ports(circuit_ports_map, circuit_uri, circuits_state) {
    circuit_ports_map = circuit_ports_map || {};
    var IN_connector_hash = circuits_state.IN_connector_hash;
    _.forEach(circuit_ports_map.IN || {}, function connect_mapped_circuit_IN_ports(target_IN_port, circuit_IN_port_name) {
      var circuit_IN_connector =
        IN_connector_hash.get(get_port_uri(new IN_Port({chip_uri: circuit_uri, port_name: circuit_IN_port_name})));
      var mapped_IN_connector = IN_connector_hash.get(get_port_uri(target_IN_port));
      circuit_IN_connector.subscribe(mapped_IN_connector);
    });
  }

  /**
   *
   * @param {Ports_Map} circuit_ports_map
   * @param {URI} circuit_uri
   * @param circuits_state
   * Side-effects : subscribes exposed circuit OUT connectors to mapped inner chip/circuits OUT connector
   */
  function connect_mapped_circuit_OUT_ports(circuit_ports_map, circuit_uri, circuits_state) {
    circuit_ports_map = circuit_ports_map || {};
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    _.forEach(circuit_ports_map.OUT || {}, function connect_mapped_circuit_OUT_ports(target_OUT_port, circuit_OUT_port_name) {
      var mapped_OUT_connector = OUT_connector_hash.get(get_port_uri(target_OUT_port));
      var circuit_OUT_connector =
        OUT_connector_hash.get(get_port_uri(new OUT_Port({
          chip_uri: circuit_uri,
          port_name: circuit_OUT_port_name
        })));
      mapped_OUT_connector.subscribe(circuit_OUT_connector);
    });
  }

  /**
   *
   * @param {Array<Link>} links
   * @param {{IN_connector_hash : IN_Connector_Dict, OUT_connector_hash : OUT_Connector_Dict}} circuits_state
   * Side-effects : connects OUT connectors of one chip/circuit to mapped IN connector of another chip/circuit
   */
  function connect_links(links, circuits_state) {
    // 2. Wire links
    // - get IN_port, OUT_port from link
    // - get IN subject connector and OUT observable connector associated to link (from IN_Connector_Dict and OUT_Connector_Dict )
    //   + connector <- hashmap.get(IN_port)
    // - subscribe connector IN to connector OUT
    links = links || []; // links is allowed to be undefined or empty
    links.forEach(function (link) {
      var IN_connector_hash = circuits_state.IN_connector_hash;
      var OUT_connector_hash = circuits_state.OUT_connector_hash;
      var IN_port = link.IN_port;
      var OUT_port = link.OUT_port;

      var IN_connector = IN_connector_hash.get(get_port_uri(IN_port));
      if (!IN_connector) throw Err.Circuit_Error({
        message: 'Invalid link configured! Cannot find a registered connector register for IN port!',
        extended_info: {where: 'connect_links', IN_port: IN_port, IN_connector_hash: IN_connector_hash}
      });

      var OUT_connector = OUT_connector_hash.get(get_port_uri(OUT_port));
      if (!OUT_connector) throw Err.Circuit_Error({
        message: 'Invalid link configured! Cannot find a registered connector register for OUT port!',
        extended_info: {where: 'connect_links', IN_port: OUT_port, OUT_connector_hash: OUT_connector_hash}
      });

      OUT_connector.subscribe(IN_connector);
    });
  }

  /**
   *
   * @param {Circuit|Chip} circuit
   * @param {{IN_connector_hash, OUT_connector_hash}} circuits_state
   * @param parent_settings
   * Side-effects : modifies `circuits_state` hashmaps
   */
  function plug_in(circuit, /*-OUT-*/circuits_state, parent_settings) {
    // NOTE : parent_settings and chip_settings should be deep cloned or frozen to prevent impact from out of scope modification
    //        We leave it as is, the best solution to this, is to make all circuits a `constant` (ES6) or deep-frozen objects
    //        This problem is everywhere at the API surface.
    //        We will deep-clone only when there is an estimated high likelyhood or impact of changes
    utils.assert_type(circuit, CIRCUIT_OR_CHIP_TYPE, {
      message: 'plug_in : expected parameter of type circuit!',
      extended_info: {circuit: circuit}
    });

    if (!circuit.chips) {
      plug_in_chip(circuit, /*-OUT-*/circuits_state, parent_settings);
    }
    else {
      plug_in_circuit(circuit, /*-OUT-*/circuits_state, parent_settings);
    }
  }

  function plug_in_chip(chip, /*-OUT-*/circuits_state, parent_settings) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    var uri = chip.uri;
    var chip_ports = chip.ports;
    var chip_settings = chip.settings;
    var chip_transform = chip.transform;
    var test = chip.test = chip.test || {}; // optional
    var simulate_conn = test.simulate;
    var readout_conn = test.readout;

    // Case chip : (`chips` is undefined)
    // 1. Create and register IN_ports connectors
    register_IN_ports(chip_ports, uri, circuits_state);

    // 2. Register simulate connector
    // If there is no simulate connector, we create one.
    // We need one, so that if we have a simulate connector at a higher level (enclosing chip),
    // that upper-level simulate connector can connect to the lower-level connector to send data
    // This done recursively in every level ensures an ininterrupted connector chain ending at the chip level.
    // Hence, the simulate connector at the chip level can forward data down to any other level.
    // The default connector is an Rx.Subject.
    // We should not need a replay functionality here as :
    // - the simulate connector is used by construction once all lower-level circuits are plugged
    // - there should only ever be one user/caller of a simulate connector (i.e. no concurrent simulations)
    simulate_conn = simulate_conn ? simulate_conn : get_default_simulate_conn();
    chip.test.simulate = simulate_conn; // need to put it in the object
    IN_connector_hash.set(get_port_uri({chip_uri: uri, port_name: SIMULATE_PORT_NAME}), simulate_conn);

    // 3. Add simulate functionality
    // This means passing simulate connector's input to each port, after filtering out input destined to other ports
    // NOTE : SIMULATE connectors do not send error notification if one sends messages relevant to no ports
    // NOTE : this is shared as the transform function could subscribe several times to the IN ports
    var merged_connectors = chip_ports.IN.map(function create_merged_connectors(port_name) {
      var port = new IN_Port({chip_uri: uri, port_name: port_name});
      var port_uri = get_port_uri(port);
      return Rx.Observable.merge(
        IN_connector_hash.get(port_uri)
          .do(utils.rxlog('IN connector hash ' + port_uri)),
        simulate_conn
          .do(utils.rxlog('pre-filter simulated inputs sent to : ' + port_uri))
          .filter(is_port_uri(port_uri)).map(utils.remove_label)
      ).share();
    });

    //  4. Call the chip's transform function to process ports' inputs into outputs
    //  Edge case : there is no IN connector : `transform` in that case is called with [], that's fine
    if (!utils.is_function(chip_transform)) throw '`chip_transform` property is not a function!';
    //  4.1 Merge settings from the parent with the chip's settings
    //      - If SETTINGS_OVERRIDE config flag not set : parent_settings can add properties to chip's settings but not replace/modify them
    //      - Else : parent_settings will override properties with same name in chip's settings

    var merged_settings = merge_settings(parent_settings, chip_settings);
    merged_connectors.push(merged_settings);
    var output = chip_transform.apply(null, merged_connectors); // TODO : add error management for when transform function returns error

    // Create and register readout connectors
    readout_conn = readout_conn ? readout_conn : get_default_readout_conn();
    chip.test.readout = readout_conn; // need to put it in the object
    OUT_connector_hash.set(get_port_uri({chip_uri: uri, port_name: READOUT_PORT_NAME}), readout_conn);

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
      var OUT_port$ = connector.do(tap(readout_conn, port)).share();
      OUT_connector_hash.set(get_port_uri(port), OUT_port$);
    });
  }

  function plug_in_circuit(circuit, /*-OUT-*/circuits_state, parent_settings) {
    var IN_connector_hash = circuits_state.IN_connector_hash;
    var OUT_connector_hash = circuits_state.OUT_connector_hash;
    var uri = circuit.uri;
    var circuit_chips = circuit.chips;
    var circuit_ports_map = circuit.ports_map;
    var circuit_links = circuit.links;
    var circuit_settings = merge_settings(parent_settings, circuit.settings);
    var test = circuit.test = circuit.test || {}; // optional
    var simulate_conn = test.simulate;
    var readout_conn = test.readout;

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
    register_circuit_IN_ports(circuit_ports_map, uri, circuits_state);
    connect_mapped_circuit_IN_ports(circuit_ports_map, uri, circuits_state);
    // 2b. OUT_ports
    // NOTE : those OUT ports will be proxy subjects whose aim is to forward the content of existing inner-level OUT ports
    register_circuit_OUT_ports(circuit_ports_map, uri, circuits_state);
    connect_mapped_circuit_OUT_ports(circuit_ports_map, uri, circuits_state);
    // TODO: make sure it is a do, not two subjects linked as we want to keep cold behavior
    // TODO : I need a share which reconnects when resubscribed, or who does not refCount, so it is kept alive for later connections

    // 3. Wire links
    connect_links(circuit_links, circuits_state);

    // 4. Connect and register simulate connector
    //   If !circuit.test.simulate, create one default (Rx.Subject) and set it up on the object
    //   Connect SIMULATE connector to ALL children chips
    //   NOTE : Circuits' simulate connector differ from chips' simulate connector:
    //   - They propagate messages to all given circuit's members, even if there is no corresponding exposed port
    //   - This is better for testing purposes which is the goal of the simulate connector in the first place
    //   - For instance, if we have a circuit representing a DOM component having an intent source chip,
    //     it will be possible to simulate the intents from the circuit's simulate connector, even as there is no exposed
    //     port to the intent source chip.
    //   NOTE : this works because all ports are filtering by port_uri, so no risk of pollution
    var circuit_simulate_conn = circuit.test.simulate = simulate_conn ? simulate_conn : get_default_simulate_conn();
    // NOTE : It is not really necessary to register also the simulate connectors,
    // unless we want to access them from out-of-scope parts of the programs OR we change the API and choose not
    // to reference the chip object directly (as in chip.test.simulate), but instead its uri
    IN_connector_hash.set(get_port_uri({chip_uri: uri, port_name: SIMULATE_PORT_NAME}), circuit_simulate_conn);
    circuit_chips.forEach(function connect_circuit_simulate_to_chips(chip) {
      circuit_simulate_conn
        // NOTE : when passing a message from one port to a lower-level one, we must translate the message label
        .map(translate_circuit_IN_port_uri(circuit, IN_connector_hash))
        .catch(function (e) {
          console.error(e);
          return Rx.Observable.throw(e);
        })
        .subscribe(chip.test.simulate); // TODO : error management at the subject level? Think about a structure a la Erlang
    });

    // 5. Connect and register readout connector
    //   If !circuit.test.readout, create one default (Rx.ReplaySubject(1)) and set it up on the object
    //   Connect ALL children chips connectors to READOUT connector
    var circuit_readout_conn = circuit.test.readout = readout_conn ? readout_conn : get_default_readout_conn();
    OUT_connector_hash.set(get_port_uri({chip_uri: uri, port_name: READOUT_PORT_NAME}), circuit_readout_conn);
    circuit_chips.forEach(function connect_circuit_readout_to_chips(chip) {
      chip.test.readout
        .map(translate_circuit_OUT_port_uri(circuit, circuit_ports_map))
        .subscribe(circuit_readout_conn);
    });
  }

  function merge_settings(parent_settings, child_settings) {
    return SETTINGS_OVERRIDE
      ? _.merge({}, parent_settings, child_settings)
      : _.merge({}, child_settings, parent_settings);
  }

  /**
   *
   * @param circuits_state
   * @param {Controller_Order} order
   * @returns {*}
   */
  function process_order(circuits_state, order) {
    var order_command = get_order_command(order);
    /**@type {{circuit: Circuit|Chip, links : Array<Link>}}*/
    var order_parameters = get_order_parameters(order_command, order);

    switch (order_command) {
      case COMMAND_PLUG_IN_CIRCUIT :
        // Case : we have a circuit that we want to plug-in and START (essentially equivalent terms in this context)
        var circuit = order_parameters.circuit; // Note : could also be a chip
        var links = order_parameters.links;
        var order_settings = order_parameters.settings;
        var order_history = circuits_state.order_history;
        // The circuit already has ample information as how to connect inward.
        // The `links` property allows to :
        // - connect to the controller, using the controller connector's uri which 'manages' the chip
        // - connect outwards, for instance to plug-in the circuit to prior existing circuits

        plug_in(circuit, /*-OUT-*/circuits_state, order_settings);
        // 2. Connect links
        connect_links(links, circuits_state);
        // There is no simulate and readout here, they are at the circuit level
        // 3. update order history
        // This is so that one can reconstruct the current global circuit graph from the accumulated orders
        // TODO : The nodes of the graph are already in IN_(OUT)_connector_hash, I just miss the edges
        //        but have both information in the data structure so it is independent
        order_history.add(circuits_state, order);

        break;
      case COMMAND_UNPLUG_CIRCUIT :
        // TODO : don't forget to update the IN and OUT hash on removal so it always reflect the last version of the circuit
        // TODO : also update order history
        break;
      default :
        throw 'Unknown command! : ' + order_command;
    }

    return circuits_state;
  }

  function get_order_command(order) {
    return order.command;
  }

  function get_order_parameters(order_command, order) {
    var parameters = order && order.parameters;
    switch (order_command) {
      case COMMAND_PLUG_IN_CIRCUIT :
        if (parameters && parameters.circuit) return order.parameters; // .links property is allowed to be undefined
        throw Err.Invalid_Type_Error({
          message: 'get_order_parameters : plug-in order must come along with property `parameters` having a `circuit` property!',
          extended_info: {parameters: parameters}
        })
      case COMMAND_UNPLUG_CIRCUIT:
        throw 'NOT DONE YET!'
        break;
      default :
        throw Err.Invalid_Type_Error({
          message: 'get_order_parameters : unknown command!',
          extended_info: {command: order_command}
        })
    }
  }

  function get_chip_port(chip, port_name) {
    return {
      chip_uri: chip.uri,
      port_name: port_name
    }
  }

  function make_link(chip_origin, chip_target, port_name_OUT, port_name_IN) {
    // NOTE : port_name is an OUT port for chip_origin, and IN port for chip_target
    return {
      IN_port: get_chip_port(chip_target, port_name_IN),
      OUT_port: get_chip_port(chip_origin, port_name_OUT)
    }
  }

  return {
    create_controller: create_controller,
    get_chip_port: get_chip_port,
    get_port_uri: get_port_uri,
    make_link: make_link,
    get_default_simulate_conn: get_default_simulate_conn,
    get_default_readout_conn: get_default_readout_conn
  }
}
