export const CONTRACT_MODEL_UPDATE_FN_RETURN_VALUE =
  `Model update function must return valid update operations!`;
export const SEP = '.';
export const TRANSITION_SYMBOL = `-->`;
export const TRANSITION_LABEL_START_SYMBOL = `:`;
export const HISTORY_STATE_NAME = "H";
export const HISTORY_PREFIX = 'history.'
// CONSTANTS
export const INIT_STATE = 'nok';
export const INIT_EVENT = 'init';
export const AUTO_EVENT = 'auto';
export const STATE_PROTOTYPE_NAME = 'State'; // !!must be the function name for the constructor State,
// i.e. State
export const NO_STATE_UPDATE = [];
// NOTE : this really cannot be anything else than a falsy value, beware
export const NO_OUTPUT = null;
export const ACTION_IDENTITY = function ACTION_IDENTITY(){
  return {
    outputs : NO_OUTPUT,
    updates : NO_STATE_UPDATE
  }
}
export const history_symbol = {};
export const SHALLOW = 'shallow';
export const DEEP = 'deep';

export const WRONG_EVENT_FORMAT_ERROR = `ERROR: the machine received an event which does not have the proper format. Expecting an object whose unique key is the event name, and value is the event data.`
export const ACTION_EXEC_ERROR = actionName => `ERROR: when executing action factory ${actionName||""}`
export const INVALID_ACTION_FACTORY_EXECUTED = actionName => `${ACTION_EXEC_ERROR(actionName)}\nFactory returned a value which is not an action.`
export const INVALID_DECORATING_ACTION_FACTORY_EXECUTED = (actionName, type) => `${type || ""} ${ACTION_EXEC_ERROR(actionName)}\nFactory returned a value which is not an action.`

