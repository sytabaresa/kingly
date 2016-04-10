/*

 ractive-adaptors-rxjs
 ======================

 Version 0.1.0.

 RxJS adaptor for Ractive

 ==========================

 Troubleshooting: If you're using a module system in your app (AMD or
 something more nodey) then you may need to change the paths below,
 where it says `require( 'ractive' )` or `define([ 'ractive' ]...)`.

 ==========================

 Usage: Include this file on your page below Ractive, e.g:

 <script src='lib/ractive.js'></script>
 <script src='lib/rxjs.js'></script>
 <script src='lib/ractive-adaptors-rxjs.js'></script>

 Or, if you're using a module loader, require this module:

 // requiring the plugin will 'activate' it - no need to use
 // the return value
 require( 'ractive-adaptors-rxjs' );

 Then, tell Ractive to use the `RxJS` adaptor:

 ractive = new Ractive({
 el: 'body',
 template: myTemplate,
 adapt: 'RxJS',
 data: {
 foo: someReactiveProperty
 }
 });

 */

(function (global, factory) {

    'use strict';

    // Common JS (i.e. browserify) environment
    if (typeof module !== 'undefined' && module.exports && typeof require === 'function') {
        factory(require('ractive', 'rx'));
    }

    // AMD?
    else if (typeof define === 'function' && define.amd) {
        define([ 'ractive', 'rx' ], factory);
    }

    // browser global
    else if (global.Ractive && global.Rx) {
        factory(global.Ractive, global.Rx);
    }

    else {
        throw new Error('Could not find Ractive and RxJS! They must be loaded before the ractive-adaptors-rxjs plugin');
    }

}(typeof window !== 'undefined' ? window : this, function (Ractive, Rx) {

    'use strict';

    Ractive.adaptors.RxJS = {
        filter: function (object) {
            return object && (typeof object.subscribe === 'function');
        },
        wrap: function (ractive, observable, keypath, prefixer) {
            var currentValue;

            // set initial state
            ractive.set(keypath, {});
            update({ pending: true });

//            const defaultValue = 'no value passed yet'; // supposed to be a parameter passed somehow to the adaptor
//            var currentValue = defaultValue;
//            var currentObservable = observable;
//            update(currentValue);

            function update(obj) {
                currentValue = obj.value;
                ractive.set(keypath, prefixer(obj));
            }

            console.log('creating adapter');

            // set initial state
            // ractive.set(keypath, {});
            var subscription = Rx.Observable.merge(
                Rx.Observable.return({}).withLatestFrom(observable, function (_, value) {
                    update({ pending: void 0, value: value});
                }),
                observable)
                .subscribe(onNextUpdate, onErrorUpdate, onCompletedUpdate);

            function onNextUpdate(value){
                console.log('onNext', value);
                update({ pending: void 0, value: value});
            }

            function onErrorUpdate(value){
                update({ pending: void 0, error : value});
            }

            function onCompletedUpdate(){
                update({ pending: void 0, completed : true});
            }

            return {
                get: function () {
                    console.log('get called');
                    return currentValue;
                },
                // The `set()` method is called when you do `ractive.set()`, if the keypath
                // is _downstream_ of the wrapped object. So if, for example, you do
                // `ractive.set( 'boxes[0].width', 10 )`, this `set()` method will be called
                // with 'width' and 10 as arguments.
                // NOTE : There is no downstream path in the case of a stream!
                set : function(){
                    console.log('set called', arguments);
                },
                // The `reset()` method is called when you do `ractive.set()`, if the keypath
                // is _identical_ to the keypath of the wrapped object. Two things could happen
                // - the wrapped object could modify itself to reflect the new data,
                // or (if it doesn't know what to do with the new data) it could return `false`, in which
                // case it will be torn down.
                reset: function (value) {
                    console.log('reset called', value);
                    if (this.updating) {
                        return;
                    }
                    this.updating = true;
                    // TODO how do you set the value of a Rx.Observable?!
                    this.updating = false;

                    //!!! If I return true here, the updates do not take place anymore,
                    // but according to the doc, I should return true (update is done automatically by the observer)
                    return false;
                },
                teardown: function () {
                    console.log('disposing subscription', subscription);
                    // subscription.dispose();
                }
            };
        }
    };

}));
