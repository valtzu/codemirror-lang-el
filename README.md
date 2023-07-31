# Symfony Expression Language support for CodeMirror

```javascript
import { EditorView, basicSetup } from "codemirror"
import { expressionlanguage } from "@valtzu/codemirror-lang-el";

let view = new EditorView({
  extensions: [basicSetup, expressionlanguage()],
  parent: document.body,
});
```
