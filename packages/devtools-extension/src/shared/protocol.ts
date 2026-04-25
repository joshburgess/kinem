/**
 * Wire protocol shared by every layer of the extension:
 *
 *   page (MAIN) ⇄ content (ISOLATED) ⇄ background (SW) ⇄ devtools panel
 *
 * Only plain JSON-serializable values cross any boundary here. The page
 * agent never hands a live `Controls` to the content script because a
 * content script can't see objects allocated in the page world anyway;
 * instead, commands ride an id + verb tuple back to the agent, which
 * dereferences the hook locally.
 *
 * Naming convention: message `source` identifies the origin so every
 * listener can filter without ambiguity. `window.postMessage` in a
 * browser tab is a firehose (ad scripts, analytics, etc. all use it),
 * so the `source` tag matters more than you'd expect.
 */

/** Tag used on every `window.postMessage` sent by the page agent. */
export const AGENT_SOURCE = "kinem-agent"
/** Tag used on every `window.postMessage` sent into the page agent. */
export const PANEL_SOURCE = "kinem-panel"

export interface TargetDescriptor {
  readonly kind: "element" | "unknown"
  readonly tag?: string
  readonly id?: string
  readonly classes?: readonly string[]
}

export interface AnimationSnapshot {
  readonly id: number
  readonly duration: number
  readonly state: string
  readonly progress: number
  readonly startedAt: number
  readonly backend: string
  readonly targets: readonly TargetDescriptor[]
}

/** Events the agent pushes to the panel. */
export type AgentEvent =
  | { readonly kind: "hello"; readonly hookVersion: number }
  | {
      readonly kind: "snapshot"
      readonly capturedAt: number
      readonly animations: readonly AnimationSnapshot[]
    }
  | { readonly kind: "start"; readonly animation: AnimationSnapshot }
  | { readonly kind: "finish"; readonly id: number }
  | { readonly kind: "cancel"; readonly id: number }
  | { readonly kind: "detached" }

/** Commands the panel sends back to the agent. */
export type PanelCommand =
  | { readonly kind: "ping" }
  | { readonly kind: "request-snapshot" }
  | { readonly kind: "pause-all" }
  | { readonly kind: "resume-all" }
  | { readonly kind: "pause"; readonly id: number }
  | { readonly kind: "resume"; readonly id: number }
  | { readonly kind: "seek"; readonly id: number; readonly progress: number }
  | { readonly kind: "cancel"; readonly id: number }
  | { readonly kind: "set-polling"; readonly intervalMs: number }

/** Envelope for `window.postMessage` hops. */
export interface AgentEnvelope {
  readonly source: typeof AGENT_SOURCE
  readonly event: AgentEvent
}

export interface PanelEnvelope {
  readonly source: typeof PANEL_SOURCE
  readonly command: PanelCommand
}

/** Name used for `chrome.runtime.connect({ name })` from the panel. */
export const PANEL_PORT = "kinem-panel"
/** Name used for `chrome.runtime.connect({ name })` from the content script. */
export const CONTENT_PORT = "kinem-content"

/** Messages crossing `chrome.runtime.Port` between content ↔ background ↔ panel. */
export type RuntimeMessage =
  | { readonly kind: "init"; readonly tabId: number }
  | { readonly kind: "agent-event"; readonly event: AgentEvent }
  | { readonly kind: "panel-command"; readonly command: PanelCommand }
