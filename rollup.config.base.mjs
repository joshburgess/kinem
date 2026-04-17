import resolve from "@rollup/plugin-node-resolve"
import { swc } from "rollup-plugin-swc3"

export function createRollupConfig({ input = "src/index.ts", external = [], tsx = false }) {
  return {
    input,
    external: [...external, /^motif-animate/],
    output: [
      {
        file: "dist/index.js",
        format: "es",
        sourcemap: true,
      },
      {
        file: "dist/index.cjs",
        format: "cjs",
        sourcemap: true,
        exports: "named",
      },
    ],
    plugins: [
      resolve({ extensions: tsx ? [".tsx", ".ts", ".js"] : [".ts", ".js"] }),
      swc({
        jsc: {
          parser: { syntax: "typescript", tsx, decorators: false },
          transform: tsx ? { react: { runtime: "automatic" } } : undefined,
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
      }),
    ],
  }
}
