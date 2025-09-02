// @ts-expect-error TS2307
import { ELLanguage } from "@valtzu/codemirror-lang-el";
import { fileTests } from "@lezer/generator/dist/test";

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from 'url';
const caseDir = path.dirname(fileURLToPath(import.meta.url));

for (const file of fs.readdirSync(caseDir)) {
  if (!/\.txt$/.test(file)) {
    continue;
  }

  const name = /^[^.]*/.exec(file)[0];
  describe(name, () => {
    for (const { name, run } of fileTests(fs.readFileSync(path.join(caseDir, file), "utf8"), file)) {
      it(name, () => run(ELLanguage.parser));
    }
  });
}
