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
// TODO: check consequences of moving it to empty array
export const NO_OUTPUT = [];
export const ACTION_IDENTITY = function ACTION_IDENTITY(){
  return {
    outputs : NO_OUTPUT,
    updates : NO_STATE_UPDATE
  }
}
export const history_symbol = {};
export const SHALLOW = 'shallow';
export const DEEP = 'deep';

export const WRONG_EVENT_FORMAT_ERROR = `The machine received an event which does not have the proper format. Expecting an object whose unique key is the event name, and value is the event data.`
export const FUNCTION_THREW_ERROR = (fnName, type) => `Exception thrown when executing ${type} ${fnName||""}`
export const INVALID_ACTION_FACTORY_EXECUTED = (actionName, type) => `${FUNCTION_THREW_ERROR(actionName, type)}\nThe ${type} returned a value which is not an action.`
export const INVALID_PREDICATE_EXECUTED = (actionName, type) => `${FUNCTION_THREW_ERROR(actionName, type)}\nThe ${type} returned a value which is not a boolean.`
export const ACTION_FACTORY_DESC = `action factory`
export const ENTRY_ACTION_FACTORY_DESC = `(decorating) entry action`
export const UPDATE_STATE_FN_DESC = `update state function`
export const PREDICATE_DESC = `predicate`

export const COMMAND_RENDER = 'render'

export const CONTRACTS_EVAL = "CONTRACTS_EVAL";

// Kuker related
//
// That's the event.type to pass kuker to have indentation
// cf. https://github.com/krasimir/kuker-emitters/blob/master/src/MobXEmitter.js#L16
// https://github.com/krasimir/kuker/blob/master/src/kuker-ui/components/Dashboard/Handlers/MobX.js
// displays mobxRvent.object stringify
// beeware it is emit(type, state, event (mobxEvent then))
// event.type can be error or many things... none of which is really good except when unrecognized (jus label printed)
const MOBX = '@mobx';
// This is to have event data displayed in small font next to bold event label
// cf. https://github.com/krasimir/kuker/blob/master/src/kuker-ui/components/Dashboard/Handlers/ReduxAction.js
// but no indent, so will have to do MOBX for first send, and REDUX_ACTION for posterior
const REDUX_ACTION= '@redux_ACTION';
// so maybe try firs basic emitter
// icon, color, state, label
// display icon + label or event type
// I will have to stringify the event data and put it in the label...
// alright so the best is to fork...
// but try first with the basic emitter before writing my own
// specially because getting started with content scripts and bundling the js can be a problem
export const OUTPUTS_MSG = "OUTPUTS_MSG";
export const INPUT_MSG = "INPUT_MSG";
export const WARN_MSG = 'WARN_MSG';
export const MACHINE_CREATION_ERROR_MSG = 'MACHINE_CREATION_ERROR_MSG';
export const ERROR_MSG = 'ERROR_MSG';
export const INTERNAL_INPUT_MSG = 'INTERNAL_INPUT_MSG';
export const INTERNAL_OUTPUTS_MSG = 'INTERNAL_OUTPUTS_MSG';
export const DEBUG_MSG = 'DEBUG_MSG';
export const INIT_INPUT_MSG = 'INIT_INPUT_MSG';
