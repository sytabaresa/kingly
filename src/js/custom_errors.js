// SOURCE : http://www.bennadel.com/blog/2828-creating-custom-error-objects-in-node-js-with-error-capturestacktrace.htm
// Cf. also, http://stackoverflow.com/questions/1382107/whats-a-good-way-to-extend-error-in-javascript/27925672#27925672
//   answer by Ruben Verborgh, it seems the best
function require_custom_errors(utils, _) {
    var log = utils.log;

    function AppErrorToString(error) {
        log(error.stack);
        error.type && log("Type: ", error.type);
        error.message && log("Message: " + error.message);
        error.detail && log("Detail: ", error.detail);
        error.extendedInfo && log("Extended Info: ", error.extendedInfo);
        error.errorCode && log("Error Code: " + error.errorCode);
    }

    // I create the new instance of the AppError object, ensureing that it properly
    // extends from the Error class.
    function _createAppError(settings, type) {
        // NOTE: We are overriding the "implementationContext" so that the createAppError()
        // function is not part of the resulting stacktrace.
        var fnToString = AppErrorToString;
        fnToString.type = type;
        return ( new AppError(settings, fnToString, _createAppError) );
    }

    function createAppError(type) {
        return function (settings) {
            return _createAppError(settings, type);
        }
    }

    // I am the custom error object for the application. The settings is a hash of optional
    // properties for the error instance:
    // --
    // * type: I am the type of error being thrown.
    // * message: I am the reason the error is being thrown.
    // * detail: I am an explanation of the error.
    // * extendedInfo: I am additional information about the error context.
    // * errorCode: I am a custom error code associated with this type of error.
    // --
    // The implementationContext argument is an optional argument that can be used to trim
    // the generated stacktrace. If not provided, it defaults to AppError.
    function AppError(settings, fnToString, implementationContext) {
        // Ensure that settings exists to prevent refernce errors.
        if (typeof(settings) === 'string') {settings = {message: settings}}
        settings = settings || {};

        // Override the toString function
        this.toString = fnToString.bind(this);
        // Override the default name property (Error). This is basically zero value-add.
        this.name = fnToString.type || "AirRxError";

        // Since I am used to ColdFusion, I am modeling the custom error structure on the
        // CFThrow functionality. Each of the following properties can be optionally passed-in
        // as part of the Settings argument.
        // --
        // See CFThrow documentation: https://wikidocs.adobe.com/wiki/display/coldfusionen/cfthrow
        // this.type = ( settings.type || "Application" );
        this.message = ( settings.message || "An error occurred." );
        this.detail = ( settings.detail || "" );
        this.extendedInfo = ( settings.extendedInfo || "" );
        this.errorCode = ( settings.errorCode || "" );

        // This is just a flag that will indicate if the error is a custom AppError. If this
        // is not an AppError, this property will be undefined, which is a Falsey.
        this.isAppError = true;

        // Capture the current stacktrace and store it in the property "this.stack". By
        // providing the implementationContext argument, we will remove the current
        // constructor (or the optional factory function) line-item from the stacktrace; this
        // is good because it will reduce the implementation noise in the stack property.
        // --
        // Read More: https://code.google.com/p/v8-wiki/wiki/JavaScriptStackTraceApi#Stack_trace_collection_for_custom_exceptions
        Error.captureStackTrace(this, ( implementationContext || AppError ));
        fnToString(this);
    }

    _.inherit(AppError, Error);

    // custom tryCatch function to catch errors before deciding on action
    function tryCatcherGen(tryCatchTarget) {
        return function tryCatcher() {
            try {
                return tryCatchTarget.apply(this, arguments);
            } catch (e) {
                return e;
            }
        };
    }

    var tryCatch = function tryCatch(fn) {
        if (typeof(fn) !== 'function') { throw new TypeError('fn must be a function'); }
        return tryCatcherGen(fn);
    };

    return {
        tryCatch: tryCatch,
        SM_Error: createAppError('SM_Error')
    }
}
