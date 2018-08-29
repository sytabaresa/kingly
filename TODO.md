# Now
! output now should be array
  - update doc and README
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
  - TODO add contract for test gen : apply only to FSM for which init event sets the initial state
   in the machine

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
