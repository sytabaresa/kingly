define(function (require) {
  var Rx = require('rx');
  var _ = require('lodash');
  var Err = require('custom_errors');
  var constants = require('constants');
  return require_utils(Rx, _, Err, constants);
});

function require_utils(Rx, _, Err, constants) {
  // Set Rx error option to visualize extra stack trace information
  Rx && (Rx.config) && (Rx.config.longStackSupport = true);

  var CHECK_TYPE = constants.CHECK_TYPE;

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

  function and(fn1, fn2) {
    return function and() {
      return fn1.apply(null, arguments) && fn2.apply(null, arguments);
    }
  }

  function or(fn1, fn2) {
    return function or() {
      return fn1.apply(null, arguments) || fn2.apply(null, arguments);
    }
  }

  function not(fn) {
    return function not() {
      return !fn.apply(null, arguments);
    }
  }

  function always(value) {
    return function always() {
      return value;
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
    var clone_deep_fn;

    if (typeof(obj) === 'undefined') return undefined;
    if (typeof(obj) === 'function') return obj;
    if (is_null(obj)) return obj;
    if ((obj.clone_deep && is_function(obj.clone_deep)) || (obj.cloneDeep && is_function(obj.cloneDeep))) {
      clone_deep_fn = obj.clone_deep ? obj.clone_deep.bind(obj) : obj.cloneDeep.bind(obj);
    } else {
      clone_deep_fn = _.cloneDeep.bind(_);
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

  function emits(label) {
    return function (x) {console.log.call(console, label, x)}
  }

  function noop() {
  }

  function get_timestamp() {
    return new Date();
  }

  // In this current implementation:
  // - promises are turned into observables
  // - observables are reduced to their first value (i.e. forced up to a promise) (by coherence with treatment of drivers)
  // - other types of values are wrapped into a single value observable
  function to_observable(effect_result) {
    // Reminder : basic data types
    // Boolean,         Null,         Undefined,         Number,        String
    if (is_promise(effect_result)) return Rx.Observable.fromPromise(effect_result);
    if (is_observable(effect_result)) return effect_result.first();
    if (effect_result instanceof Error) return Rx.Observable.return(Err.Effect_Error(effect_result));
    return Rx.Observable.return(effect_result);
  }

  function to_error(e, error_constructor) {
    return e instanceof Error
        ? e
        : error_constructor ? new error_constructor(e) : new Error(e);
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
            .exec(fn.toString())
          // For some reasons the previous regexp does not work with function of two parameters
          // But this one does not filter out possible comments in between `function` and function name...
        || fn.toString().match(/function ([^\(]+)/)
    return tokens[1];
  }

  function new_typed_object(obj, type) {
    if (!type) throw 'new_typed_object : expected truthy type!'
    if (!obj) throw  'new_typed_object : expected truthy object!'
    var current_types = obj.__type;
    // duplicate the array of types (passed by reference, here we want passed by values)
    current_types = current_types ? obj.__type.slice() : [];
    if (current_types.indexOf(type) === -1) {
      // type not in the array yet
      current_types.push(type);
    }
    var typed_obj = clone_deep(obj);
    typed_obj.__type = current_types;
    return typed_obj;
  }

  function has_custom_type(obj, custom_type) {
    // assert_signature('has_custom_type :: object -> string', arguments);
    var parsed_string = parse_type_string(custom_type);
    if (parsed_string.is_check_null && is_null(obj)) return true;
    if (parsed_string.is_check_undefined && is_undefined(obj)) return true;

    return obj.__type.indexOf(parsed_string.type_name) > -1;
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

      // get the function name
      var double_colon_split = str_signature.split('::');
      var function_name = double_colon_split[0].trim();
      if (double_colon_split.length === 1 || function_name === '') throw 'Expecting a function name for the function to be type checked!';
      var type_split = double_colon_split[1].split('->');
      // TODO : deal with the case of function :: () - what ius the poit of type checking a function without arguments??
      // if (type_split.length === 1) throw 'Expecting at least two types connected by an arrow for the function to be type checked!';
      type_split.forEach(function (type, index) {
        type = type.trim();
        // NOTE : not including type === '*' as the joker character is used alone
        if (type === '' || type === '?' || type === '!') throw 'Expecting types to be at least one character';
        var parsed_type_string = parse_type_string(type);
        var type_name = parsed_type_string.type_name;
        var is_check_undefined = parsed_type_string.is_check_undefined;
        var is_check_null = parsed_type_string.is_check_null;
        var is_check_any = parsed_type_string.is_check_any;
        var parameter_name = arr_parameter_names[index];
        var argument = arr_args[index];

        if (!assert_type(argument, type_name, undefined, is_check_undefined, is_check_null, is_check_any)) {
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

  function parse_type_string(type_string) {
    var first_char = type_string.charAt(0);
    return {
      type_name: (first_char === '?' || first_char === "!" || first_char === "*") ? type_string.substring(1) : type_string,
      is_check_undefined: first_char === '?',
      is_check_null: first_char === '!',
      is_check_any: first_char === '*'
    }
  }

  function assert_custom_type(obj, type, error_msg) {
    if (CHECK_TYPE) {
      if (!has_custom_type(obj, type)) {
        console.error('assert_custom_type : expected type ' + type + ' for object ', obj);
        throw ['assert_custom_type : expected type ' + type + ' for object ' + obj, error_msg].join('\n');
      }
    }
  }

  /**
   * Returns false if the argument passed as parameter fail type checking
   * @param argument
   * @param {String} type_name
   * @param {Boolean} is_check_undefined A value of `true` means that the value undefined passes the type checking
   * @param {Boolean} is_check_null
   * @returns {*} Returns true if the argument passes the type checking
   * @param error_msg
   * @param is_check_any
   */
  function assert_type(argument, type_name, error_msg, is_check_undefined, is_check_null, is_check_any) {
    if (is_check_any) return true;
    if (is_undefined(argument)) return either(is_check_undefined, error_msg);
    if (is_null(argument)) return either(is_check_null, error_msg);
    // TODO : complete the logic, for now we use the __type field
    // TODO : also does not discriminate array and regexp (there are seen as regular objects)
    if (is_object(argument)) {
      return either(((typeof argument === type_name)
          || is_type_in_prototype_chain(argument, type_name)
          || (argument && has_custom_type(argument, type_name))),
          error_msg);
    }
    else {
      // primitive type (!! null and undefined are primitive types too)
      if (typeof argument === "undefined") return either(false, error_msg);
      if (argument === null && typeof argument === "object") return either(false, error_msg); // obsolete now
      return either(typeof argument === type_name, error_msg);
    }
  }

  function either(bool, error_msg) {
    if (!bool && error_msg) throw_err(error_msg);
    return bool;
  }

  function throw_err(error_msg) {
    console.error(error_msg);
    throw (Err[error_msg.type] || Err.SM_Error)(error_msg);
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

  function is_promise(obj) {
    // NOTE: very simple duck-typing test for now
    return obj && !!obj.then;
  }

  function is_observable(obj) {
    // NOTE: very simple duck-typing test for now - suits Rxjs 4, 5
    return obj && !!obj.subscribe;
  }

  function is_array(obj) {
    return Array.isArray(obj);
  }

  /**
   * Creates and register a registry with the configuration passed as parameters. The registry implements an interface
   * with default implementation which can be modified through methods passed in the configuration object.
   *
   * @param {String | Object} reg_config
   * @param {String} reg_config.name
   * @param {function (String)} [reg_config.validate_key] Takes a key and returns a validated key or throws a registry exception. By default, is the identity function.
   * @param {function (String)} [reg_config.validate_value] Takes a value and returns a validated value or throws a registry exception. By default, is the identity function.
   * @param {Boolean} [reg_config.overwrite=false]  If false, attempt to set a value for a key already present in the registry results in an exception
   * @param {Boolean} [reg_config.silent_validation=false] If true, in a `add` operation, when a key/value fails validation no exception is raised, and registry is not updated
   * @param {Boolean} [reg_config.silent_delete=false] If false, raises an exception when attempting to delete a key which does not exist
   * @param {String} [reg_config.overwrite_error_message] Contains the exception message in case of forbidden overwrite
   * @param {function set(*, String, *)} [reg_config.set] Function with signature (registry, config, key, value)
   * @param {function get(*, String, *)} [reg_config.get] Function with signature (registry, config, key)
   * @param {function remove(*, String, *)} [reg_config.remove] Function with signature (registry, config, key)
   * @param {function has_key(*, Object, String)} [reg_config.has_key]
   * @returns {{}}
   */
  function make_registry(reg_config) {
    var reg_proto = {};
    // NOTE : in default implementations, undefined is used to mark for deletion, null and false are considered
    // normal key values
    var fn_has_key_default = function fn_has_key(registry, key) {
          return !is_undefined(registry[key]);
        },
        fn_add_default = function add(/*OUT*/registry, key, value) {
          registry[key] = value;
        },
        fn_remove_default = function remove(/*OUT*/registry, key) {
          registry[key] = undefined;
        },
        fn_get_default = function get_key(registry, key) {
          return registry[key];
        };

    reg_proto.add_entry = function addEntry(/*OUT*/reg, full_reg_config, key, value) {
      var validate_key = full_reg_config.validate_key,
          validate_value = full_reg_config.validate_value,
          fn_has_key = full_reg_config.fn_has_key,
          fn_set = full_reg_config.fn_set,
          registry = reg.registry;
      var validated_key = Err.try_catch(validate_key)(key);
      if (validated_key instanceof Error) {
        if (full_reg_config.silent_validation) {
          return null;
        }
        throw validated_key;
      }
      var validated_value = Err.try_catch(validate_value)(value);
      if (validated_value instanceof Error) {
        if (full_reg_config.silent_validation) {
          return null;
        }
        throw validated_value;
      }

      if (fn_has_key(registry, validated_key) && !full_reg_config.overwrite) {
        // throw error
        throw Err.Registry_Error({
          message: "Attempted to overwrite an existing key in a non-overwritable registry!",
          extended_info: {registry: registry, key: key, validated_key: validated_key, value: value}
        })
      }
      else {
        // set the value in the registry
        fn_set(registry, validated_key, validated_value);
      }
    };

    reg_proto.get_entry = function get_entry(/*OUT*/reg, full_reg_config, key) {
      var validate_key = full_reg_config.validate_key,
          fn_has_key = full_reg_config.fn_has_key,
          fn_get = full_reg_config.fn_get,
          registry = reg.registry;
      var validated_key = validate_key(key);

      return fn_has_key(registry, validated_key)
          ? fn_get(registry, validated_key)
          : undefined
    };

    reg_proto.remove_entry = function remove_entry(/*OUT*/reg, full_reg_config, key) {
      var validate_key = full_reg_config.validate_key,
          fn_has_key = full_reg_config.fn_has_key,
          fn_remove = full_reg_config.fn_remove,
          registry = reg.registry;
      var validated_key = validate_key(key);

      if (!fn_has_key(registry, validated_key)) {
        if (!full_reg_config.silent_delete) {
          // If the key to delete do not exist and we asked (config) to not swallow the edge case, then raise an error
          throw Err.Registry_Error({
            message: "Attempted to remove a key which does not exist in the corresponding registry!",
            extended_info: {registry: registry, key: key, validated_key: validated_key}
          })
        }
        return null;
      }
      else {
        // set the value in the registry
        fn_remove(registry, validated_key);
      }
    };

    reg_proto.has_key = function has_key(reg, full_reg_config, key) {
      return full_reg_config.fn_has_key(reg.registry, full_reg_config.validate_key(key));
    };

    var full_reg_config = {
      validate_key: reg_config.validate_key || identity, // validate_key :: key -> validated_key | Registry_Error
      validate_value: reg_config.validate_value || identity, // validate_value :: value -> validated_value | Registry_Error
      overwrite: reg_config.overwrite || false,
      silent_validation: reg_config.silent_validation || false,
      silent_delete: reg_config.silent_delete || false,
      overwrite_error_message: reg_config.overwrite_error_message || "Tried to overwrite a registry with " +
      "an entry whose key is already present : cannot overwrite!",
      fn_set: reg_config.set || fn_add_default,
      fn_get: reg_config.get || fn_get_default,
      fn_has_key: reg_config.has_key || fn_has_key_default,
      fn_remove: reg_config.remove || fn_remove_default
    };

    var new_reg = {};
    new_reg.registry = {};
    new_reg.set = reg_proto.add_entry.bind(new_reg, new_reg, full_reg_config);
    new_reg.get = reg_proto.get_entry.bind(new_reg, new_reg, full_reg_config);
    new_reg.remove = reg_proto.remove_entry.bind(new_reg, new_reg, full_reg_config);
    new_reg.has_key = reg_proto.has_key.bind(new_reg, new_reg, full_reg_config);

    return new_reg;
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
    to_error: to_error,
    clone: clone,
    update_prop: update_prop,
    rxlog: rxlog,
    always: always,
    defer_fn: defer_fn,
    compose_fns: compose_fns,
    and: and,
    or: or,
    not: not,
    noop: noop,
    args_to_array: args_to_array,
    get_prop: get_prop,
    get_timestamp: get_timestamp,
    clone_deep: clone_deep,
    is_function: is_function,
    is_object: is_object,
    is_promise: is_promise,
    is_observable: is_observable,
    is_array: is_array,
    is_empty: is_empty,
    is_null: is_null,
    is_undefined: is_undefined,
    merge: merge,
    get_fn_name: get_fn_name,
    new_typed_object: new_typed_object,
    assert_signature: assert_signature,
    assert_custom_type: assert_custom_type,
    assert_type: assert_type,
    has_custom_type: has_custom_type,
    make_registry: make_registry
  }
}

/**
 @typedef p_url_seg
 @type {Object}
 @property {String} url_seg xxx
 @property {Object} [qry_seg] xxx
 @property {Object} [obj_seg] xxx
 @property {String} [hash] xxx
 Example : {}
 */
