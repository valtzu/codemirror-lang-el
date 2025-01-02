// @ts-ignore
import { ELLanguage } from "@valtzu/codemirror-lang-el";
import { fileTests } from "@lezer/generator/dist/test";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
let caseDir = path.dirname(fileURLToPath(import.meta.url));

for (let file of fs.readdirSync(caseDir)) {
  if (!/\.txt$/.test(file)) continue;

  // @ts-ignore
  let name = /^[^.]*/.exec(file)[0];
  describe(name, () => {
    for (let { name, run } of fileTests(fs.readFileSync(path.join(caseDir, file), "utf8"), file)) {
      it(name, () => run(ELLanguage.parser));
    }
  });
}
