# Symfony Expression Language support for CodeMirror

### Example

![image](https://github.com/valtzu/codemirror-lang-el/assets/652734/928ea2e8-6061-46c9-8ac1-16f95fb5661c)


```html
<div id="editor"></div>
<script type="importmap">
    {
      "imports": {
        "codemirror": "https://esm.sh/*codemirror@6.0.1",
        "@codemirror/state": "https://esm.sh/*@codemirror/state@6.4.1",
        "@codemirror/search": "https://esm.sh/*@codemirror/search@6.5.6",
        "@codemirror/autocomplete": "https://esm.sh/*@codemirror/autocomplete@6.9.0",
        "@codemirror/view": "https://esm.sh/*@codemirror/view@6.17.1",
        "@codemirror/commands": "https://esm.sh/*@codemirror/commands@6.2.5",
        "@codemirror/language": "https://esm.sh/*@codemirror/language@6.9.0",
        "@codemirror/lint": "https://esm.sh/*@codemirror/lint@6.4.1",
        "@lezer/lr": "https://esm.sh/*@lezer/lr@1.3.9",
        "@lezer/highlight": "https://esm.sh/*@lezer/highlight@1.1.6",
        "@lezer/common": "https://esm.sh/*@lezer/common@1.2.1",
        "style-mod": "https://esm.sh/*style-mod@4.1.2",
        "w3c-keyname": "https://esm.sh/*w3c-keyname@2.2.8",
        "crelt": "https://esm.sh/*crelt@1.0.6",
        "@valtzu/codemirror-lang-el": "https://esm.sh/*@valtzu/codemirror-lang-el@0.4.0"
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
            keymap.of([...defaultKeymap, {key: "Tab", run: acceptCompletion}]),
            expressionlanguage({
                types: {
                    "User": {
                        identifiers: [
                            { name: "self", type: ["User"], info: 'Self-reference for property-access demonstration purposes' },
                            { name: "name", type: ["string"] },
                            { name: "age", type: ["int"], info: "Years since birthday", detail: "years" },
                        ],
                        functions: [
                            { name: "isActive", returnType: ["bool"] },
                            { name: "getGroup", args: [], returnType: ["Group"], info: 'Get the user group' },
                        ],
                    },
                    "Group": {
                        identifiers: [{ name: "name", type: ["string"] }]
                    }
                },
                identifiers: [
                    { name: "user", type: ["User"], info: 'This is the user' },
                ],
                functions: [
                    { name: "is_granted", args: ["subject", "object"], info: 'Check if subject has permission to the object', returnType: ['bool'] },
                ],
            })
        ],
        parent: document.getElementById('editor'),
        doc: 'is_granted(user, user.self.getGroup())',
    });
</script>
```
