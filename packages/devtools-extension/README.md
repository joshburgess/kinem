# @kinem/devtools-extension

A Chrome DevTools panel for Kinem. Adds a "Kinem" tab to DevTools that
lists every active animation in the inspected page, plots live
progress, and lets you pause/resume/seek/cancel each one. A recording
button captures start/finish/cancel events to an exportable JSON log.

## Build

```sh
pnpm --filter @kinem/devtools-extension build
```

The built artifact lives at `packages/devtools-extension/dist/`. To
load it in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode** (toggle, top right)
3. Click **Load unpacked**
4. Select the `dist/` directory

Re-click **Reload** on the extension card after every rebuild.

`pnpm --filter @kinem/devtools-extension dev` keeps esbuild in watch
mode; you still need to reload the extension manually after each
rebuild.

## How it connects

The panel does **not** bundle `@kinem/core`. Instead it looks for a
`__KINEM_DEVTOOLS_HOOK__` installed on the inspected page's `window`
object. The hook is created automatically the first time
`enableTracker()` runs, which happens on import of `@kinem/devtools`
or by calling `enableTracker()` yourself. The MAIN-world agent script
subscribes to the hook and relays tracker events through
`window.postMessage` → ISOLATED-world content script →
`chrome.runtime` port → background service worker →
`chrome.runtime` port → panel.

If the panel shows "Waiting for kinem on this page…" the page either
hasn't loaded kinem yet or tracking hasn't been enabled. Importing
`@kinem/devtools` anywhere in your bundle is the shortest path:

```ts
import "@kinem/devtools"
```

## Files

| File | World | Purpose |
| --- | --- | --- |
| `manifest.json` | — | MV3 manifest |
| `src/agent.ts` | page MAIN | Subscribes to `__KINEM_DEVTOOLS_HOOK__`, posts events |
| `src/content.ts` | page ISOLATED | Relay between agent and background |
| `src/background.ts` | service worker | Routes per-tab ports |
| `src/devtools.ts` | devtools | Registers the "Kinem" panel |
| `src/panel.ts` | devtools panel | UI |
