### 0.1.0 (September 12, 2017)

- apply update operation
- added a default event emitter factory
- switch to ES6 (var vs. const etc)
- minor changes (name -> displayName)
- factored out `special_events` into separate properties
- action result is now made of two components
  - update of the state machine model (quantitative state)
  - output of the state machine (as received by the caller)
- included tests for non-hierarchical features
  - (not integrated yet with the rest of the tests for the previous version)
