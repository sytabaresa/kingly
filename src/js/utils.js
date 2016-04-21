define(function (require) {
  var Rx = require('rx');
  var _ = require('lodash');
  var constants = require('constants');
  const LOG_CLONE_OBJECTS = false;
  var clone_deep = LOG_CLONE_OBJECTS ? _.cloneDeep : function (x) {
    return x
  };
  return require_utils(Rx, _, clone_deep, constants);
});

function require_utils(Rx, _, clone_deep, constants) {
  // Set Rx error option to visualize extra stack trace information
  Rx && (Rx.config) && (Rx.config.longStackSupport = true);

  var CHECK_TYPE = constants.CHECK_TYPE;

  _.mixin({
    'inherit': function (child, base, props) {
      child.prototype = _.create(base.prototype, _.assign({
        '_super': base.prototype,
        'constructor': child
      }, props));
      return child;
    }
  });

  function identity(x, y) {
    return x
  }

  function sum(a, b) {
    return 0 + a + b;
  }

  function wrap(str) {
    return ['-', str, '-'].join("");
  }

  function defer_fn(fn, args) {
    return function () {
      return fn.apply(null, args);
    }
  }

  function compose_fns(fn1, fn2) {
    return function (x) {
      debugger;
      return fn1(fn2(x));
    }
  }

  function always(value) {
    return function () {
      return value
    }
  }

  function log(x) {
    console.log(clone_deep(x));
  }

  function info() {
    var args = args_to_array(arguments);
    console.info.apply(console, args.map(clone_deep));
  }

  function label(action_source) {
    return function prefix_(x) {
      var labelled_obj = {};
      labelled_obj[action_source] = x;
      return labelled_obj
    }
  }

  function get_label(x) {
    return Object.keys(x)[0];
  }

  function clone(obj) {
    return obj ? Object.assign(obj) : undefined;
  }

  function clone_deep(obj) {
    if (typeof(obj) === 'undefined') return undefined;
    var clone_deep_fn = _.cloneDeep.bind(_);
    if ((obj.clone_deep && is_function(obj.clone_deep)) || (obj.cloneDeep && is_function(obj.cloneDeep))) {
      clone_deep_fn = obj.clone_deep ? obj.clone_deep.bind(obj) : obj.cloneDeep.bind(obj);
    }
    return clone_deep_fn(obj);
  }

  function update_prop(obj, prop) {
    return function (value) {
      obj[prop] = value;
    }
  }

  function get_prop(prop) {
    return function (x) {
      return x[prop];
    }
  }

  function rxlog(tag) {
    return function rxlog(x) {
      console.warn(tag, clone_deep(x));
    }
  }

  function noop() {
  }

  function get_timestamp() {
    return new Date();
  }

  // TODO : review that function in line with the display method chosen (ractive, virtual-dom, etc.)
  // In this current implementation:
  // - promises will have to first resolve for a value to be passed to the display method
  // - observable will be passed immediately to the display method
  //   + ractive for example has an adaptor which allows to display observable (promise too but we make the choice not to use it)
  // - other types of object will be passed directly to the display method
  function to_observable(action_result) {
    // Reminder : basic data types
    // Boolean,         Null,         Undefined,         Number,        String
    if (action_result.then) return Rx.Observable.fromPromise(action_result);
    // !! If the action returns an array we do not want to stream that array
    if (action_result.length && action_result.length > 0) return Rx.Observable.return(action_result);
    if (action_result instanceof Rx.Observable) return Rx.Observable.return(action_result);
    if (typeof action_result === 'object'
        || typeof action_result === 'string'
        || typeof action_result === 'number'
        || typeof action_result === 'boolean'
        || typeof action_result === 'undefined'
    ) return Rx.Observable.of(action_result);
    // Else we can't really find a way to convert it to an observable, so we throw an error
    throw 'ERROR: data received from action is of unexpected type!'
  }

  function args_to_array(argument) {
    return Array.prototype.slice.call(argument);
  }

  // Inspired from lodash.merge v4, but allowing to merge undefined values
  // merge({ p : {} }, { p : { q: undefined }}) --> { p : { q: undefined }}
  function merge(object, sources) {
    var args = Array.prototype.slice.call(arguments);
    var customizer_fn = function (destValue, srcValue, key, destParent) {
      if (srcValue === undefined) destParent[key] = undefined;
      // NOTE : could also be delete destParent[key] to remove the property
    };
    args.push(customizer_fn);
    return _.mergeWith.apply(null, args);
  }

  /**
   * Returns the name of the function as taken from its source definition.
   * For instance, function do_something(){} -> "do_something"
   * @param fn {Function}
   * @returns {String}
   */
  function get_fn_name(fn) {
    var tokens =
        /^[\s\r\n]*function[\s\r\n]*([^\(\s\r\n]*?)[\s\r\n]*\([^\)\s\r\n]*\)[\s\r\n]*\{((?:[^}]*\}?)+)\}\s*$/
            .exec(fn.toString());
    return tokens[1];
  }

  function new_typed_object(type, obj) {
    if (!type) throw 'new_typed_object : expected truthy type!'
    if (!obj) throw  'new_typed_object : expected truthy object!'
    var typed_obj = clone_deep(obj);
    typed_obj.__type = type;
    return typed_obj;
  }

  /**
   * Checks that a function's arguments have the expected types.
   * For instance :
   * - function_name :: type_name -> ?type_name -> !type_name
   * - type_name : string identifier for the type (cannot start with ? or !).
   *               The checked value cannot be null or undefined (but can be false)
   * - ?type_name : for a type check which accept undefined values
   * - !type_name : for a type check which accept undefined or null values
   * Some test prep:
   *     var CHECK_TYPE = true;
   *     function test_fn(a_number, a_string, a_boolean, nullable, undefinable, hash_Number, hash___type){
   *     var str_signature = 'test_fn :: number -> string -> boolean -> ?any -> !any -> HTMLElement -> test_type'
   *     assert_signature(str_signature, arguments);
   *     }
   *     test_fn(3, 'e', false, undefined, null, document.body, {__type : 'test_type'});
   * @param str_signature Signature for the checked function
   * @param arr_args
   * @throws
   */
  function assert_signature(str_signature, arr_args) {
    if (CHECK_TYPE) {
      var hash_errors = [];
      var arr_parameter_names = get_parameter_name_list(arguments.callee.caller);
      console.log('arr_parameter_names', arr_parameter_names);

      // get the function name
      var double_colon_split = str_signature.split('::');
      var function_name = double_colon_split[0].trim();
      if (double_colon_split.length === 1 || function_name === '') throw 'Expecting a function name for the function to be type checked!';
      var type_split = double_colon_split[1].split('->');
      if (type_split.length === 1) throw 'Expecting at least two types connected by an arrow for the function to be type checked!';
      type_split.forEach(function (type, index) {
        debugger;
        type = type.trim();
        if (type === '' || type === '?' || type === '!') throw 'Expecting types to be at least one character';
        var first_char = type.charAt(0);
        var type_name = (first_char === '?' || first_char === "!") ? type.substring(1) : type;
        var is_check_undefined = first_char === '?';
        var is_check_null = first_char === '!';
        var parameter_name = arr_parameter_names[index];
        var argument = arr_args[index];
        console.log('type name', type_name);
        console.log('parameter_name', parameter_name);
        console.log('argument', argument);

        if (!check_type(argument, type_name, is_check_undefined, is_check_null)) {
          var undefined_clause = is_check_undefined ? 'or undefined' : '';
          var null_clause = is_check_null ? 'or null' : '';
          var found_clause = is_undefined(argument) ? 'undefined'
              : is_null(argument) ? 'null' : '';
          hash_errors[parameter_name] = [
            'Wrong type for parameter', parameter_name,
            '. Expected type', type_name, undefined_clause, null_clause,
            '. Found :', argument, found_clause
          ].join(' ');
        }
      });

      if (is_empty(hash_errors)) {
        return true;
      }
      else {
        console.error('assert_signature failed :', hash_errors);
        var error_string = _.reduce(hash_errors, function (result, error_msg, parameter_name) {
          return result + error_msg + '\n';
        }, '');
        throw error_string;
      }
    }
  }

  /**
   * Examples of tests
   * 'function (a,b,c)...' // returns ["a","b","c"]
   * 'function ()...' // returns []
   * 'function named(a, b, c) ...' // returns ["a","b","c"]
   * 'function (a /* = 1 ** = true ) ...' // returns ["a","b"]
   * 'function fprintf(handle, fmt /*, ...) ...' // returns ["handle","fmt"]
   * 'function( a, b = 1, c )...' // returns ["a","b","c"]
   * 'function (a=4*(5/3), b) ...' // returns ["a","b"]
   * 'function (a /* fooled you...' // returns ["a","b"]
   * 'function (a /* function() yes , \n /* no, b)/* omg! ...' // returns ["a","b"]
   * 'function ( A, b \n ,c ,d \n ) \n ...' // returns ["A","b","c","d"]
   * 'function (a,b)...' // returns ["a","b"]
   * 'function $args(f) ...' // returns ["f"]
   * 'null...' // returns ["null"]
   * 'function Object() ...' // returns []
   * @param func
   * @returns {Array.<T>}
   */
  function get_parameter_name_list(func) {
// NOTE : taken verbatim from http://stackoverflow.com/questions/1007981/how-to-get-function-parameter-names-values-dynamically-from-javascript
    return (func + '').replace(/\s+/g, '')
        .replace(/[/][*][^/*]*[*][/]/g, '') // strip simple comments
        .split('){', 1)[0].replace(/^[^(]*[(]/, '') // extract the parameters
        .replace(/=[^,]+/g, '') // strip any ES6 defaults
        .split(',').filter(Boolean); // split & filter [""]
  }

  function is_null(obj) {
    return (obj === null && typeof obj === "object")
  }

  function is_undefined(obj) {
    return typeof obj === "undefined"
  }

  function is_empty(obj) {
    return !(obj && Object.keys(obj).length)
  }

  function is_function(obj) {
    return typeof(obj) === 'function';
  }

  function is_object(obj) {
    // Cf. http://stackoverflow.com/questions/8511281/check-if-a-variable-is-an-object-in-javascript
    return obj === Object(obj);
  }

  /**
   * Returns false if the argument passed as parameter fail type checking
   * @param argument
   * @param {String} type_name
   * @param {Boolean} is_check_undefined A value of `true` means that the value undefined passes the type checking
   * @param {Boolean} is_check_null
   * @returns Boolean Returns true if the argument passes the type checking
   */
  function check_type(argument, type_name, is_check_undefined, is_check_null) {
    if (is_check_undefined && is_undefined(argument)) return true;
    if (is_check_null && is_null(argument)) return true;
    // TODO : complete the logic, for now we use the __type field
    // TODO : also does not discriminate array and regexp (there are seen as regular objects)
    if (is_object(argument)) {
      return ((typeof argument === type_name)
      || is_type_in_prototype_chain(argument, type_name)
      || (argument && argument.__type === type_name));
    }
    else {
      // primitive type (!! null and undefined are primitive types too)
      if (typeof argument === "undefined") return false;
      if (argument === null && typeof argument === "object") return false;
      return typeof argument === type_name;
    }
  }

  function is_type_in_prototype_chain(object, type) {

    var curObj = object,
        inst_of,
        aTypes;

    if (typeof type !== 'string' && typeof type.length === 'undefined') {
      // neither array nor string
      throw 'is_type_in_prototype_chain: wrong parameter type for parameter type: expected string or array'
    }
    aTypes = (typeof type === 'string') ? [type] : type;

    //check that object is of type object, otherwise it is a core type, which is out of scope
    // !! : null has type 'object' but is in no prototype chain
    if ('object' !== typeof object || object === null) {
      return false;
    }

    do {
      inst_of = get_constructor_name(Object.getPrototypeOf(curObj));
      curObj = Object.getPrototypeOf(curObj);
    }
    while (inst_of !== 'Object' && aTypes.indexOf(inst_of) === -1);
    return (aTypes.indexOf(inst_of) !== -1);
  }

  function get_constructor_name(object) {
    // NOTE : that would fail in case of function /*asdas*/ name()
    return get_fn_name(object.constructor);
  }

  return {
    identity: identity,
    sum: sum,
    wrap: wrap,
    log: log,
    info: info,
    label: label,
    get_label: get_label,
    to_observable: to_observable,
    clone: clone,
    update_prop: update_prop,
    rxlog: rxlog,
    always: always,
    defer_fn: defer_fn,
    compose_fns: compose_fns,
    args_to_array: args_to_array,
    get_prop: get_prop,
    get_timestamp: get_timestamp,
    clone_deep: clone_deep,
    noop: noop,
    is_function: is_function,
    is_object: is_object,
    is_empty: is_empty,
    is_null: is_null,
    is_undefined: is_undefined,
    merge: merge,
    get_fn_name: get_fn_name,
    new_typed_object: new_typed_object,
    assert_signature : assert_signature
  }
}
