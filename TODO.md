# Now
- review tests for no-hierarchy because no start... change comments, see what I miss as cases
- rewrite trace fsm tests
- rewrite test_generation.specs
- send the init event before returning the machine!! How does that impact test?? maybe best is 
not to pass extended state in the init event!! and force in test the same
- I could have a debug property in the object I return and set that property to true or false (or
 a setter if that works better), cf penpal
 ```javascript
var log = function log() {
  for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
    args[_key] = arguments[_key];
  }

  if (Penpal.debug) {
    var _console;

    (_console = console).log.apply(_console, ['[Penpal]'].concat(args)); // eslint-disable-line no-console
  }
};

```
- change subject API to next instead of `emit`, this is observable standard
- do an angular2 demo (like ng-state-machine or something)
- do a svelte-state-machine demo (will be useful for template-based libraries)
- DOC the generator state in the testing generator
- test new version with iterator of graph-adt 0.8.1!
- DOC if outputs wants to output an array as outputs how to do it : [Array]! DOC it
- could use transducer in streaming state machine to avoid using operators?? 2K gzipped
  - that replaces operators by one : transduce
    - would be great I avoid `pipe` and more easy interface for switching event processing libraries
    - cf. https://github.com/pangloss/transducers for multiplex(great!!) transducers and other
    useful stuff
  - question! do transducer flatMap?? yes we can, but is it in the common libraries..mmm
- think about how to sell the test stuff and the finished 1st iteration fix
- think about debugger for state machine - basically a UI around traceFSM
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
- DOC for test_generators
- ROADMAP : DSL with parser (check my gmail) like http://blog.efftinge
.de/2012/05/implementing-fowlers-state-machine-dsl.html so I can convert to it and back for
drawing and debugging?
- README.md state-transducer add simple example to show FSM_Def, for now only the types are there,
not enough!!
- there can be error when generating the inputs!! typically when it is done wrong, and th
emachine is not in sync with the gen. Should identify that early and return a warning? Generally
error is ...[0] is undefined. That means an event was sent and could not be handleed by the state
 machine
- input generation
  - write DOC
! WRITE ALL CONTRACTS
  - TODO add contract for test gen : apply only to FSM for which init event sets the initial state
   in the machine
     - could ignore event data from gen corresponding to INIT_STATE??
- CONTRACT : actually disallow having several guards from INIT_STATE!!
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
- visualization
  - try the visualizer with the examples in tests
- make visualizer work for history states too!!
- README : put links for tests everywhere I put cf. tests!!
- ROADMAP : add the super test from quantum leaps for hierarchy specs
- ROADMAP : allow event forwarding : THAT IS A REWRITE, good thing tests are already there
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
- ROADMAP : targetless events
      // NOTE : we implemented it here by repeating the self-loop corresponding to the targetless event in all substates
- ROADMAP : // T9. A transition to a history state must transition to the history state containing parent, if there is no history
            // ENFORCE, NOT IMPLEMENTED TODO in ROADMAP!!! impact on test generation

- TODO DOC : document initial state is NOK, and event init automatically fired on starting the fsm
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
