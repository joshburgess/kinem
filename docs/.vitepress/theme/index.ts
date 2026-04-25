/**
 * Custom VitePress theme: extends the default theme with the
 * `<Playground>` component registered globally so markdown files can
 * embed live examples anywhere.
 */

import type { Theme } from "vitepress"
import DefaultTheme from "vitepress/theme"
import Playground from "./Playground.vue"

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("Playground", Playground)
  },
} satisfies Theme
