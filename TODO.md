# Now
- maybe add or pass a settings object to the command handler (passed if needed to command handlers)?
  - this is for dependency injection - can have effects or commands more testable
  - or leave it userland?
  - but the effect handlers is already dependency injection!! Put all dependencies there even if they don't do effects!!
- make example of Kingly reproducing API of semantic-UI
  - without jquery, with web components! 
  - customizable state machine, packaged on npm 
- make article on stop coupling ui and logic!
- make article on testing - using the chess as an example
- other example of full app: https://github.com/TrillCyborg/fullstack
- REMOVE render commands from REACT_STATE_DRIVEN!!!! put it in kingly!!! for dependency reasons
- similar to what I want to do with actor/processes/cycle : 
  - https://medium.com/dailyjs/introducing-bloc-pattern-with-react-and-rxjs-40109665bb2
- BPMN.io great for visualization - admits nested processes
  - must draw yourself the layout but thats fine
  - then will have some work to map data-element-id to machine components but doable
  - then style it to have a step-by-step debugger!!!! 
  - allow create, load, and save of .bpmn file: perfect, put that in github.
    - can I use a webpack loader?? raw-loader!! AMAZING    
- regex for tufte hexo tag: (\s*)(```)(tufte)\s+\n?([\s\S]+?)\s*(\2)(\n?|$)
- URGENT: change code and tests!! so subject factory is replace by subject!!
  - change makeWebComponentFromFsm in kingly
  - change react-state-driven, vue-state-driven etc. and all examples...
- could implement tracing with a proxy!! proxying the machien returned by createStateMachine!
- extension to processes:
  -         event
  - input -> fsm -> output
  -         event
  - actually event -> input -> fsm -> output -> event !
  - so for instance network request = command, which when executed is event
  - response is event which when received is input
  - so only difference is timing = scheduling, debouncing, delay etc.
  - to have full picture, we need the function event -> input e.g. the connectors
  - that is the only way to deal with concurrency/ similar to I/O automata
- unload all these improvements in the issues directory of each
  - add compositing of state machines. Outgoing links are parameterizable : target state, and 
  condition/action, and events? whatever necessary to customize for the functionality -> similar 
  to partial application!
  - for insance debounce is timmer running <-> timer registering, and three parameters: query 
  changed, display loading screen, and timer duration, -> similar to debounce(source, duration)
    - it is debounce (event, duration, action); but that action may update the state of the outside
- in react-state-driven, an improvement would be to have a render handler:: machineComponent, 
renderWith, params, next, directUpdate with directUpdate:: (renderWithInstance, params, next) -> 
Bool, so that returns false if no direct update. Then props update occurs on renderWith. Else 
returns true. That means that the instance state is updated directly. Be careful that the 
instance must exist for directUpdate to be called. TO THINK ABOUT 
  - could also be include a decision function: updateStateOrProps:: params -> Boolean with 
  directUpdate:: renderWithInstance, params, next -> () (don't forget postRenderCallback)
- do proxx game from google, 
  - https://github.com/GoogleChromeLabs/proxx
  - https://proxx.app/
  - have a section on modelization and show the state machines for it 
  - no routing here : great! just skip the worker things
  - and talk about it in some architecture section
  - ADD a undo/redo that is sorely missing
  - see if I do the animation or not
- do a Vue doc contribution with the sparks example in Vue!!
- CONTRACT: event emitter must be on microtask? so that event passed through the emitter are run 
before other machine events are processed? can it also be immediate/synchronous?
- shepherd - guiding user through app can be done with state machines: https://shipshapecode.github.io/shepherd/docs/welcome/
- for tutorial/demo site use graph widget https://github.com/ui-router/visualizer 
- write a nested router with fsm
  - though it should rather be a higher order component wrapping the display component
  - OnRoute(route, options, displayWith)
  - so the on route would send an init event to displayWith? or? 
- refactor away from prototype to allow event propagation:
  - each state (compound or atomic) has an handling function
  - that handling function in the case of a compound state is a regular transducer BUT if that transducer returns null then it applies the other relevant event handler at top level
  - so a compound component is a regular inside function || outside function
- add more eventless tests
  - eventless <-> eventless with guards in both, and state modification
- do the react version of password demo from the vue one
- doc site take it from there : https://github.com/alexkrolick/testing-library-docs
  - or https://www.ably.io/documentation
  - https://github.com/axefrog/docs
- testing - talk to gleb bahmutov so it puts in cypress somehow,
  - cf. 
- build a real documentation site separated from the README.md
  - cf. talk https://www.youtube.com/watch?v=t4vKPhjcMZg
  - tutorial
    - start with the password example (letter/number)
      - exercise left to learner : use a password library (forgot the name)
    - then go up from more complex examples
      - no hierarchy
      - with hierarchy
      - with history etc.
    - etc. that means having a graduated parcours to follow (i.e. curriculum)
    - maybe include testing at the same time as development
    - TUTORIAL (learning-oriented, most useful when we are studying and evaluating the material) 
    are about concreteness not abstraction (include a dropdown with abstraction by 
    default hidden), no unnecessary explanation
  - how to (problem-oriented)
  - discussion (understanding oriented - that is like the article I am writing for frontarm, 
  gives context, explain why, alternative approaches, connecting to other things)
  - reference
  
- in future version test the traceFSM for errors, error should be goign in properties directly, no throwing
- DOC : fsmContracts in debug - update types too to include it
- ROADMAP : TESTING
  - inject a debug property with a trace property or a trace property instead of debug
  - the trace prop has an emitter interface a signature {event, event data}
    - {RECEIVED_EVENT: eventData}
    -  {REJECTED_EVENT: {RECEIVED_EVENT: eventData}}
- Demos
  - boulderdash game!!
  - eshop nice demo (vue) : https://github.com/sdras/sample-vue-shop
    - example of multi-step process
  - chess game
    - https://raulsebastianmihaila.github.io/chess/ : https://github
    .com/raulsebastianmihaila/chess-src THE BEST!!!
  Programs : https://reactjsexample.com/chess-game-with-react-js/, https://www.techighness.com/post/develop-two-player-chess-game-with-react-js/
    - use redux, supposedly super well written,
    - none of them do check, checkmate, etc. probably because lots of if... so do it as a 
    modification and write articles about it
    - true chess with stock fish API but have server side... underwaterchess.com , https://www.reddit.com/r/reactjs/comments/53th5k/online_chess_made_with_react_and_redux/   
    - then do chess with components to see how machines change with component (maintainability!!) https://github.com/vitogit/vue-chessboard-examples
    -    or https://pusher.com/tutorials/realtime-chess-game-react (real time chat on top)
    - or pacman : https://github.com/platzhersh/pacman-canvas, from https://superdevresources.com/open-source-html5-games/
  - dinosaur google gam : simple and known abd linkable o twnsor flow
    - https://cs.chromium.org/chromium/src/components/neterror/resources/offline.js?q=t-rex+package:%5Echromium$&dr=C&l=7
    - https://github.com/Code-Bullet/Google-Chrome-Dino-Game-AI
    - webstorm dir Genetic algorithm
  - use https://itnext.io/a-wicked-custom-elements-alternative-6d1504b5857f to have web 
  components without needing custom elements!!
  - mario game : https://github.com/mahsu/MariOCaml/blob/master/director.ml and https://github.com/reasonml-community/Mareo 
  - could also reuse shop microfrontends : https://micro-frontends.org/
  - game demo with https://codeincomplete.com/posts/javascript-gauntlet-foundations/, also boulder 
    dash
  - simple game demo : snake with ivi
     - https://github.com/localvoid/ivi-examples/tree/master/packages/apps/snake
  - good example of routing and animations : https://page-transitions.com/, https://github.com/sdras/page-transitions-travelapp
  - maybe this https://buttercms.com/blog/build-a-beautiful-animated-news-app-with-vuejs-and-vuetify
    - LOW PRIORITY - but good as a Vue example and also adding states to the fetch (handling errors)
    which are not in the current version
    - THIS absolutely : music player!! https://github
    .com/Upmostly/react-use-context-hook/blob/master/src/hooks/useMusicPlayer.js ??

- Promote
  - finish react-state-driven then vue-state-driven
  - vue-state-driven to put in awesome vue : https://github.com/sdras/awesome-vue
    - https://github.com/sdras/awesome-vue#examples
  - look if I can put react-state-driven in awesome react if any
  - finish react-state-driven then write ivi component as ivi hook then publish to ivi example
    - https://github.com/localvoid/ivi/tree/master/packages/ivi, https://github.com/localvoid/ivi#apps
  - put in svelte awesome : https://github.com/sveltejs/awesome 

- also for webcomponenets README https://html.spec.whatwg.org/multipage/custom-elements.html#custom-element-conformance 
- do the webcomponent wih a rendr property customizable
- add a tutorial section in README:
  - modelization (show graph)
  - implementation (show transitions)
  - execution (show interface)
- towards v1.X
  - test wise, would be good to generate tests starting from a target not INIT and some initial 
state at that target (cf. previous) 
  - maybe write a generator like with jsverify. cf. https://github.com/jsverify/jsverify#types 
    - seems like shrinking in our case is easy, just remove one input from the failing sequence
- do an angular2 demo (like ng-state-machine or something)
- do a svelte-state-machine demo (will be useful for template-based libraries)
- DOC the generator state in the testing generator
- test new version with iterator of graph-adt 0.8.1!
- DOC if outputs wants to output an array as outputs how to do it : [Array]! DOC it
- think about debugger for state machine - basically a UI around traceFSM
  - could use http://wso2.github.io/VizGrammar/samples/ to dynamically update the graph
    - remains to be seen how to add interactivity (event handling) to the graph though
  - that is the best way to explain the state machine behavior!!
  - review the format for the visualizer
  - need to find a way to outline the current control state
- think about using the test generator for proprty-based testing
  - for instance any valid test case must respect invariant : no invalid input
    - that might have found the bug we found
  - if no review, all ABOUT inputs in the last domain action must be found in the last ABOUT
    continue event data
  - if no review, all QUESTION inputs in the last domain action must be found in the last ABOUT
    continue event data
  - if review, all reviewed ABOUT inputs in the last domain action must be found in the last
    ABOUT continue event data
  - if review, all reviewed QUESTION inputs in the last domain action must be found in the last
    ABOUT continue event data
  - must be as many domain action as continue button click
  - etc.
- !! all-transitions is all-path-with-no-repeated-transitions which is a all-transition but
bigger, call it all-transitions* ?? to avoid changing everything
- there can be error when generating the inputs!! typically when it is done wrong, and th
emachine is not in sync with the gen. Should identify that early and return a warning? Generally
error is ...[0] is undefined. That means an event was sent and could not be handleed by the state
 machine
 
 # Roadmap
 - version 1.X for entry actions and exit actions
 // TODO: analyze edge case : I pile on entry transitions decorateEntry(decorateEntry(...))
 // - what happens if same entry transition twice? should be ok, same order, both will apply, write a test
 // NO!! A -ev-> B ACT1
 // NO!! Entry B : ACT2
 // NO!! Entry B : ACT3
 // decorate(ACT2, decorate(ACT3, ...) -> [ACT1, ACT3, ACT2]!!
 // test and DOC it (but that should be another version right?) maybe include in this one after all
 // TODO : DOC that decorated actions should also be tryCatch separately for better error tracking - otherwise the
 // error will be caught, but it will not be possible to identify which action (transition or decorated) caused the
 // problem
- would be good to have a `reset` function which puts the machine back in starting position and 
 returns a clone of it.
- would be good a function `clone` which returns a new state machine, with the same state as the 
 current one
- ROADMAP : DSL with parser (check my gmail) like http://blog.efftinge
.de/2012/05/implementing-fowlers-state-machine-dsl.html so I can convert to it and back for
drawing and debugging?


 # Contracts
! WRITE ALL CONTRACTS
  - TODO add contract for test gen : apply only to FSM for which init event sets the initial state
   in the machine
     - could ignore event data from gen corresponding to INIT_STATE??
- CONTRACT : for guards associated to (from, event), only one guard can be fulfilled!!
  - for now priority works : first guard fulfilled
  - but that kills generative testing, it could follow a branch that is impossible by following
  the path given by the second guard fulfilled
  - so write defensively the guards : no else concept
  - review the demo, and replace all the T for else
- CONTRACT : for guards associated to (from1, event) and (from2, event) where from1 and from2 are
 in a hierarchy relation, for instance from2 < from1
   - for now REJECT
   - in the future could allow if guard1 and guard2 are never true together
     - if that is the case, the test input generation will work
     - but not the implementation which does not forward event!!
   - note this is a generalization of from1 = from 2 mentioned previously
- ROADMAP : add the super test from quantum leaps for hierarchy specs : remove those who cannot work
- ROADMAP : NO!! allow event forwarding : THAT IS A REWRITE, good thing tests are already there
  - that requires getting rid of prototypes and make a list of transitions for each (from, event)
  - when done, graph transformation does not change
  - BUT edge traversal changes : do not take a edge (from1, event) if from2 < from1 and
  (from2, event) generates an input
    - but even that is shaky as we generate only one input, there is no guarantee that for
    another input, we would not have the guard passing. But it is correct for that case, so
    useful for that case, but we loose generality!! We have only tested for a portion of the test
     space linked to this choice of event data. Obviously that is always the case, but ideally we
      want to choose our guards and fsm and gen so that the eventData can be variabalized and
      fuzzied over for fuller testing. We want to test the model with specific event data, and if
       true, we want to generalize to all possible eventData! can't do it if we propagate events
    - will work always if both guards related to from1 and from2 can never be true together
  - NOTE that this can be worked around by adding guards to from1
    - from1.final guard = !from2.guard && from1.guard (in general all ancestor of from2 on the
    path to from1)
    - could be important in that case to memoize the guard, as we might repeat them often.
    Extended state is immutable so should be practical. Impose settings immutable, and eventData
    immutable and we are good
- ROADMAP : implement iterator symbol, async iterator probably to emulate stream without stream
library
- ROADMAP : targetless events : NO only serves to confuse readability
      // NOTE : we implemented it here by repeating the self-loop corresponding to the targetless event in all substates
- ROADMAP : // T9. A transition to a history state must transition to the history state containing parent, if there is no history
            // ENFORCE, NOT IMPLEMENTED TODO in ROADMAP!!! impact on test generation
            NO~~~ there must be a history!! throw if none?
- no hierarchy : TODO : add tests for when event passed in not in state machine
- would be great to have a query language to select input sequences from the generated set
  - for instance includes a cycle
  - includes a cycle which includes this node etc.
  - it is an array

# Later
- at some point, write more serious tests, cf. [Imgur](https://i.imgur.com/IWoe84U.png)
  - specially with hierarchical part
  - the imgur link tests all topological transitions up to four levels!! good test!
  - expected run here [Imgur](https://i.imgur.com/Lei0BcM.png)
  - all info in pdf AN_Crash_Course_in_UML_State_Machines

# Didactic
- implement auto-complete field with state machines
  - will use history states and pre-emption (cancelling tasks)
- implement a page with two autocomplete fields, and which returns availability of, say, seats,
provided the autocomplete fields fulfill some validity rules (part of a given list) orig-dest
  - shows how to reuse a graph into another one?? to check
  - that will show benefits of hierarchical state machines
- then move to multi-step workflow full example
- could show auto-complete example in react with same library
- could show auto-complete example in angular with same library
LOTS OF WORK
do the design on spare time but work rather on the dev tool!!! that is the killing thing

# to think about
- modelling tool for visual DSL!! https://github.com/webgme/webgme
- already one exists for state machines. Complex but already exists. Would be good to have a
plugin to exchange format between the two!! That way I don't have to do a tracer myself!.!.!
- compiler to js : spec -> js code

# NOTE
you can remove some guards by giving them different event names and generating those. That is if
you can access the data which serve to compute the guard at event triggering time!!

# Trivia
- example of game state machine (tetris) : https://www.colinfahey.com/tetris/tetris.html?utm_source=ponyfoo+weekly&utm_medium=email&utm_campaign=146

#testing
The FSM can be used to generate test cases fulfilling test
covers. There exists a set of desirable properties for the testing
of FSMs. Action Coverage is defined as the desirable property
of executing every possible action at each state at least once.
Action coverage is the easiest test coverage criterion for a
FSM model. Ref. [9] introduces Branch Cover, Switch Cover,
Boundary-Interior Cover and H-Language as test coverage
criteria. Branch Cover traverses an FSM in order to visit each
branch, so that the complexity of all possible paths reaching
to infinity at worst can be reduced. Switch Cover describes a
branch-to-branch tuple, meaning that in and out branches of
a state are covered by test sequences [10]. Boundary-Interior
Cover as described in [9] characterize test sequences causing
loops to be traversed once without additional iterations. HLanguage is a similar approach to for Boundary-Interior
Cover loop testing. 
From Test case generation approach for industrial automation systems 2011

 Furthermore, “the process of deriving tests tends to be unstructured, not reproducible, not documented,
lacking detailed rationales for the test design, and dependent on the ingenuity of single 
engineers” [7].  in Review of Model-Based Testing Approaches

# DSL for state machines
- I can use template literals!!! pass action functions in ${} it works!!! incredible

Guards:
---
function xxx()
---

Actions :
---
function xxx(){}
test if closure can be used this is evaluated so probably ??
---
Given ST1, When EV And guard THEN xxx
or 
ST1 => ST2 when EV AND guard
ST1 => ST2 on EV if guard
ST1:
  EV when guard => ST2
    DO actions 

amazing world
