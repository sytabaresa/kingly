define(function (require) {
  const DUMMY = 'dummy', DUMMY_FIELD = 'dummy_field', DUMMY_EVENT_DATA_VALUE = 24, DUMMY_ERROR = 'dummy error';
  var utils = require('utils');
  var Err = require('custom_errors');
  var fsm = require('asynchronous_fsm');
  var fsm_helpers = require('fsm_helpers');
  var constants = require('constants');
  var Hashmap = require('hashmap');

  QUnit.module("utils", {
    // NOTE : this is a curried function to which parameters are applied
    // We test the curried function by running through a set of parameters
  });

  QUnit.test("Data structures - Hashmap", function (assert) {
    var map = new Hashmap(undefined, {enable_set_data_structure: true});
    assert.throws(function(){
      var key = {};
      var key2 = {};
      map.set(key, 123);
      map.set(key2, 321);
      map.forEach(function(value, key) {
        console.log(key + " : " + value);
      });
    }, 'With enable_set_data_structure set to true, an exception is thrown if the key is already in the hashmap')

    map2 = new Hashmap(undefined, {enable_set_data_structure: false});
    var key = {};
    var key2 = {};
    map2.set(key, 123);
    map2.set(key2, 321);
    map2.forEach(function(value, key) {
      console.log(key + " : " + value);
    });
    var value = map2.get({});
    assert.ok(true, 'With enable_set_data_structure set to false, two identical keys with different values can be stored in the hash. `get` must be called with the same exact object than `set` was called with.')
  });
});
