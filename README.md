## Symfony Expression Language support for CodeMirror 6

### Features

#### Linting

![image](https://github.com/user-attachments/assets/7f7dca5b-51fb-41d0-bfe2-d64a6ac6bf85)

1. Lint variable & function names
1. Lint object properties & methods, even on expression result
1. Lint argument count
1. Lint argument types

#### Autocompletion

![image](https://github.com/valtzu/codemirror-lang-el/assets/652734/a5a7bfdc-2869-4cbb-98f6-0abe361d55ba)

1. Complete variables & functions
1. Complete object properties & methods, even on expression result
1. Complete operator keywords (like `starts with`)
1. Show list of all available keywords (using `Ctrl+space` by default)

#### Hover tooltip

![image](https://github.com/valtzu/codemirror-lang-el/assets/652734/3cfd7a49-4503-491c-972d-26d209ea26f3)

1. Show description about a variable / function / object member / keyword

#### Function argument hints

![image](https://github.com/user-attachments/assets/571e056a-3947-4eda-b118-4f1850428fc4)

1. Show function argument name when the editor cursor is exactly at starting position of the argument

---

### Installation

#### Web Component

If you're using Bootstrap UI, check the [Web Component](https://github.com/valtzu/symfony-expression-editor) to hide all CodeMirror stuff.

```html
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<script type="module" src="https://esm.sh/symfony-expression-editor@0.1.0"></script>
<textarea class="form-control" is="expression-editor" rows="1">'foobar' starts with 'foo'</textarea>
```

#### Symfony AssetMapper

```
bin/console importmap:require @valtzu/codemirror-lang-el
```

#### npm

```
npm install @valtzu/codemirror-lang-el
```

#### Yarn

```
yarn add @valtzu/codemirror-lang-el
```

---

### Configuration

See [CONFIGURATION.md](CONFIGURATION.md)

### Example

[Live demo](https://jsfiddle.net/turse2xq/)

```html
<div id="editor"></div>
<script type="module">
    import { EditorView, basicSetup } from "codemirror";
    import { acceptCompletion } from "@codemirror/autocomplete";
    import { keymap } from "@codemirror/view";
    import { expressionlanguage } from "@valtzu/codemirror-lang-el";
    import { defaultKeymap } from "@codemirror/commands";

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
                    { name: "is_granted", args: [{name: "attributes", type: ["string"]}, {name: "object", type: ["object"], optional: true}], info: 'Check if subject has permission to the object', returnType: ['bool'] },
                ],
            })
        ],
        parent: document.getElementById('editor'),
        doc: 'is_granted(user, user.self.getGroup())',
    });
</script>
```

### Contributing

Contributions are welcome.
