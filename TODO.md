# Now
- add support for tracing (spy via HOC, output configurable via interface - can be used for 
debugging too)
- document
- API: keep the start for now. In another version should be able to start by sending an INIT event, 
but that would be the responsibility of the library user?? Yes, I should do that, so only one `yield` method is exposed
  - The init was to make for statechart but this is no statechart anymore...
- pass the tests again
  - normal library

# Later
- at some point, write more serious tests
  - specially with hierarchical part

# Later later
- at some point investigate MBT
- rollup ?? when I get read of Rx subject for pub/sub


#Code (old)
// TODO : the latest version of synchronous_fsm should go back to rx-component-combinators!!
// TODO : document code with jsdoc, in particular @modify tags for side-effectful functions
// TODO : document the library

// TODO : entry and exit actions??
// TODO : Add termination connector (T)?
// TODO : DSL TODO : write program which takes a transition specifications and draw a nice graph
// out of it with yed or else
// TODO : think about the concurrent states (AND states)
// TODO : cd player demo
// - TEST CASE no history (last seen state is null...)
// - add the view (template + enabling disabling of buttons in function of state)
// - add the tooltips

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

Go to the profile of Eli Schütze Ramírez
Eli Schütze Ramírez
Software Developer in London by way of Nicaragua, find me on Twitter @elibelly
Jun 19
Vintage concepts, fresh applications — CS-in-JS
Last month I was lucky enough to attend React Amsterdam where there were dozens of amazing talks. I recommend you check out D3 and React, Together, Cross Language React and Mixed Mode React. There was one talk, however, that caught my attention: setState Machine by Facebook’s Michele Bertoli.

The premise was simple, some people call it CS-in-JS: take a classic Computer Science concept and apply it directly to modern web development.


In the case of setStateMachine, the proposition is using finite state machines for web UI state management. Michele has created an open source library, react-automata (based on xstate) that does just that, but in React! Here’s the description from the react-automata website:

A state machine abstraction for React that provides declarative state management and automatic test generation.
Let’s explore how it works.

What is a state machine?
A finite state machine is a mathematical abstraction that defines (1) a finite set of states that a machine (or program) can be in and (2) given the current state of the machine, what is the state the machine will be in after a given event occurs.

State machines are often represented visually where a circle represents a state of the machine and the arrow represents an action that occurs. Take the below representation of a finite state machine:

Image Credit: O’Reilly — Erlang Programming by Francesco Cesarini, Simon Thompson
In this example, if our machine were in State 1, and Event 1 occurred, the next state would still be State 1. If then Event 2 occurred, the system would now be in State 2.

Let’s check out this real world example of how a turnstile could be programmed by a finite state machine:

Image Credit — Wikipedia: Turnstile & Finite-state machine
We begin (marked by the black dot) in the ‘Locked’ state. If someone tries to simply push through the turnstile — the action — the diagram will return to the ‘Locked’ state because no coin was used. If then the person deposited a coin, the machine would switch to be in ‘Un-locked’ state and go back to ‘Locked’ only after the person pushed through to the other side.

Finite-state machines can be mathematically deterministic, that is it will always produce the same output from a given input.

What does this mean for UI development on the web?
This principle can be applied to keeping the state of UI components. Imagine deterministically defining the state of a toggle button, a collapsible drawer, an animation or even lazy loading for infinite scroll. The properties of finite-state machines can also aid, like react-automata does, in auto generating snapshot tests to make sure the actions transition into the correct states.

It can be a good way of making sense of complex UI state management that can quickly turn unwieldy with traditional approaches, especially for loading or async states.

Using finite-state machines can have tons of benefits when programming UI components in modern web applications:

You can decouple the UI component from its behaviour and declaratively define its behaviour in a way that allows you to more easily reason about the code and spot any possible missing states.
The behaviour of your component can be tested independently and, in some cases, with automatically generated tests.
It’s a great communication tool. By defining all the states up front, the behaviour of the component can be very easily defined and communicated to other developers, testers, designers and other stakeholders.
