# Documentation

ESDoc helps documenting but I found it lacking when it comes to documenting types. I hence resort to my own conventions.

# Comment markers

- TODO
- FOR NOW
- ISSUE
- BUG
- NOTE
- CONTRACT
- Side-effects
- Nice to have

# Code formatting

- constructor functions start with a capitalized letter. From there, they can also be UpperCamelCased if need be
- regular functions (i.e. not constructors) and variables, are snake_cased
- constants are MACRO_CASED
- common acronyms are cased the way they usually appear in other contexts
  - for instance, `var XML_HTTP_request;`
- variable names can be suffixed with a one-letter marker to indicate type
  - such suffix must be properly documented
    - for instance, `rx_stream$` indicates a variable of type `Rx.Observable`
    - for instance, `rx_streamS` indicates a variable of type `Rx.Subject
- variable names can be prefixed with a word to indicate type while respecting the casing convention in use
  - for instance, `arr_transitions` is an array variable
- variable names can be prefixed with one/several underscores to indicate that the variable is 'private'
- OPEN to discussion is whether functions should also be suffixed to indicate 
  - their return type
  - their purity/impurity
    - FOR NOW, indicates with an OUT the input parameters which are modified by the enclosing function
    - Documentation of impure function includes a Side-effects tag which documents the mentioned side effects

# General principles
- Readability
- Maintainability
- Maximize purity
- Testability

# Tests
- use a BDD approach to describe the test as clearly as possible (human-version of the test rationale)
- the test itself can be written in which ever style
