# AGENTS.md

## What this is

`@valtzu/codemirror-lang-el` – [CodeMirror 6](https://codemirror.net/) language support for
[Symfony Expression Language](https://symfony.com/doc/current/reference/formats/expression_language.html).
Ships a Lezer grammar plus linting, autocompletion, hover tooltips and argument hints, all driven by a
user-supplied `ExpressionLanguageConfig` (types, identifiers, functions).

## Commands

Requires Node 20+ (CI uses 20.x, publish uses 24.x). There is no lockfile – `npm install` resolves fresh.

```
npm install
npm run prepare   # builds dist/ + generates the parser from src/syntax.grammar (cm-buildhelper)
npm run lint      # eslint . --ext .ts,.js
npm run lint-fix
npm test          # cm-runtests (mocha); runs `prepare` first via pretest
```

CI (`.github/workflows/test.yml`) runs `npm run lint` then `npm test` – run both before calling a change done.

## Layout

| File | Role |
| --- | --- |
| `src/syntax.grammar` | Lezer grammar. Source of truth for node names. |
| `src/syntax.grammar.terms.d.ts` | **Hand-maintained** type declarations for the generated term ids. |
| `src/index.ts` | Public entry: `expressionlanguage(config, extensions)`, `ELLanguage`, highlight/indent/fold props. |
| `src/utils.ts` | `resolveTypes()` – the type inference engine everything else depends on. |
| `src/linter.ts` | Diagnostics (unknown identifiers, argument count/types, operator operand types). |
| `src/complete.ts` | Autocompletion source. |
| `src/tooltip.ts` | Hover tooltips + function argument hints. |
| `src/types.ts` | Public config interfaces – **CONFIGURATION.md is generated from this file**. |
| `src/props.ts` | The `t` `NodeProp`, which tags grammar nodes with an EL type (e.g. `Number[t="number"]`). |
| `test/test-grammar.cases.txt` | Grammar test cases in `@lezer/generator` `fileTests` format. |

`dist/`, `src/*.js` and `test/*.js` are build output – generated, gitignored, never edit or commit them.

## Working on the grammar

1. Edit `src/syntax.grammar`.
2. If you added/renamed/removed a node, update `src/syntax.grammar.terms.d.ts` by hand – it is not generated,
   and `src/complete.ts` / `src/linter.ts` / `src/utils.ts` import term ids from it.
3. Add a case to `test/test-grammar.cases.txt`:

```
# Null-safe property/method access

one?.two

==>

Expression(PropertyAccess(Variable, NullSafeMemberOf, Property))
```

4. Token order matters: the `@precedence` block inside `@tokens` is what keeps `?.` from being read as
   `Operator('?')` + `MemberOf('.')`.

## Type resolution

`resolveTypes(state, node, config)` walks a syntax node and returns a `Set<string>` of possible EL types.
Things to know before touching it:

- Scalars come from the `ELScalar` enum (`bool`, `number`, `string`, `null`, `array`, `any`).
- Arrays use a `Foo[]` string suffix convention – `arr[0]` on a `string[]` resolves to `string`, and array
  literals infer their element type (`[1, "s"]` → `number[]|string[]`).
- Null-safe access (`?.`, `?.[`) adds `null` to the result set.
- An empty result set falls back to `any`, so "unknown" and "mixed" are indistinguishable downstream.
- Anything type-related is covered in `test/test-utils.ts` as a `['expression', 'expected|types']` table – add
  a row there rather than writing a new test block.

## Conventions

- 2-space indent, TypeScript, ES modules (`.editorconfig`, `.eslintrc.json`). `@typescript-eslint/no-explicit-any`
  is deliberately off.
- Tests import the package by name (`@valtzu/codemirror-lang-el`) with a `// @ts-expect-error TS2307` above the
  import – that is intentional, it resolves to the built `dist/` at runtime. Keep the pattern in new test files.
- `DEBUG=1 npm test` makes `test/test-linter.ts` dump the parsed syntax tree – useful when a diagnostic lands on
  the wrong node.
- Diagnostic and tooltip messages are HTML (rendered via `createInfoElement`), so identifiers are wrapped in
  `<code>…</code>`.
- Add user-facing changes to `CHANGELOG.md` under the upcoming version heading, matching the existing terse
  bullet style; mark breaking changes as `**BC BREAK:**`.
- Do not edit `CONFIGURATION.md` by hand. Regenerate it after changing `src/types.ts`:
  `npx tsdoc --src=src/types.ts --dest=CONFIGURATION.md --noemoji --types`
- `package.json` has no `version` field on purpose – the release workflow derives it from the git tag
  (`npm --no-git-tag-version version from-git`). Don't add one.

## Release

Publishing happens on a GitHub release via `.github/workflows/publish.yml` (npm Trusted Publishing, no token).
Tag names are plain versions (`1.4.0`).
