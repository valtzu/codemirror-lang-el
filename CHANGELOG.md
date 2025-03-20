CHANGELOG
=========

1.1
---

* Lint right-side argument type for `in` operator
* Fix `undefined` in completion keyword tooltip (#19)

1.0
---

* Render completion info as HTML
* Bump to stable

0.10
---

* Exclude optional arguments when linting argument count
* Lint minimum argument count

0.9
---

* **BC BREAK:** Separate files are no longer included in the release (due to using `cm-buildhelper`)
* Tests are now in TypeScript too
* Autocomplete is now less aggressive
* Severity of "too many arguments" linter error was lowered from error -> warning

0.8
---

* Lint type of call arguments, if defined

0.7
---

* Add support for comments `/*` & `*/`
* Add support for `xor`
* Add support for uppercase `TRUE`/`FALSE`/`NULL`
* Add support for bitwise operators `<<` && `>>`
* Add some basic styles
* Resolve type on logical expressions
* **BC BREAK:** Function parameters are now passed in as objects (see [`ELParameter`](src/types.ts) for details)
