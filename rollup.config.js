import typescript from "rollup-plugin-ts"
import { lezer } from "@lezer/generator/rollup"

const sourcemap = !process.env.CI;

export default [
  {
    input: "src/index.ts",
    external: id => id !== "tslib" && !/^(\.?\/|\w:)/.test(id),
    output: [
      { file: "dist/index.cjs", format: "cjs", sourcemap },
      { dir: "./dist", format: "es", sourcemap }
    ],
    plugins: [lezer(), typescript()]
  },
  {
    input: "src/linter.ts",
    external: id => id !== "tslib" && !/^(\.?\/|\w:)/.test(id),
    output: [
      { file: "dist/linter.cjs", format: "cjs", sourcemap },
      { dir: "./dist", format: "es", sourcemap }
    ],
    plugins: [lezer(), typescript()]
  },
  {
    input: "src/complete.ts",
    external: id => id !== "tslib" && !/^(\.?\/|\w:)/.test(id),
    output: [
      { file: "dist/complete.cjs", format: "cjs", sourcemap },
      { dir: "./dist", format: "es", sourcemap }
    ],
    plugins: [lezer(), typescript()]
  },
  {
    input: "src/tooltip.ts",
    external: id => id !== "tslib" && !/^(\.?\/|\w:)/.test(id),
    output: [
      { file: "dist/tooltip.cjs", format: "cjs", sourcemap },
      { dir: "./dist", format: "es", sourcemap }
    ],
    plugins: [lezer(), typescript()]
  },
  {
    input: "src/utils.ts",
    external: id => id !== "tslib" && !/^(\.?\/|\w:)/.test(id),
    output: [
      { file: "dist/utils.cjs", format: "cjs", sourcemap },
      { dir: "./dist", format: "es", sourcemap }
    ],
    plugins: [lezer(), typescript()]
  },
];
