# Specifying test generation from machine specification
Note that we only need the generator information here, but we keep the rest of data as redundant 
information, so to avoid human mistakes. Indeed, the generator has a hidden dependency with the 
state machine under test (SUT). A change in the SUT should lead to a change in the generators, 
and it is easy to change one and forget to change the other one. So we keep the predicate 
information and target state to make this less likely.

This is not bullet proof. The best way would be to directly insert the generator inside the SUT. 
We decided against that however. We want to keep the test generation separated from the model 
specification, as we expect the model to be used in many different contexts, when the tests can 
only serve one purpose. Be aware however that the tests are coupled to the machine (our  
decoupling is merely artificial), so by the cohesion principle, test generation and model 
specification should be together.
