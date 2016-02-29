function require_utils(Rx) {
    Rx.config.longStackSupport = true;

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

    function log(x) {
        console.log(x);
    }

    function label(action_source) {
        return function prefix_(x) {
            var labelled_obj = {};
            labelled_obj[action_source] = x;
            return labelled_obj
        }
    }

    function clone(obj) {
        return Object.assign(obj);
    }

    function update_prop(obj, prop) {
        return function (value) {
            obj[prop] = value;
        }
    }

    function rxlog(tag) {
        return function (x) {
            console.log(tag, x);
        }
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

    return {
        identity: identity,
        sum: sum,
        wrap: wrap,
        log: log,
        label: label,
        to_observable: to_observable,
        clone: clone,
        update_prop: update_prop,
        rxlog: rxlog
    }
}

