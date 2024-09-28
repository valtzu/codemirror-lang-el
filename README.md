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
<script type="importmap">
    {
      "imports": {
        "codemirror": "https://esm.sh/*codemirror@6.0.1",
        "@codemirror/state": "https://esm.sh/*@codemirror/state@6.4.1",
        "@codemirror/search": "https://esm.sh/*@codemirror/search@6.5.6",
        "@codemirror/autocomplete": "https://esm.sh/*@codemirror/autocomplete@6.9.0",
        "@codemirror/view": "https://esm.sh/*@codemirror/view@6.26.3",
        "@codemirror/commands": "https://esm.sh/*@codemirror/commands@6.2.5",
        "@codemirror/language": "https://esm.sh/*@codemirror/language@6.9.0",
        "@codemirror/lint": "https://esm.sh/*@codemirror/lint@6.4.1",
        "@lezer/lr": "https://esm.sh/*@lezer/lr@1.3.9",
        "@lezer/highlight": "https://esm.sh/*@lezer/highlight@1.1.6",
        "@lezer/common": "https://esm.sh/*@lezer/common@1.2.1",
        "style-mod": "https://esm.sh/*style-mod@4.1.2",
        "w3c-keyname": "https://esm.sh/*w3c-keyname@2.2.8",
        "crelt": "https://esm.sh/*crelt@1.0.6",
        "@valtzu/codemirror-lang-el": "https://esm.sh/*@valtzu/codemirror-lang-el@0.6.3"
      }
    }
</script>
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
                    { name: "is_granted", args: ["subject", "object"], info: 'Check if subject has permission to the object', returnType: ['bool'] },
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
