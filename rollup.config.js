import typescript from "rollup-plugin-ts"
import { lezer } from "@lezer/generator/rollup"

const sourcemap = !process.env.CI;

export default {
  input: "src/index.ts",
  external: id => id !== "tslib" && !/^(\.?\/|\w:)/.test(id),
  output: [
    { file: "dist/index.cjs", format: "cjs", sourcemap },
    { dir: "./dist", format: "es", sourcemap }
  ],
  plugins: [lezer(), typescript()]
}
