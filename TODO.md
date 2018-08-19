# Now
- add support for tracing (spy via HOC, output configurable via interface - can be used for 
debugging too)

# Later
- at some point, write more serious tests, cf. [Imgur](https://i.imgur.com/IWoe84U.png)
  - specially with hierarchical part
  - the imgur link tests all topological transitions up to four levels!! good test!
  - expected run here [Imgur](https://i.imgur.com/Lei0BcM.png)
  - all info in pdf AN_Crash_Course_in_UML_State_Machines

# Later later
- at some point investigate MBT
- rollup ?? when I get read of Rx subject for pub/sub

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
