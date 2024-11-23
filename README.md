## Symfony Expression Language support for CodeMirror 6

> :warning: **This is unstable**: Expect breaking changes until v1 is out.

### Features

#### Linting

![image](https://github.com/valtzu/codemirror-lang-el/assets/652734/dd221b7d-7cc6-494f-9823-dae8a55eca03)

#### Autocompletion

![image](https://github.com/valtzu/codemirror-lang-el/assets/652734/a5a7bfdc-2869-4cbb-98f6-0abe361d55ba)

#### Hover tooltip

![image](https://github.com/valtzu/codemirror-lang-el/assets/652734/3cfd7a49-4503-491c-972d-26d209ea26f3)

#### Function argument hints

![image](https://github.com/valtzu/codemirror-lang-el/assets/652734/129eb510-a2aa-479e-b1de-dd0232b33299)

---

### Installation

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

Contributions are accepted.
