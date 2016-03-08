// For any third party dependencies, like jQuery, place them in the lib folder.

// Configure loading modules from the lib directory,
// except for 'app' ones, which are in a sibling
// directory.
requirejs.config({
    //By default load any module IDs from js/lib
    deps: [ // but here the path for `require` dependencies is still relative to the `index.html`
        'qunit_specs/dummy_test.js',
    ],
    baseUrl: '../src/js', //here the path for required modules is relative to the index.html folder in which requirejs is loaded
    // NOTE: for Qunit in conjunction with require, cf. http://jonnyreeves.co.uk/2012/modular-javascript-unit-testing-with-qunit-and-requirejs/
    //       https://github.com/jonnyreeves/qunit-require
    //except, if the module ID starts with "app",
    //load it from the js/app directory. paths
    //config is relative to the baseUrl, and
    //never includes a ".js" extension since
    //the paths config could be for a directory.
    paths: {
        jquery: 'vendor/jquery-1.12.0',
        bootstrap: 'vendor/bootstrap',
        rx: 'vendor/rx.all',
        cycle: 'vendor/cycle',
        ractive: 'vendor/ractive',
        'ra-adpt-rxjs': 'vendor/ractive-adaptors-rxjs',
        'ra-adpt-promise-alt': 'vendor/ractive-promise-alt',
        'ra-decorator-bootstrap': 'vendor/ractive-bootstrap',
        'ra-decorator-tooltip': 'js/vendor/ractive-tooltip.min',
        'ra-decorator-spoilerboc': 'vendor/ractive-decorators-spoilerBox',
        'lodash': 'vendor/lodash'
        //    <script src="js/utils.js"></script>
        //    <script src="js/custom_errors.js"></script>
        //    <script src="js/asynchronous_fsm.js"></script>
        //    <script src="js/cd_player_api.js"></script>
        //    <script src="js/cd_player_state_chart.js"></script>
        //    <script src="js/cd_player_view.js"></script>
        //    <script src="js/cycle_fsm.js"></script>
    }
});

// Start loading the main app file. Put all of
// your application logic in there.
// path is relative to baseURL this time
requirejs(['../../test/main']);
