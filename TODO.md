# Now
! output now should be array
  - update the streaming machine
    - seems to be working??
    - rewrite with create observable 
  - update the demo and retest 
    - apparently problem with entry/exit actions...
    - add tests for it, I don't have any
  - look for all the place I put null (also tests!) and put No_OUTPUT instead then change 
  NO_OUTPUT to {} to see if still works (should use referential equality so should be fine for js)
  - update doc and README
  - update minor version and publish (change it for demo too!!)
! might have to code history differently - right now I use event emitter and prototype... AND I 
USE evil EVAL!!!
- add edge cases for test generation: 
  - history transitions
    - in path state, add the list of control states, including the state when input sequence is 
    run (not the state for the new input)
    - compute the history set for each state
      - will be the origin vertex for each exiting transition 
    - when a transition to S.H add all the edges from S.H to the history set for S as eventless 
    transitions
    - will be S.H -null> X and a if (edge.event == null && edge.from is history) isTraversable will
     depend, no change in input, and output (already output when Z -> S.H)
    - not that if (edge.event == INIT) then edge.from is not history (contract)
    - isTraversable depends :
      - get the history state for S from the state sequence
      - if the edge.target corresponds to history(S) then isTraversable YES else NO
- write all contracts
  - some of them hre : https://www.embedded.com/design/prototyping-and-development/4008341/State-charts-can-provide-you-with-software-quality-insurance
- test not hierarchical state machine with INIT -> (A,B) and 1 self-loop. and 1 loop C -> D -> C,
 basically simplifaction of the application process state machine. Think about guards too
- add contract
  - if eventless transition, then cannot have event-based transitions for the same origin control 
  state
  - all AUTO transition should advance
  - TODO add contract for test gen : apply only to FSM for which init event sets the initial state
   in the machine
  - all action factories MUST return a model_update, MUST return a outputs!! no syntactic sugar here
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
