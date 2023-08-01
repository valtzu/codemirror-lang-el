# Symfony Expression Language support for CodeMirror

```javascript
import {EditorView, basicSetup} from "codemirror";
import { expressionlanguage } from "@valtzu/codemirror-lang-el";
import {acceptCompletion} from "@codemirror/autocomplete";
import {keymap} from "@codemirror/view"

let editor = new EditorView({
    extensions: [
        keymap.of([{key: "Tab", run: acceptCompletion}]),
        basicSetup,
        expressionlanguage({ identifiers: ['foo', 'bar'], functions: {'smh': [], smash_my_head: ['object']} })
    ],
    parent: document.body,
});

```
