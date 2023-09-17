# Symfony Expression Language support for CodeMirror

### Example

![image](https://github.com/valtzu/codemirror-lang-el/assets/652734/928ea2e8-6061-46c9-8ac1-16f95fb5661c)


```html
<div id="editor"></div>
<script type="importmap">
    {
      "imports": {
        "codemirror": "https://esm.sh/codemirror@6.0.1",
        "@codemirror/autocomplete": "https://esm.sh/@codemirror/autocomplete@6.9.0",
        "@codemirror/view": "https://esm.sh/@codemirror/view@6.17.1",
        "@codemirror/commands": "https://esm.sh/@codemirror/commands@6.2.5",
        "@codemirror/language": "https://esm.sh/@codemirror/language@6.9.0",
        "@codemirror/lint": "https://esm.sh/@codemirror/lint@6.4.1",
        "@lezer/lr": "https://esm.sh/@lezer/lr@1.3.9",
        "@lezer/highlight": "https://esm.sh/@lezer/highlight@1.1.6",
        "@valtzu/codemirror-lang-el": "https://esm.sh/*@valtzu/codemirror-lang-el@0.2.3"
      }
    }
</script>
<script type="module">
    import { EditorView, basicSetup } from "codemirror";
    import { acceptCompletion } from "@codemirror/autocomplete";
    import { keymap } from "@codemirror/view";
    import { expressionlanguage } from "@valtzu/codemirror-lang-el";

    let editor = new EditorView({
        extensions: [
            basicSetup,
            keymap.of([{key: "Tab", run: acceptCompletion}]),
            expressionlanguage({
                identifiers: [
                    { name: 'foo', info: 'Foo is a variable' },
                    { name: 'bar' }
                ],
                functions: [
                    { name: 'smh' },
                    { name: 'smash_my_head', args: ['object'] },
                ],
            })
        ],
        parent: document.getElementById('editor'),
    });
</script>
```
