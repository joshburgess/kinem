/**
 * Content script (ISOLATED world). Two-way relay between the page
 * agent (window.postMessage) and the background service worker
 * (chrome.runtime.Port). Every agent event is forwarded to the
 * background as an `agent-event`; every `panel-command` received from
 * the background is reposted into the page via `window.postMessage`
 * for the agent to pick up.
 *
 * One relay per frame: `all_frames: true` in the manifest means nested
 * iframes can also report animations. Each frame opens its own port.
 */

import {
  AGENT_SOURCE,
  type AgentEnvelope,
  CONTENT_PORT,
  PANEL_SOURCE,
  type PanelEnvelope,
  type RuntimeMessage,
} from "./shared/protocol"

let port: chrome.runtime.Port | null = null

function connectBackground(): void {
  port = chrome.runtime.connect({ name: CONTENT_PORT })
  port.onMessage.addListener((msg: RuntimeMessage) => {
    if (msg.kind !== "panel-command") return
    const envelope: PanelEnvelope = { source: PANEL_SOURCE, command: msg.command }
    window.postMessage(envelope, "*")
  })
  port.onDisconnect.addListener(() => {
    port = null
  })
}

window.addEventListener("message", (event) => {
  if (event.source !== window) return
  const data = event.data as AgentEnvelope | null
  if (!data || typeof data !== "object" || data.source !== AGENT_SOURCE) return
  if (!port) return
  const message: RuntimeMessage = { kind: "agent-event", event: data.event }
  try {
    port.postMessage(message)
  } catch {
    port = null
  }
})

connectBackground()
