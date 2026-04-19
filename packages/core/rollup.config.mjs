import resolve from "@rollup/plugin-node-resolve"
import { swc } from "rollup-plugin-swc3"

const swcPlugin = swc({
  jsc: {
    parser: { syntax: "typescript", tsx: false, decorators: false },
    target: "es2022",
    loose: true,
    keepClassNames: true,
    assumptions: {
      noClassCalls: true,
      setPublicClassFields: true,
      ignoreFunctionLength: true,
      ignoreFunctionName: true,
    },
  },
  sourceMaps: true,
})

function entry(name) {
  return {
    input: `src/${name}.ts`,
    external: [/^kinem/],
    output: [
      { file: `dist/${name}.js`, format: "es", sourcemap: true },
      { file: `dist/${name}.cjs`, format: "cjs", sourcemap: true, exports: "named" },
    ],
    plugins: [resolve({ extensions: [".ts", ".js"] }), swcPlugin],
  }
}

export default [entry("index"), entry("slim")]
