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
export const NO_MODEL_UPDATE = [];
// NOTE : this really cannot be anything else than a falsy value, beware
export const NO_OUTPUT = null;
export const default_action_result = {
  model_update: NO_MODEL_UPDATE,
  output: NO_OUTPUT
};

