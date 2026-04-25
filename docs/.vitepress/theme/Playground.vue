<!--
  Embeddable playground component. Renders a two-pane editor/preview
  layout and talks to an iframe that loads `/playground/runner.html`.

  Usage in markdown:

    <Playground :code="`
      const box = document.createElement('div')
      box.className = 'box'
      stage.appendChild(box)
      play(tween({ x: [0, 240], opacity: [0, 1] }, { duration: 900 }), box)
    `" />

  Or, via the `::: playground` custom container that `config.ts`
  registers:

    ::: playground
    const box = document.createElement('div')
    box.className = 'box'
    stage.appendChild(box)
    play(tween({ opacity: [0, 1] }, { duration: 700 }), box)
    :::

  The iframe lives at `/playground/runner.html`, served out of
  `docs/public/playground/` by VitePress. The kinem bundle is written
  there by `scripts/build-playground.mjs` before `vitepress dev`.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue"

const props = defineProps<{
  /** Initial source for the editor. Trimmed on mount. */
  code?: string
  /** Height of the stage iframe (CSS length). Defaults to 240px. */
  height?: string
}>()

const initialCode = (props.code ?? "").replace(/^\n+/, "").replace(/\s+$/, "")
const source = ref(initialCode)
const stageHeight = computed(() => props.height ?? "240px")
const iframe = ref<HTMLIFrameElement | null>(null)
const status = ref<"loading" | "ready" | "running" | "ok" | "error">("loading")
const errorMessage = ref<string | null>(null)

let ready = false
let pending: string | null = null
let debounceId: number | null = null

const runnerUrl = computed(() => {
  const base = typeof window !== "undefined" && window.location ? window.location.origin : ""
  return `${base}/playground/runner.html`
})

function send(kind: "run" | "clear", value?: string) {
  const el = iframe.value
  if (!el || !el.contentWindow) return
  el.contentWindow.postMessage({ source: "kinem-playground", kind, code: value }, "*")
}

function run() {
  const code = source.value
  if (!ready) {
    pending = code
    return
  }
  status.value = "running"
  errorMessage.value = null
  send("run", code)
}

function reset() {
  source.value = initialCode
  run()
}

function onMessage(event: MessageEvent) {
  const data = event.data as { source: string; kind: string; message?: string } | null
  if (!data || typeof data !== "object" || data.source !== "kinem-runner") return
  if (data.kind === "ready") {
    ready = true
    status.value = "ready"
    if (pending !== null) {
      const code = pending
      pending = null
      send("run", code)
      status.value = "running"
    } else if (initialCode.length > 0) {
      send("run", initialCode)
      status.value = "running"
    }
  } else if (data.kind === "ok") {
    status.value = "ok"
    errorMessage.value = null
  } else if (data.kind === "error") {
    status.value = "error"
    errorMessage.value = data.message ?? "Unknown error"
  }
}

watch(source, () => {
  if (debounceId !== null) window.clearTimeout(debounceId)
  debounceId = window.setTimeout(() => {
    debounceId = null
    run()
  }, 350)
})

onMounted(() => {
  window.addEventListener("message", onMessage)
})

onBeforeUnmount(() => {
  window.removeEventListener("message", onMessage)
  if (debounceId !== null) window.clearTimeout(debounceId)
})
</script>

<template>
  <div class="kinem-playground">
    <div class="kinem-playground__pane kinem-playground__pane--editor">
      <div class="kinem-playground__toolbar">
        <span class="kinem-playground__label">Source</span>
        <span class="kinem-playground__spacer"></span>
        <button type="button" class="kinem-playground__btn" @click="run">Run</button>
        <button type="button" class="kinem-playground__btn" @click="reset">Reset</button>
      </div>
      <textarea
        v-model="source"
        class="kinem-playground__editor"
        spellcheck="false"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="off"
        wrap="off"
      ></textarea>
    </div>
    <div class="kinem-playground__pane kinem-playground__pane--stage">
      <div class="kinem-playground__toolbar">
        <span class="kinem-playground__label">Preview</span>
        <span class="kinem-playground__spacer"></span>
        <span class="kinem-playground__status" :data-state="status">
          {{
            status === "loading"
              ? "Loading runner…"
              : status === "running"
                ? "Running…"
                : status === "ok"
                  ? "OK"
                  : status === "error"
                    ? "Error"
                    : "Ready"
          }}
        </span>
      </div>
      <iframe
        ref="iframe"
        class="kinem-playground__iframe"
        :src="runnerUrl"
        :style="{ height: stageHeight }"
        sandbox="allow-scripts allow-same-origin"
        loading="lazy"
      ></iframe>
      <pre v-if="errorMessage" class="kinem-playground__error">{{ errorMessage }}</pre>
    </div>
  </div>
</template>

<style scoped>
.kinem-playground {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 16px 0 24px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg-alt);
}
@media (max-width: 720px) {
  .kinem-playground { grid-template-columns: 1fr; }
}
.kinem-playground__pane { display: flex; flex-direction: column; min-width: 0; }
.kinem-playground__pane--editor { border-right: 1px solid var(--vp-c-divider); }
@media (max-width: 720px) {
  .kinem-playground__pane--editor {
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
  }
}
.kinem-playground__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--vp-c-bg);
  border-bottom: 1px solid var(--vp-c-divider);
  font-size: 12px;
}
.kinem-playground__label {
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.kinem-playground__spacer { flex: 1; }
.kinem-playground__status {
  font-size: 11px;
  color: var(--vp-c-text-2);
  font-variant-numeric: tabular-nums;
}
.kinem-playground__status[data-state="error"] { color: var(--vp-c-danger-1, #c43e3e); }
.kinem-playground__status[data-state="ok"] { color: var(--vp-c-brand-1, #3fb950); }
.kinem-playground__btn {
  appearance: none;
  font: inherit;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.kinem-playground__btn:hover {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-brand-1);
}
.kinem-playground__editor {
  flex: 1;
  min-height: 200px;
  border: 0;
  resize: vertical;
  padding: 10px 12px;
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 13px;
  line-height: 1.5;
  background: var(--vp-c-bg-alt);
  color: var(--vp-c-text-1);
  tab-size: 2;
  outline: none;
}
.kinem-playground__editor:focus {
  background: var(--vp-c-bg);
}
.kinem-playground__iframe {
  display: block;
  width: 100%;
  border: 0;
  background: #fafafa;
}
.kinem-playground__error {
  margin: 0;
  padding: 10px 12px;
  background: #7a1d1d;
  color: #ffd7d7;
  font-size: 11px;
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  white-space: pre-wrap;
  max-height: 160px;
  overflow: auto;
}
</style>
