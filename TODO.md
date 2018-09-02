# Now
! output now should be array
  - update doc and README
- add edge cases for test generation: 
  - history transitions
    - comment well the code, the second part with input generation
  - compound state
    - add compound to compound transitions test for fsm2graph
- write all contracts
  - cannot have non-determinstic transitions
    - A -ev> B and A < OUTER_A with OUTER_A -ev>C !!, the fsm might work in a deterministic way, 
    but the input generation won't!!
  - TODO add contract for test gen : apply only to FSM for which init event sets the initial state
   in the machine
- types : update DOC
  - best will be to put a link to it??
- input generation
  - write DOC
- visualization
  - try the visualizer with the examples in tests
- add the super test from quantum leaps for hierarchy specs
- make visualizer work for history states too!!

// TODO DOC : document initial state is NOK, and event init automatically fired on starting the fsm
// no hierarchy : TODO : add tests for when event passed in not in state machine

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
