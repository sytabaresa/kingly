define(function (require) {
  var _ = require('lodash');
  var Err = require('custom_errors');
  var constants = require('constants');
  return require_ractive(_, Err, constants);
});

function require_ractive(_, Err, constants) {

  var temperatures_json = [
    {
      'name': 'London, UK',
      'months': [
        {'high': 7.9, 'low': 2.4},
        {'high': 8.2, 'low': 2.2},
        {'high': 10.9, 'low': 3.8},
        {'high': 13.3, 'low': 5.2},
        {'high': 17.2, 'low': 8},
        {'high': 20.2, 'low': 11.1},
        {'high': 22.8, 'low': 13.6},
        {'high': 22.6, 'low': 13.3},
        {'high': 19.3, 'low': 10.9},
        {'high': 15.2, 'low': 8},
        {'high': 10.9, 'low': 4.8},
        {'high': 8.8, 'low': 3.3}
      ]
    },
    {
      'name': 'San Francisco, CA, US',
      'months': [
        {
          'high': 13.8,
          'low': 7.6
        },
        {
          'high': 15.7,
          'low': 8.6
        },
        {
          'high': 16.6,
          'low': 9.2
        },
        {
          'high': 17.3,
          'low': 9.6
        },
        {
          'high': 17.9,
          'low': 10.6
        },
        {
          'high': 19.1,
          'low': 11.6
        },
        {
          'high': 19.2,
          'low': 12.3
        },
        {
          'high': 20.1,
          'low': 12.8
        },
        {
          'high': 21.2,
          'low': 12.8
        },
        {
          'high': 20.7,
          'low': 12.1
        },
        {
          'high': 17.3,
          'low': 10.1
        },
        {
          'high': 13.9,
          'low': 7.8
        }
      ]
    },
    {
      'name': 'Phoenix, AZ, US',
      'months': [
        {
          'high': 19.7,
          'low': 7.6
        },
        {
          'high': 21.6,
          'low': 9.3
        },
        {
          'high': 25.1,
          'low': 11.9
        },
        {
          'high': 29.7,
          'low': 15.7
        },
        {
          'high': 35,
          'low': 20.7
        },
        {
          'high': 40.1,
          'low': 25.4
        },
        {
          'high': 41.2,
          'low': 28.6
        },
        {
          'high': 40.3,
          'low': 28.2
        },
        {
          'high': 37.8,
          'low': 24.9
        },
        {
          'high': 31.5,
          'low': 18.2
        },
        {
          'high': 24.3,
          'low': 11.4
        },
        {
          'high': 19,
          'low': 7.1
        }
      ]
    },
    {
      'name': 'New York City, NY, US',
      'months': [
        {
          'high': 3.5,
          'low': -2.8
        },
        {
          'high': 5.3,
          'low': -1.7
        },
        {
          'high': 9.8,
          'low': 1.8
        },
        {
          'high': 16.2,
          'low': 7.1
        },
        {
          'high': 21.6,
          'low': 12.2
        },
        {
          'high': 26.3,
          'low': 17.6
        },
        {
          'high': 28.9,
          'low': 20.5
        },
        {
          'high': 28.1,
          'low': 19.9
        },
        {
          'high': 24,
          'low': 16
        },
        {
          'high': 17.7,
          'low': 10
        },
        {
          'high': 12.1,
          'low': 5.3
        },
        {
          'high': 6.1,
          'low': 0
        }
      ]
    },
    {
      'name': 'Buenos Aires, Argentina',
      'months': [
        {
          'high': 30.4,
          'low': 20.4
        },
        {
          'high': 28.7,
          'low': 19.4
        },
        {
          'high': 26.4,
          'low': 17
        },
        {
          'high': 22.7,
          'low': 13.7
        },
        {
          'high': 19,
          'low': 10.3
        },
        {
          'high': 15.6,
          'low': 7.6
        },
        {
          'high': 13.9,
          'low': 7.4
        },
        {
          'high': 17.3,
          'low': 8.9
        },
        {
          'high': 18.9,
          'low': 9.9
        },
        {
          'high': 22.5,
          'low': 13
        },
        {
          'high': 25.3,
          'low': 15.9
        },
        {
          'high': 28.1,
          'low': 18.4
        }
      ]
    },
    {
      'name': 'Sydney, Australia',
      'months': [
        {
          'high': 25.9,
          'low': 18.7
        },
        {
          'high': 25.8,
          'low': 18.8
        },
        {
          'high': 24.7,
          'low': 17.5
        },
        {
          'high': 22.4,
          'low': 14.7
        },
        {
          'high': 19.4,
          'low': 11.5
        },
        {
          'high': 16.9,
          'low': 9.3
        },
        {
          'high': 16.3,
          'low': 8
        },
        {
          'high': 17.8,
          'low': 8.9
        },
        {
          'high': 20,
          'low': 11.1
        },
        {
          'high': 22.1,
          'low': 13.5
        },
        {
          'high': 23.6,
          'low': 15.6
        },
        {
          'high': 25.2,
          'low': 17.5
        }
      ]
    },
    {
      'name': 'Moscow, Russia',
      'months': [
        {
          'high': -4,
          'low': -9.1
        },
        {
          'high': -3.7,
          'low': -9.8
        },
        {
          'high': 2.6,
          'low': -4.4
        },
        {
          'high': 11.3,
          'low': 2.2
        },
        {
          'high': 18.6,
          'low': 7.7
        },
        {
          'high': 22,
          'low': 12.1
        },
        {
          'high': 24.3,
          'low': 14.4
        },
        {
          'high': 21.9,
          'low': 12.5
        },
        {
          'high': 15.7,
          'low': 7.4
        },
        {
          'high': 8.7,
          'low': 2.7
        },
        {
          'high': 0.9,
          'low': -3.3
        },
        {
          'high': -3,
          'low': -7.6
        }
      ]
    },
    {
      'name': 'Berlin, Germany',
      'months': [
        {
          'high': 2.9,
          'low': -1.5
        },
        {
          'high': 4.2,
          'low': -1.6
        },
        {
          'high': 8.5,
          'low': 1.3
        },
        {
          'high': 13.2,
          'low': 4.2
        },
        {
          'high': 18.9,
          'low': 9
        },
        {
          'high': 21.8,
          'low': 12.3
        },
        {
          'high': 24,
          'low': 14.7
        },
        {
          'high': 23.6,
          'low': 14.1
        },
        {
          'high': 18.8,
          'low': 10.6
        },
        {
          'high': 13.4,
          'low': 6.4
        },
        {
          'high': 7.1,
          'low': 2.2
        },
        {
          'high': 4.4,
          'low': -0.4
        }
      ]
    },
    {
      'name': 'Beijing, China',
      'months': [
        {
          'high': 1.8,
          'low': -8.4
        },
        {
          'high': 5,
          'low': -5.6
        },
        {
          'high': 11.6,
          'low': 0.4
        },
        {
          'high': 20.3,
          'low': 7.9
        },
        {
          'high': 26,
          'low': 13.6
        },
        {
          'high': 30.2,
          'low': 18.8
        },
        {
          'high': 30.9,
          'low': 22
        },
        {
          'high': 29.7,
          'low': 20.8
        },
        {
          'high': 25.8,
          'low': 14.8
        },
        {
          'high': 19.1,
          'low': 7.9
        },
        {
          'high': 10.1,
          'low': 0
        },
        {
          'high': 3.7,
          'low': -5.8
        }
      ]
    },
    {
      'name': 'Nairobi, Kenya',
      'months': [
        {
          'high': 24.5,
          'low': 11.5
        },
        {
          'high': 25.6,
          'low': 11.6
        },
        {
          'high': 25.6,
          'low': 13.1
        },
        {
          'high': 24.1,
          'low': 14
        },
        {
          'high': 22.6,
          'low': 13.2
        },
        {
          'high': 21.5,
          'low': 11
        },
        {
          'high': 20.6,
          'low': 10.1
        },
        {
          'high': 21.4,
          'low': 10.2
        },
        {
          'high': 23.7,
          'low': 10.5
        },
        {
          'high': 24.7,
          'low': 12.5
        },
        {
          'high': 23.1,
          'low': 13.1
        },
        {
          'high': 23.4,
          'low': 12.6
        }
      ]
    }
  ];

  var template = [
    /* Ractive.js component styles */
    "    <div data-ractive-css='{4}' class='app' style='height:250px;width:400px'> ",
    "<style type='text/css'>",
    /* {1} */
    ".errors[data-ractive-css~='{1}'], [data-ractive-css~='{1}'] .errors {width:.8em}.error-marker[data-ractive-css~='{1}'], [data-ractive-css~='{1}'] .error-marker {position:relative}.error-marker[data-ractive-css~='{1}']:hover:after, [data-ractive-css~='{1}'] .error-marker:hover:after {content:attr(data-errors);position:absolute;display:block;background-color:#fff;color:#d00;width:20em;font-size:.8em;line-height:1;left:1em;top:1.5em;padding:.5em}",
    /* {2} */
    ".cross[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .cross, .left-nav[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .left-nav {position:absolute;background-color:#fff}.cross[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .cross, .number[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .number {text-align:center}.left-nav[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .left-nav {top:0;left:0;width:17em;height:100%;border-right:1px solid #eee;padding:3.4em 0 0;cursor:pointer;box-shadow:1px 0 3px rgba(0,0,0,.05);-webkit-transition:all .2s cubic-bezier(.02,.91,.29,1);-moz-transition:all .2s cubic-bezier(.02,.91,.29,1);-ms-transition:all .2s cubic-bezier(.02,.91,.29,1);-o-transition:all .2s cubic-bezier(.02,.91,.29,1);transition:all .2s cubic-bezier(.02,.91,.29,1);-webkit-transform:translate3d(-13em,0,0);-moz-transform:translate3d(-13em,0,0);-ms-transform:translate3d(-13em,0,0);-o-transform:translate3d(-13em,0,0);transform:translate3d(-13em,0,0);-webkit-backface-visibility:hidden;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;-o-user-select:none;user-select:none;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;will-change:-webkit-transform,-moz-transform,-ms-transform,-o-transform,transform}.nav-option[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .nav-option, .toggle[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .toggle {-webkit-box-sizing:border-box;-moz-box-sizing:border-box}.open[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .open {-webkit-transform:translate3d(0,0,0);-moz-transform:translate3d(0,0,0);-ms-transform:translate3d(0,0,0);-o-transform:translate3d(0,0,0);transform:translate3d(0,0,0)}.toggle[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .toggle {position:absolute;top:0;left:0;width:100%;height:3.4em;padding:1.2em;border-bottom:1px solid #eee;box-sizing:border-box}.cross[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .cross {font-size:1.4em;line-height:1;right:1.2rem;top:1.2rem;width:1em;height:1em;display:block;-webkit-transform:rotate(0);-moz-transform:rotate(0);-ms-transform:rotate(0);-o-transform:rotate(0);transform:rotate(0);-webkit-transition:-webkit-transform .3s cubic-bezier(.02,.91,.29,1);-moz-transition:-moz-transform .3s cubic-bezier(.02,.91,.29,1);-ms-transition:-ms-transform .3s cubic-bezier(.02,.91,.29,1);-o-transition:-o-transform .3s cubic-bezier(.02,.91,.29,1);transition:transform .3s cubic-bezier(.02,.91,.29,1)}.open  .cross[data-ractive-css~='{2}'], .open  [data-ractive-css~='{2}'] .cross, .open[data-ractive-css~='{2}']  .cross, [data-ractive-css~='{2}'] .open  .cross {-webkit-transform:rotate(315deg);-moz-transform:rotate(315deg);-ms-transform:rotate(315deg);-o-transform:rotate(315deg);transform:rotate(315deg)}.nav-options[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .nav-options {width:100%;height:100%;overflow:auto}.nav-option[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .nav-option {position:relative;display:block;padding:.5em 0;min-height:2.5em;border-bottom:1px solid #fcfcfc;box-sizing:border-box}.nav-option[data-ractive-css~='{2}']:hover, [data-ractive-css~='{2}'] .nav-option:hover {background-color:#fcfcfc}.nav-option:hover  .nav-option-contents[data-ractive-css~='{2}'], .nav-option:hover  [data-ractive-css~='{2}'] .nav-option-contents, .nav-option[data-ractive-css~='{2}']:hover  .nav-option-contents, [data-ractive-css~='{2}'] .nav-option:hover  .nav-option-contents {text-decoration:underline}.nav-option-contents[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .nav-option-contents {position:absolute;width:100%;top:50%;left:0;padding:0 1.2em;-webkit-transform:translate(0,-50%);-moz-transform:translate(0,-50%);-ms-transform:translate(0,-50%);-o-transform:translate(0,-50%);transform:translate(0,-50%);-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box}.number[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .number {position:absolute;top:0;right:1.2rem;border:1px solid #f9f9f9;border-radius:50%;display:block;width:1.6em;height:1.6em;font-size:.8em;line-height:1.7;color:#999;background-color:#fff}.number.selected[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .number.selected {background-color:#729d34;border-color:#729d34;color:#fff}",
    /* {3} */
    "  header[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] header {position:absolute;top:-3.5em;padding:0;margin:0;max-width:100%;z-index:10;border-bottom:1px solid #eee;height:3.5em;width:100%}h1[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] h1 {margin:.2em 0 0;font-size:2em;float:left}.controls[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] .controls {float:right}.steps[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] .steps {position:relative;top:.1em;float:left;margin:0 1.5em 0 0}.step-number[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] .step-number {position:relative;display:inline-block;border:1px solid #eee;background-color:#f4f4f4;border-radius:50%;margin:0 .6em 0 0;text-align:center;width:1.8em;height:1.8em;font-size:1.2em;line-height:1.8;color:#999;z-index:3;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box}.step-number.selected[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] .step-number.selected {background-color:#729d34;border-color:#729d34;color:#fff}.step-number[data-ractive-css~='{3}']:last-child, [data-ractive-css~='{3}'] .step-number:last-child {margin:0}.steps[data-ractive-css~='{3}']:after, [data-ractive-css~='{3}'] .steps:after {content:'';position:absolute;width:100%;border-bottom:1px solid #eee;top:50%;left:0;z-index:2}.step-number  span[data-ractive-css~='{3}'], .step-number  [data-ractive-css~='{3}'] span, .step-number[data-ractive-css~='{3}']  span, [data-ractive-css~='{3}'] .step-number  span {position:relative;z-index:3}",
    /* {4} */
    ".app[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .app, .boxxy-container[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .boxxy-container, .content[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .content {position:relative}.block[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .block, .boxxy-container[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .boxxy-container, .content[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .content {width:100%;height:100%}.app[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .app {-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box}.content[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .content {-webkit-transition:opacity .2s cubic-bezier(.02,.91,.29,1);-moz-transition:opacity .2s cubic-bezier(.02,.91,.29,1);-ms-transition:opacity .2s cubic-bezier(.02,.91,.29,1);-o-transition:opacity .2s cubic-bezier(.02,.91,.29,1);transition:opacity .2s cubic-bezier(.02,.91,.29,1)}.content.obscured[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .content.obscured {opacity:.2}#copy-block[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] #copy-block, #output-block[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] #output-block {padding:1em 1em 0 0}.execute[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .execute {position:absolute;bottom:.2em;right:.1em;margin:0}.next[data-ractive-css~='{4}'], [data-ractive-css~='{4}'] .next {float:right;font-size:1.6em;padding:.5rem 1rem 1rem}.block  button[data-ractive-css~='{4}'], .block  [data-ractive-css~='{4}'] button, .block[data-ractive-css~='{4}']  button, [data-ractive-css~='{4}'] .block  button {z-index:2;box-shadow:0 0 8px 4px rgba(255,255,255,1)}</style>",

    "    <div class='content '> <div class='boxxy-container'>  ",
    "    <style id='output-styles' type='text/css'>",
    "  #output-block h2 {",
    "  margin: 0 0 0.5em 0;",
    "  }",
    ",",
    "#output-block svg {",
    "  width: 100%;",
    "  height: 100%;",
    "}",
    "",
    "#output-block .temperatures {",
    "  position: relative;",
    "  width: 100%;",
    "  height: 100%;",
    "  padding: 4em 0 0 0;",
    "  -webkit-box-sizing: border-box;",
    "  -moz-box-sizing: border-box;",
    "  box-sizing: border-box;",
    "}",
    "",
    "",
    "#output-block .header {",
    "  position: absolute;",
    "  top: 0;",
    "  left: 0;",
    "  width: 100%;",
    "  height: 2em;",
    "}",
    "",
    "#output-block .radio-group {",
    "  display: inline-block;",
    "  float: right;",
    "  text-align: right;",
    "  padding: 0.5em 0 0 0;",
    "}",
    "",
    "#output-block .header h2 {",
    "  float: left;",
    "  margin: 0;",
    "}",
    "",
    "#output-block .header select {",
    "  position: relative;",
    "  top: 0.1em;",
    "  float: left;",
    "  clear: left;",
    "  font-size: inherit;",
    "  font-family: inherit;",
    "  z-index: 7;",
    "}",
    "",
    "#output-block .header label {",
    "  position: relative;",
    "  z-index: 7;",
    "}",
    "",
    "#output-block .header p {",
    "  float: left;",
    "  clear: left;",
    "  margin: 0;",
    "}",
    "",
    "#output-block .bar-chart {",
    "  position: relative;",
    "  padding: 0 0 3em 0;",
    "  width: 100%;",
    "  height: 100%;",
    "  -webkit-box-sizing: border-box;",
    "  -moz-box-sizing: border-box;",
    "  box-sizing: border-box;",
    "}",
    "",
    "#output-block .bar-group {",
    "  position: relative;",
    "  float: left;",
    "  height: 100%;",
    "  text-align: center;",
    "}",
    "",
    "#output-block .month-label {",
    "  position: absolute;",
    "  bottom: -2em;",
    "  left: 0;",
    "  width: 100%;",
    "}",
    "",
    "#output-block .bar-outer {",
    "  position: absolute;",
    "  width: 100%;",
    "  padding: 0 1px;",
    "  -webkit-box-sizing: border-box;",
    "  -moz-box-sizing: border-box;",
    "  box-sizing: border-box;",
    "}",
    "",
    "#output-block .bar-outer.positive {",
    "  bottom: 20%;",
    "}",
    "",
    "#output-block .bar-outer.positive .bar-inner {",
    "  bottom: 0;",
    "  border-top: 1px solid #333;",
    "  border-left: 1px solid #333;",
    "  border-right: 1px solid #333;",
    "  border-radius: 2px 2px 0 0;",
    "}",
    "",
    "#output-block .bar-outer.negative {",
    "  top: 80%;",
    "}",
    "",
    "#output-block .bar-outer.negative .bar-inner {",
    "  top: 0;",
    "  border-bottom: 1px solid #333;",
    "  border-left: 1px solid #333;",
    "  border-right: 1px solid #333;",
    "  border-radius: 0 0 2px 2px;",
    "}",
    "",
    "#output-block .bar-outer.high.negative {",
    "  z-index: 6;",
    "}",
    "",
    "#output-block .bar-inner {",
    "  position: relative;",
    "  width: 100%;",
    "  height: 100%;",
    "  -webkit-box-sizing: border-box;",
    "  -moz-box-sizing: border-box;",
    "  box-sizing: border-box;",
    "}",
    "",
    "#output-block .high.positive span {",
    "  top: -0.6em;",
    "  font-weight: bold;",
    "}",
    "",
    "#output-block .low.positive span {",
    "  top: 0.8em;",
    "  color: white;",
    "  text-shadow: 0 0 3px rgba(0,0,0,1), 0 0 3px rgba(0,0,0,1), 0 0 3px rgba(0,0,0,1);",
    "}",
    "",
    "#output-block .high.negative span {",
    "  bottom: 0.8em;",
    "  color: white;",
    "  text-shadow: 0 0 3px rgba(0,0,0,1), 0 0 3px rgba(0,0,0,1), 0 0 3px rgba(0,0,0,1);",
    "}",
    "",
    "#output-block .low.negative span {",
    "  bottom: -0.6em;",
    "  font-weight: bold;",
    "}",
    "",
    "#output-block .bar-chart span {",
    "  position: absolute;",
    "  width: 100%;",
    "  left: 0;",
    "  font-family: 'Helvetica Neue', Arial;",
    "  font-size: 0.7em;",
    "  line-height: 0;",
    "  z-index: 6;",
    "}",
    "",
    "#output-block .axis {",
    "  position: relative;",
    "  width: 100%;",
    "  height: 0;",
    "  border-top: 1px solid #333;",
    "  z-index: 5;",
    "  left: 0;",
    "  top: 80%;",
    "}",
    "</style>",
    "<div id='output-block' style='position: relative; width: 100%; height: 100%; display: block; box-sizing: border-box; overflow: auto;'>",
    "<div class='temperatures'>",
    "",
    "    <!-- header and options -->",
    "  <div class='header'>",
    "  <h2>Average high and low temperature</h2>",
    "",
    "  <!-- switch between celsius and fahrenheit -->",
    "<div class='radio-group'>",
    "  <label>°C <input type='radio' name='celsius' value='celsius' checked></label>",
    "<label>°F <input type='radio' name='fahrenheit' value='fahrenheit'></label>",
    "  </div>",
    "",
    "    <!-- dropdown menu -->",
    "  <select>",
    "  {{#each cities:i}}",
    "<option value='{{i}}'>{{name}}</option>",
    "{{/each}}",
    "</select>",
    "</div>",
    "",
    "  <!-- the chart -->",
    "<div class='bar-chart'>",
    "  {{#with cities[selectedIndex] }}",
//    "  {{#with selectedCity}}",
    "",
    "<!-- 12 sections, one for each month -->",
    "{{#each months:i}}",
    "<div class='bar-group' style='width: 8.333333333333334%'>",
    "",
    "    <!-- average high temperature -->",
    "  <div class='bar-outer high {{ (high >= 0) ? \'positive\' : \'negative\' }}' style='height: {{ scale(high) }}%;'>",
    "  <div class='bar-inner' style='background-color: {{ getColor(high) }};'></div>",
    "  <span>{{ format(high) }}</span>",
    "</div>",
    "",
    "",
    "  <!-- average low temperature -->",
    "<div class='bar-outer low {{ (low >= 0) ? \'positive\' : \'negative\' }}' style='height: {{ scale(low) }}%;'>",
    "  <div class='bar-inner' style='background-color: {{ getColor(low) }};'></div>",
    "  <span>{{ format(low) }}</span>",
    "</div>",
    "",
    "  <!-- month label (JFMAMJJASOND) -->",
    "<span class='month-label'>{{ monthNames[i] }}</span>",
    "</div>",
    "{{/each}}",
    "{{/with}}",
    "",
    "  <!-- horizontal line representing freezing -->",
    "<div class='axis'></div>",
    "  </div>",
    "  </div>",
    "  </div>",
  ].join('\n');

  /* Ractive.js component styles */

  /*  /* {1}
   .errors[data-ractive-css~='{1}'], [data-ractive-css~='{1}'] .errors {width:.8em}.error-marker[data-ractive-css~='{1}'], [data-ractive-css~='{1}'] .error-marker {position:relative}.error-marker[data-ractive-css~='{1}']:hover:after, [data-ractive-css~='{1}'] .error-marker:hover:after {content:attr(data-errors);position:absolute;display:block;background-color:#fff;color:#d00;width:20em;font-size:.8em;line-height:1;left:1em;top:1.5em;padding:.5em}

   /* {2}
   .cross[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .cross, .left-nav[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .left-nav {position:absolute;background-color:#fff}.cross[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .cross, .number[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .number {text-align:center}.left-nav[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .left-nav {top:0;left:0;width:17em;height:100%;border-right:1px solid #eee;padding:3.4em 0 0;cursor:pointer;box-shadow:1px 0 3px rgba(0,0,0,.05);-webkit-transition:all .2s cubic-bezier(.02,.91,.29,1);-moz-transition:all .2s cubic-bezier(.02,.91,.29,1);-ms-transition:all .2s cubic-bezier(.02,.91,.29,1);-o-transition:all .2s cubic-bezier(.02,.91,.29,1);transition:all .2s cubic-bezier(.02,.91,.29,1);-webkit-transform:translate3d(-13em,0,0);-moz-transform:translate3d(-13em,0,0);-ms-transform:translate3d(-13em,0,0);-o-transform:translate3d(-13em,0,0);transform:translate3d(-13em,0,0);-webkit-backface-visibility:hidden;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;-o-user-select:none;user-select:none;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;will-change:-webkit-transform,-moz-transform,-ms-transform,-o-transform,transform}.nav-option[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .nav-option, .toggle[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .toggle {-webkit-box-sizing:border-box;-moz-box-sizing:border-box}.open[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .open {-webkit-transform:translate3d(0,0,0);-moz-transform:translate3d(0,0,0);-ms-transform:translate3d(0,0,0);-o-transform:translate3d(0,0,0);transform:translate3d(0,0,0)}.toggle[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .toggle {position:absolute;top:0;left:0;width:100%;height:3.4em;padding:1.2em;border-bottom:1px solid #eee;box-sizing:border-box}.cross[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .cross {font-size:1.4em;line-height:1;right:1.2rem;top:1.2rem;width:1em;height:1em;display:block;-webkit-transform:rotate(0);-moz-transform:rotate(0);-ms-transform:rotate(0);-o-transform:rotate(0);transform:rotate(0);-webkit-transition:-webkit-transform .3s cubic-bezier(.02,.91,.29,1);-moz-transition:-moz-transform .3s cubic-bezier(.02,.91,.29,1);-ms-transition:-ms-transform .3s cubic-bezier(.02,.91,.29,1);-o-transition:-o-transform .3s cubic-bezier(.02,.91,.29,1);transition:transform .3s cubic-bezier(.02,.91,.29,1)}.open  .cross[data-ractive-css~='{2}'], .open  [data-ractive-css~='{2}'] .cross, .open[data-ractive-css~='{2}']  .cross, [data-ractive-css~='{2}'] .open  .cross {-webkit-transform:rotate(315deg);-moz-transform:rotate(315deg);-ms-transform:rotate(315deg);-o-transform:rotate(315deg);transform:rotate(315deg)}.nav-options[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .nav-options {width:100%;height:100%;overflow:auto}.nav-option[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .nav-option {position:relative;display:block;padding:.5em 0;min-height:2.5em;border-bottom:1px solid #fcfcfc;box-sizing:border-box}.nav-option[data-ractive-css~='{2}']:hover, [data-ractive-css~='{2}'] .nav-option:hover {background-color:#fcfcfc}.nav-option:hover  .nav-option-contents[data-ractive-css~='{2}'], .nav-option:hover  [data-ractive-css~='{2}'] .nav-option-contents, .nav-option[data-ractive-css~='{2}']:hover  .nav-option-contents, [data-ractive-css~='{2}'] .nav-option:hover  .nav-option-contents {text-decoration:underline}.nav-option-contents[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .nav-option-contents {position:absolute;width:100%;top:50%;left:0;padding:0 1.2em;-webkit-transform:translate(0,-50%);-moz-transform:translate(0,-50%);-ms-transform:translate(0,-50%);-o-transform:translate(0,-50%);transform:translate(0,-50%);-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box}.number[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .number {position:absolute;top:0;right:1.2rem;border:1px solid #f9f9f9;border-radius:50%;display:block;width:1.6em;height:1.6em;font-size:.8em;line-height:1.7;color:#999;background-color:#fff}.number.selected[data-ractive-css~='{2}'], [data-ractive-css~='{2}'] .number.selected {background-color:#729d34;border-color:#729d34;color:#fff}

   /* {3}
   header[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] header {position:absolute;top:-3.5em;padding:0;margin:0;max-width:100%;z-index:10;border-bottom:1px solid #eee;height:3.5em;width:100%}h1[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] h1 {margin:.2em 0 0;font-size:2em;float:left}.controls[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] .controls {float:right}.steps[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] .steps {position:relative;top:.1em;float:left;margin:0 1.5em 0 0}.step-number[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] .step-number {position:relative;display:inline-block;border:1px solid #eee;background-color:#f4f4f4;border-radius:50%;margin:0 .6em 0 0;text-align:center;width:1.8em;height:1.8em;font-size:1.2em;line-height:1.8;color:#999;z-index:3;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box}.step-number.selected[data-ractive-css~='{3}'], [data-ractive-css~='{3}'] .step-number.selected {background-color:#729d34;border-color:#729d34;color:#fff}.step-number[data-ractive-css~='{3}']:last-child, [data-ractive-css~='{3}'] .step-number:last-child {margin:0}.steps[data-ractive-css~='{3}']:after, [data-ractive-css~='{3}'] .steps:after {content:'';position:absolute;width:100%;border-bottom:1px solid #eee;top:50%;left:0;z-index:2}.step-number  span[data-ractive-css~='{3}'], .step-number  [data-ractive-css~='{3}'] span, .step-number[data-ractive-css~='{3}']  span, [data-ractive-css~='{3}'] .step-number  span {position:relative;z-index:3}
   */

  var climate_viewer = {
    twoway: false,
    temperatures_json: temperatures_json,
    template: template,
    data: {
      scale: function (val) {
        // quick and dirty...
        return 2 * Math.abs(val);
      },
      format: function (val) {
        // Pro-tip: we're using `this.get()` inside this function -
        // as a result, Ractive knows that this computation depends
        // on the value of `degreeType` as well as `val`
        if (this.get('degreeType') === 'fahrenheit') {
          // convert celsius to fahrenheit
          val = ( val * 1.8 ) + 32;
        }

        return val.toFixed(1) + '°';
      },
      getColor: function (val) {
        // quick and dirty function to pick a colour - the higher the
        // temperature, the warmer the colour
        var r = Math.max(0, Math.min(255, Math.floor(2.56 * ( val + 50 ))));
        var g = 100;
        var b = Math.max(0, Math.min(255, Math.floor(2.56 * ( 50 - val ))));

        return 'rgb(' + r + ',' + g + ',' + b + ')';
      },
      monthNames: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
      months: 12
    }
  };

  return climate_viewer;
}
