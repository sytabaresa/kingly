define(function (require) {
  var _ = require('lodash');
  var utils = require('utils');
  var Err = require('custom_errors');
  var constants = require('constants');
  var circuits = require('circuits');
  var Rx = require('rx');

  return require_circuits_utils(Rx, _, circuits, utils, Err, constants);
});

function require_circuits_utils(Rx, _, circuits, utils, Err, constants) {
  var TEST_CASE_PORT_NAME = constants.TEST_CASE_PORT_NAME;
  var CONTROLLER_CHIP_URI = constants.CONTROLLER_CHIP_URI;

  /**
   * This only tests a serie of outputs vs. a serie of inputs linked in a 1-to-1 relationship, i.e. 1 input -> 1 output
   * Two signatures :
   * - output$ is an observable : will capture the stream of outputs
   * - is undefined : nothing. Outputs will be accumulated outside the test utility function, return an observable which just wait for some time to allow that process to finish
   * @param {{input_seq, inputS, max_delay, wait_for_finish_delay}} input_parameters
   * @param {{expected_output_seq, output$, output_transform_fn}} output_parameters
   * @param {String} [test_identifier]
   * @returns {Rx.Observable}
   */
  function rx_test_with_random_delay(input_parameters, output_parameters, test_identifier) {
    var input_seq = input_parameters.input_seq;
    var max_delay = input_parameters.max_delay;
    var wait_for_finish_delay = input_parameters.wait_for_finish_delay || 50;
    var inputS = input_parameters.inputS;
    var output$ = output_parameters.output$;
    var output_transform_fn = output_parameters.output_transform_fn;

    var test_initial_state = [];

    // Send the input sequence on the input connector with random time spacing (behaviour should be independent)
    // Hence no input value will be emitted in this tick, which allows the rest of the code on the same tick to wire other observables.
    var input$ = Rx.Observable.from(input_seq)
      .delay(utils.random(1, max_delay))
      .do(simulate_input(inputS))
      .share();
    input$.subscribe(log_test_input);

    // Returns an observable which only emits one value when the test has completed (successfully or not) : the test success
    // NOTE:  The test aborts as soon as a mismatch between expected output value and actual output value is detected
    /**
     * @type Rx.Observable <Boolean>
     */
    return output$
      ? output$
      .scan(function (transformed_actual_outputs, output_value) {
        var transformed_actual_output = output_transform_fn(output_value);
        transformed_actual_outputs.push(transformed_actual_output);

        return transformed_actual_outputs;
      }, test_initial_state)
      .sample(input$.last().delay(wait_for_finish_delay))// give it some time to process the inputs, after the inputs have been emitted
      .do(utils.rxlog('transformed_actual_outputs'))
      .take(1)
      : Rx.Observable.return({}).delay(max_delay * input_seq.length * 4)
      ;

  }

  // TODO : document, possibly fuse the previous into one with the new one
  // TODO : put a little bit of order because I have a third one now...
  function rx_test_seq_with_random_delay(input_parameters, output_parameters, test_identifier) {
    var input_seq = input_parameters.input_seq;
    var max_delay = input_parameters.max_delay;
    var wait_for_finish_delay = input_parameters.wait_for_finish_delay || 50;
    var input_conn_hash = input_parameters.input_conn_hash;
    var output$ = output_parameters.output$;
    var output_transform_fn = output_parameters.output_transform_fn;

    var test_initial_state = [];

    // Send the input sequence on the input connector with random time spacing (behaviour should be independent)
    // Hence no input value will be emitted in this tick, which allows the rest of the code on the same tick to wire other observables.
    var input$ = Rx.Observable.from(input_seq)
      .concatMap(function (input_obj) {
        return Rx.Observable.return(input_obj).delay(utils.random(1, max_delay))
      })
      //      .delay(utils.random(1, max_delay))
      .do(simulate_input_2(input_conn_hash))
      .share();
    input$.subscribe(log_test_input);

    // Returns an observable which only emits one value when the test has completed (successfully or not) : the test success
    // NOTE:  The test aborts as soon as a mismatch between expected output value and actual output value is detected
    /**
     * @type Rx.Observable <Boolean>
     */
    return output$
      ? output$
      .scan(function (transformed_actual_outputs, output_value) {
        var transformed_actual_output = output_transform_fn(output_value);
        transformed_actual_outputs.push(transformed_actual_output);

        return transformed_actual_outputs;
      }, test_initial_state)
      .sample(input$.last().delay(wait_for_finish_delay))// give it some time to process the inputs, after the inputs have been emitted
      .do(utils.rxlog('transformed_actual_outputs'))
      .take(1)
      : Rx.Observable.return({}).delay(max_delay * input_seq.length * 4)
      ;

  }

  //////
  // Helpers
  function simulate_input(inputS) {
    return function simulate_input(input_value) {
      inputS.onNext(input_value);
    }
  }

  function simulate_input_2(input_conn_hash) {
    return function simulate_input(input_obj) {
      input_conn_hash[input_obj.to].onNext(input_obj.input);
    }
  }

  function log_test_input(input_value) {
    console.info('test value emitted : ', input_value);
  }

  function clone_circuit(circuit, id){
    var cloned_circuit = utils.clone_deep(circuit);
    cloned_circuit.uri = cloned_circuit.uri + id;
    return cloned_circuit;
  }

  var counter = 0;

  function make_test_chip() {
    var uri = 'generic_test_chip_' + ++counter;
    var simulate_conn = circuits.get_default_simulate_conn(uri);
    return {
      test_chip: circuits.make_chip({
        serie: 'generic_test_chip',
        uri: uri,
        ports: {
          IN: ['circuits_state', TEST_CASE_PORT_NAME],
          OUT: []
        },
        transform: generic_test_transform,
        settings: {
          max_delay: 20,
          wait_for_finish_delay: 50
        },
        test: {
          simulate: simulate_conn
        }
      }),
      simulate_conn: simulate_conn
    }
  }

  function generic_test_transform(circuits_state$, test_case$, settings) {
    var max_delay = settings.max_delay;
    var wait_for_finish_delay = settings.wait_for_finish_delay || 50;

    test_case$.withLatestFrom(circuits_state$, function make_exec_test_observable(test_case, circuit_state) {
      var input_seq = test_case.input_seq;
      // we will use input_seq : {to : {chip_uri, port_name}, input : *}
      var expected_output_seq = test_case.expected_output_seq;
      var test_success_message = test_case.test_message;
      var output_transform_fn = test_case.output_transform_fn || utils.identity;
      // Read all the readouts in the circuits state and filter them according to readout filter (format to precise : port name? port_uri? function?)
      var readout_filter = test_case.readout_filter || utils.identity;
      var analyze_test_results_fn = test_case.analyze_test_results_fn;

      // Return an observable that executes the test case
      var input$ = Rx.Observable.from(input_seq)
        // Send the input sequence on the input connector with random time spacing (behaviour should be independent)
        // Hence no input value will be emitted in this tick, which allows the rest of the code on the same tick to wire other observables.
        .concatMap(function (input_obj) {
          return Rx.Observable.return(input_obj).delay(utils.random(1, max_delay))
        })
        .do(simulate_input(circuit_state))
        .do(utils.rxlog('simulating input:'))
        .share(); // share because we reuse it in test_result$
      input$.subscribe(utils.noop);
      // TODO : right now, I cannot do several tests in a row, they might mix together...

      var test_result$ = undefined;
      // Register to all readout and filter the one I am interested in
      // I also need to unsubscribe all of them when finished (pay attention that they are not completed accidentally while doing so)
      var filtered_readouts = get_filtered_readout_connectors(readout_filter, circuit_state)
        .map(function(readout_connector){return readout_connector.map(utils.label(readout_connector.uri))});
      if (filtered_readouts.length === 0) {
        // Case : nothing to read out from (example of circuit doing silent side-effects) but we want to wait some reasonable time
        // before proceeding with the testing
        // That case naturally means that the function analyze_results must incorporate a way to perform its function, for examples
        // accessibles mutable variables through closure
        test_result$ = Rx.Observable.return({}).delay(max_delay * input_seq.length * 4)
      }
      else {
        test_result$ = Rx.Observable.merge(filtered_readouts)
          .scan(function (transformed_actual_outputs, output_value) {
            var transformed_actual_output = output_transform_fn(output_value);
            transformed_actual_outputs.push(transformed_actual_output);

            return transformed_actual_outputs;
          }, [])
          .sample(input$.last().delay(wait_for_finish_delay))// give it some time to process the inputs, after the inputs have been emitted
          .do(utils.rxlog('transformed_actual_outputs:'))
          .take(1)
      }

      return test_result$.do(analyze_test_results_curried(analyze_test_results_fn, expected_output_seq, test_success_message));
    })
      // Execute the next test only when the previous one has finished
      // TODO : review if that will works,should I use a defer?? the inputs are sent immediately before the concat kicks in
      .concatAll()
      .subscribe(utils.rxlog('test case finished!'));

    ///////////
    // Helper functions
    function analyze_test_results_curried(analyze_test_results_fn, expected_output_seq, test_success_message) {
      return function analyze_test_results(transformed_actual_output_seq) {
        return analyze_test_results_fn(transformed_actual_output_seq, expected_output_seq, test_success_message);
      }
    }

    function simulate_input(circuits_state) {
      return function simulate_input(input_obj) {
        var IN_connector_hash = circuits_state.IN_connector_hash;
        IN_connector_hash.get(input_obj.to).onNext(input_obj.input);
      }
    }

    function get_filtered_readout_connectors(readout_filter, circuit_state) {
      var OUT_connector_hash = circuit_state.OUT_connector_hash;
      return _.filter(OUT_connector_hash, function filter_readout_connector(connector, port_uri) {
        var port = utils.disjoin(port_uri);
        return port.port_name === constants.READOUT_PORT_NAME
          && readout_filter(port.chip_uri)
          && port.chip_uri !== CONTROLLER_CHIP_URI;
      });
    }

  }

  return {
    rx_test_with_random_delay: rx_test_with_random_delay,
    rx_test_seq_with_random_delay: rx_test_seq_with_random_delay,
    make_test_chip: make_test_chip,
    clone_circuit : clone_circuit
  }
}

