/**
 * Service worker. Matches content-script ports (one per frame) to
 * devtools-panel ports (one per inspected tab) and shuttles messages
 * between them.
 *
 * Content ports self-identify via `sender.tab.id` — no negotiation
 * required. Panel ports send an explicit `init` message with the
 * `chrome.devtools.inspectedWindow.tabId` because DevTools UI runs in
 * its own context with no `sender.tab`.
 *
 * We intentionally avoid any persistent state beyond the in-memory
 * port maps. MV3 service workers can be torn down at any time; on
 * wake-up the ports still connect normally and we rebuild state
 * lazily.
 */

import { CONTENT_PORT, PANEL_PORT, type RuntimeMessage } from "./shared/protocol"

const contentPortsByTab = new Map<number, Set<chrome.runtime.Port>>()
const panelPortsByTab = new Map<number, chrome.runtime.Port>()

function addContentPort(tabId: number, port: chrome.runtime.Port): void {
  let set = contentPortsByTab.get(tabId)
  if (!set) {
    set = new Set()
    contentPortsByTab.set(tabId, set)
  }
  set.add(port)
}

function removeContentPort(tabId: number, port: chrome.runtime.Port): void {
  const set = contentPortsByTab.get(tabId)
  if (!set) return
  set.delete(port)
  if (set.size === 0) contentPortsByTab.delete(tabId)
}

function forwardToPanel(tabId: number, message: RuntimeMessage): void {
  const panel = panelPortsByTab.get(tabId)
  if (!panel) return
  try {
    panel.postMessage(message)
  } catch {
    panelPortsByTab.delete(tabId)
  }
}

function forwardToContent(tabId: number, message: RuntimeMessage): void {
  const set = contentPortsByTab.get(tabId)
  if (!set) return
  for (const port of set) {
    try {
      port.postMessage(message)
    } catch {
      set.delete(port)
    }
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === CONTENT_PORT) {
    const tabId = port.sender?.tab?.id
    if (tabId === undefined) return
    addContentPort(tabId, port)
    port.onMessage.addListener((message: RuntimeMessage) => {
      if (message.kind === "agent-event") forwardToPanel(tabId, message)
    })
    port.onDisconnect.addListener(() => removeContentPort(tabId, port))
    return
  }
  if (port.name === PANEL_PORT) {
    let tabId: number | null = null
    port.onMessage.addListener((message: RuntimeMessage) => {
      if (message.kind === "init") {
        tabId = message.tabId
        panelPortsByTab.set(tabId, port)
        return
      }
      if (tabId === null) return
      if (message.kind === "panel-command") forwardToContent(tabId, message)
    })
    port.onDisconnect.addListener(() => {
      if (tabId !== null) panelPortsByTab.delete(tabId)
    })
  }
})
