# Now
- add support for tracing
  - add history states? that is the last piece of state that is not included. Note that it must 
  be immutable, i.e. not a refernce to a mutable object
- add edge cases : 
  - eventless transition (event in {INIT, NULL}
    - will be A -init> B, and a if (edge.event == INIT) isTraversable YES, no change in input, 
    but output??
    - will be A -null> B and if (edge.event == null && edge.from not history) isTraversable YES, no 
    change in input, but output? do eventless transition have actions?? 
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
  - if eventless transition, then cannot have event-basd transitions for the same origin control 
  state
  - all AUTO transition should advance
  - TODO add contract for test gen : apply only to FSM for which init event sets the initial state
   in the machine

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

# incorporate

You can decouple the UI component from its behaviour and declaratively define its behaviour in a way that allows you to more easily reason about the code and spot any possible missing states.
The behaviour of your component can be tested independently and, in some cases, with automatically generated tests.
It’s a great communication tool. By defining all the states up front, the behaviour of the component can be very easily defined and communicated to other developers, testers, designers and other stakeholders.
