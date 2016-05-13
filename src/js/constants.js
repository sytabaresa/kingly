define(function (require) {
  return {
    EXPECTING_INTENT: 'intent',
    EXPECTING_ACTION_RESULT: 'expecting_action_result',
    EV_INTENT: 'intent',
    EV_EFFECT_RES: 'effect_res',
    EV_TRACE: 'trace',
    EV_CODE_TRACE: 'trace',
    EV_CODE_AUTO: 'auto',
    EV_CODE_INIT: 'init',
    INITIAL_STATE_NAME: 'nok',
    ACTION_IDENTITY: 'identity',
    STATE_PROTOTYPE_NAME: 'State', // !!must be the function name for the constructor State, i.e. State
    CHECK_TYPE: true,
    ACTION_HANDLER_IDENTITY: function action_handler_identity(model, event_data) {
      // we return nothing because pure handlers only return model updates, and there are no updates
      return {};
    },
    // Types
    PURE_ACTION_HANDLER: 'pure_action_handler',
    ACTION_SEQUENCE_HANDLER: 'action_sequence_handler',
    EVENT_HANDLER_RESULT: 'event_handler_result',
    EFFECT_HANDLER : 'effect_handler',
    DRIVER_REGISTRY : 'driver_registry',
    commands : {
      EXECUTE : 'command_execute',
      CANCEL : 'command_cancel'
    }
    // TODO : add a second level to constants
    // for instance, types : {EFFECT_HANDLER...}, commands : {EXECUTE}
    // remove prefixing
  }
});
