define(function (require) {
  return {
    TYPE_KEY: '__type',
    WRAP_CHAR: '-',
    JOIN_STR : '-|',
    ARROW_JOIN_STR : '->',
    EXPECTING_INTENT: 'intent',
    EXPECTING_ACTION_RESULT: 'expecting_action_result',
    EV_INTENT: '<intent>',
    EV_EFFECT_RES: '<effect response>',
    EV_TRACE: '<trace>',
    EV_CODE_TRACE: 'trace',
    EV_CODE_AUTO: 'auto',
    EV_CODE_INIT: 'init',
    EV_CODE_ERROR: 'error',
    EV_CODE_EFFECT_ERROR: 'effect_error',
    INITIAL_STATE_NAME: 'nok',
    ACTION_IDENTITY: 'identity',
    STATE_PROTOTYPE_NAME: 'State', // !!must be the function name for the constructor State, i.e. State
    CHECK_TYPE: true,
    ACTION_HANDLER_IDENTITY: function action_handler_identity(model, event_data) {
      // we return nothing because pure handlers only return model updates, and there are no updates
      return {};
    },
    SIMULATE_PORT_NAME: '$simulate$',
    READOUT_PORT_NAME : '$readout$',
    TEST_CASE_PORT_NAME : 'test_case',
    FROM_CHILD_PORT_NAME : 'from_child_port_name',
    FROM_PARENT_PORT_NAME : 'from_parent_port_name',
    TO_CHILDREN_PORT_NAME : 'to_children_port_name',
    TO_PARENT_PORT_NAME : 'to_parent_port_name',
    TO_CONTROLLER_PORT_NAME : 'order$',
    FROM_CONTROLLER_PORT_NAME : 'circuits_state$',
    CONTROLLER_CHIP_URI: 'controller_1',
    COMMAND_PLUG_IN_CIRCUIT : 'command_plug_in_circuit',
    COMMAND_UNPLUG_CIRCUIT : 'command_unplug_circuit',
    // Types
    INTENT: 'intent',
    TRACE_INTENT: 'trace_intent',
    PURE_ACTION_HANDLER: 'pure_action_handler',
    ACTION_SEQUENCE_HANDLER: 'action_sequence_handler',
    EVENT_HANDLER_RESULT: 'event_handler_result',
    EFFECT_HANDLER: 'effect_handler',
    EFFECT_RESPONSE: 'effect_response',
    EFFECT_ERROR_DATA: 'effect_error_data',
    DRIVER_REGISTRY: 'driver_registry',
    LAST_EFFECT_REQUEST: 'last_effect_request',
    CIRCUIT_OR_CHIP_TYPE : 'circuit_or_chip_type',
    ID_ALL : 'id_all',
    commands: {
      EXECUTE: 'command_execute',
      CANCEL: 'command_cancel',
      IGNORE: 'command_ignore'
    },
    // Configuration
    SETTINGS_OVERRIDE: false,
    // TODO : add a second level to constants
    // for instance, types : {EFFECT_HANDLER...}, commands : {EXECUTE}
    // remove prefixing
  }
});
