# Statecharts

## Definition
A statechart is a form of extended hierarchical finite state machine. Cutting to the chase, in the frame of this library, 
a statechart is composed of :

* A hashmap `S` describing a hierarchy of nested states
* A set `I` of intents. Alternatively we will use sometimes the term `event` but both will be represented 
  in this implementation by the same type, hence they carry the exact operational semantics. 
* A model `M` which is hashmap with a set of properties
* A set of predicates `C` operating on the model
* A set of actions/effects which takes a model and gives an updated model
* A set of transitions which connect a given state, intent/event, predicate to a action/effect and a resulting state

As an intent/event occurs, the state machine will move to another state, depending on the specified predicate/guards or
remain in the same state if it cannot find a valid transition. As such, a statechart is reactive by design.

## What are they used for?
Finite state machines are useful when you have an entity :

* Whose behavior changes based on some internal state
* That state can be rigidly divided into one of a relatively small number of distinct options
* The entity responds to a series of inputs or events over time.

In games, they are most known for being used in AI, but they are also common in implementations of user input handling, 
navigating menu screens, parsing text, network protocols, and other asynchronous behavior.

As far as user interface is concerned, the most quoted study on the subject is [Constructing the user interface with statecharts]
  by Ian Horrocks. A valuable ressource from the inventor of the graphical language of the statecharts is [Modeling Reactive Systems with Statecharts: The STATEMATE Approach] 
by Professor David Harel.

## Proposed implementation
The current implementation of the statechart formalism incorporates the following characteristics :

* hierarchy of nested states
* state machine data model
* event, states, predicates, actions
* history mechanism
* automatic transitions

and do not (yet) incorporate the following characteristics:

* orthogonal/concurrent states
* history star mechanism
* entry/exit actions

The proposed implementation makes use of the `cyclejs` light-weight framework to handle asynchrony via the stream abstraction. 
As such, the main exposed function will take as its input the following set of streams:
  
* intents/events
* action/effect responses

and returns the following streams:

* model (as it changes over time)
* action/effect requests

The cyclejs framework allows to connect together the effect requests and the effect responses via an effect driver 
whose exclusive responsibility is to execute the actions/effects to perform as a result of the intent/events. This is in
line with `cyclejs` guideline to gather all side-effectful function in drivers. For the sake of generality and simplicity,
all action/effects are executed in the effect driver, even if they do not perform any side-effect. This architecture hence 
bears some ressemblance with the Elm architecture, and also takes from the free monads by separating an abstract 
representation of a computation from its interpretation.

## Proposed example
The proposed example is taken from Ian Horrocks' book and implements the statechart describing the behaviour of a 
CD-player. Two implementations are proposed, one which handle asynchrony with plain javascript, the second which uses
 `rxjs`/`cyclejs`. This aims at showing that the statechart formalism works adequately relatively independently 
 of the implementation   technique chosen for handling asynchronous events.
 
 The starting statechart for the CD player is reproduced below.
 <TODO: include statechart picture>
 
 NOTE : `ractivejs` is used as a view templating library. The example could naturally be easily implemented with other 
  libraries (virtual DOM, etc.).

[![Extended state machine](https://en.wikipedia.org/wiki/Extended_finite-state_machine)
[![devDependency Status](https://david-dm.org/h5bp/html5-boilerplate/dev-status.svg)](https://david-dm.org/h5bp/html5-boilerplate#info=devDependencies)


* Homepage: [https://html5boilerplate.com](https://html5boilerplate.com)
* Source: [https://github.com/h5bp/html5-boilerplate](https://github.com/h5bp/html5-boilerplate)
* Twitter: [@h5bp](https://twitter.com/h5bp)


## Quick start

Choose one of the following options:

1. Download the latest stable release from
   [html5boilerplate.com](https://html5boilerplate.com/) or create a
   custom build using [Initializr](http://www.initializr.com).
2. Clone the git repo — `git clone
   https://github.com/h5bp/html5-boilerplate.git` - and checkout the
   [tagged release](https://github.com/h5bp/html5-boilerplate/releases)
   you'd like to use.


## Features

* HTML5 ready. Use the new elements with confidence.
* Designed with progressive enhancement in mind.
* Includes:
  * [`Normalize.css`](https://necolas.github.com/normalize.css/)
    for CSS normalizations and common bug fixes
  * [`jQuery`](https://jquery.com/) via CDN, with a local fallback
  * A custom build of  [`Modernizr`](http://modernizr.com/) for feature
    detection
  * [`Apache Server Configs`](https://github.com/h5bp/server-configs-apache)
    that, among other, improve the web site's performance and security
* Placeholder CSS Media Queries.
* Useful CSS helper classes.
* Default print styles, performance optimized.
* An optimized version of the Google Universal Analytics snippet.
* Protection against any stray `console` statements causing JavaScript
  errors in older browsers.
* "Delete-key friendly." Easy to strip out parts you don't need.
* Extensive inline and accompanying documentation.


## Browser support

* Chrome *(latest 2)*
* Edge *(latest 2)*
* Firefox *(latest 2)*
* Internet Explorer 8+
* Opera *(latest 2)*
* Safari *(latest 2)*

*This doesn't mean that HTML5 Boilerplate cannot be used in older browsers,
just that we'll ensure compatibility with the ones mentioned above.*

If you need legacy browser support (IE 6+, Firefox 3.6+, Safari 4+) you
can use [HTML5 Boilerplate v4](https://github.com/h5bp/html5-boilerplate/tree/v4),
but is no longer actively developed.


## Documentation

Take a look at the [documentation table of contents](dist/doc/TOC.md).
This documentation is bundled with the project, which makes it readily
available for offline reading and provides a useful starting point for
any documentation you want to write about your project.


## Contributing

Hundreds of developers have helped make the HTML5 Boilerplate what it is
today. Anyone and everyone is welcome to [contribute](CONTRIBUTING.md),
however, if you decide to get involved, please take a moment to review
the [guidelines](CONTRIBUTING.md):

* [Bug reports](CONTRIBUTING.md#bugs)
* [Feature requests](CONTRIBUTING.md#features)
* [Pull requests](CONTRIBUTING.md#pull-requests)


## License

The code is available under the [MIT license](LICENSE.txt).
