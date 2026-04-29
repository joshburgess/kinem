import { createRollupConfig } from "../../rollup.config.base.mjs"

export default createRollupConfig({
  input: "src/index.ts",
  external: ["solid-js", "solid-js/web", "solid-js/store"],
  tsx: false,
})
