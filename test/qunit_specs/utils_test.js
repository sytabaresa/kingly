define(function (require) {
  const DUMMY = 'dummy', DUMMY_FIELD = 'dummy_field', DUMMY_EVENT_DATA_VALUE = 24, DUMMY_ERROR = 'dummy error';
  var utils = require('utils');
  var Err = require('custom_errors');
  var fsm = require('asynchronous_fsm');
  var fsm_helpers = require('fsm_helpers');
  var constants = require('constants');

  QUnit.module("utils", {
    // NOTE : this is a curried function to which parameters are applied
    // We test the curried function by running through a set of parameters
  });

  QUnit.test("merge (object, sources)", function (assert) {
    var obj = {key1: 'value1', key2: {key21: 'value21'}, key3: {key4: {key5: 'value41'}}, key6: undefined};
    var obj_update = {"-key2-": {keyNew: 'valueNew'}, key3: {"-key4-": undefined}};
    var expected_updated_obj = {
      "key1": "value1",
      "key2": {"keyNew": "valueNew"},
      "key3": {"key4": undefined},
      key6 : undefined
    };
    utils.merge(obj, obj_update);
    assert.deepEqual(obj, expected_updated_obj, 'keys whose values are to be entirely replaced are wrapped in "-" characters.');
  });

});
