import { createRollupConfig } from "../../rollup.config.base.mjs"

export default createRollupConfig({
  input: "src/index.ts",
  external: ["react", "react-dom", "react/jsx-runtime"],
  tsx: true,
})
