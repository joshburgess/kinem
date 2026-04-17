/**
 * Text splitter. Wraps every word, character, or line in a `<span>`
 * so they can be animated independently (typical entrance effects,
 * staggered reveals, variable-font morphs).
 *
 *   const split = splitText(el, { by: ["chars", "words"] })
 *   play(
 *     stagger(tween({ y: [20, 0], opacity: [0, 1] }, { duration: 400 }), {
 *       each: 20,
 *       count: split.chars.length,
 *     }),
 *     split.chars,
 *   )
 *   // when the animation finishes (or the page unmounts):
 *   split.revert()
 *
 * Words and chars are wrapped in `display: inline-block` so CSS
 * transforms and opacity animate correctly. Lines are `display: block`
 * since they group multiple inline words. Whitespace between words is
 * preserved as bare text nodes so natural line-breaking still works.
 *
 * `revert()` restores the original innerHTML exactly (including any
 * nested tags that were present before splitting). Always call it when
 * the animation is done so assistive technology and search engines see
 * the underlying text.
 */

export type SplitBy = "chars" | "words" | "lines"

export interface SplitOpts {
  /**
   * What to wrap. Order is irrelevant. Defaults to `["words", "chars"]`.
   * Include `"lines"` only when the element is in the live DOM with
   * layout available, since line detection reads `offsetTop`.
   */
  readonly by?: SplitBy | readonly SplitBy[]
  readonly charClass?: string
  readonly wordClass?: string
  readonly lineClass?: string
  /** Tag name used for wrappers. Defaults to `"span"`. */
  readonly wrapperTag?: string
}

export interface SplitResult {
  readonly chars: readonly HTMLElement[]
  readonly words: readonly HTMLElement[]
  readonly lines: readonly HTMLElement[]
  revert(): void
}

interface ResolvedOpts {
  readonly needsChars: boolean
  readonly needsLines: boolean
  readonly charClass: string | undefined
  readonly wordClass: string | undefined
  readonly lineClass: string | undefined
  readonly wrapperTag: string
}

export function splitText(target: HTMLElement, opts: SplitOpts = {}): SplitResult {
  const byList: readonly SplitBy[] = Array.isArray(opts.by)
    ? (opts.by as readonly SplitBy[])
    : opts.by
      ? [opts.by as SplitBy]
      : ["words", "chars"]
  const needsChars = byList.includes("chars")
  const needsLines = byList.includes("lines")
  const resolved: ResolvedOpts = {
    needsChars,
    needsLines,
    charClass: opts.charClass,
    wordClass: opts.wordClass,
    lineClass: opts.lineClass,
    wrapperTag: opts.wrapperTag ?? "span",
  }

  const original = target.innerHTML
  const words: HTMLElement[] = []
  const chars: HTMLElement[] = []

  const trailing = new Map<HTMLElement, Text>()
  walkAndSplit(target, resolved, words, chars, trailing)

  const lines = resolved.needsLines ? groupLines(target, words, trailing, resolved) : []

  return {
    chars,
    words,
    lines,
    revert() {
      target.innerHTML = original
    },
  }
}

function walkAndSplit(
  root: Node,
  opts: ResolvedOpts,
  words: HTMLElement[],
  chars: HTMLElement[],
  trailing: Map<HTMLElement, Text>,
): void {
  const children = Array.from(root.childNodes)
  for (const node of children) {
    if (node.nodeType === 3) {
      splitTextNode(node as Text, opts, words, chars, trailing)
    } else if (node.nodeType === 1) {
      const tag = (node as Element).tagName.toLowerCase()
      if (tag === "script" || tag === "style") continue
      walkAndSplit(node, opts, words, chars, trailing)
    }
  }
}

const WS_RE = /(\s+)/

function splitTextNode(
  text: Text,
  opts: ResolvedOpts,
  words: HTMLElement[],
  chars: HTMLElement[],
  trailing: Map<HTMLElement, Text>,
): void {
  const raw = text.data
  if (!raw) return
  const parent = text.parentNode
  if (!parent) return
  const doc = text.ownerDocument as Document
  const frag = doc.createDocumentFragment()
  const parts = raw.split(WS_RE).filter((p) => p !== "")

  let lastWord: HTMLElement | null = null
  for (const part of parts) {
    if (/^\s+$/.test(part)) {
      const ws = doc.createTextNode(part)
      frag.appendChild(ws)
      if (lastWord) trailing.set(lastWord, ws)
    } else {
      const wordEl = doc.createElement(opts.wrapperTag) as HTMLElement
      if (opts.wordClass) wordEl.className = opts.wordClass
      wordEl.style.display = "inline-block"
      if (opts.needsChars) {
        for (const ch of Array.from(part)) {
          const charEl = doc.createElement(opts.wrapperTag) as HTMLElement
          if (opts.charClass) charEl.className = opts.charClass
          charEl.style.display = "inline-block"
          charEl.textContent = ch
          wordEl.appendChild(charEl)
          chars.push(charEl)
        }
      } else {
        wordEl.textContent = part
      }
      frag.appendChild(wordEl)
      words.push(wordEl)
      lastWord = wordEl
    }
  }
  parent.replaceChild(frag, text)
}

function groupLines(
  _target: HTMLElement,
  words: readonly HTMLElement[],
  trailing: Map<HTMLElement, Text>,
  opts: ResolvedOpts,
): HTMLElement[] {
  if (words.length === 0) return []
  const doc = words[0]!.ownerDocument as Document
  const groups: HTMLElement[][] = []
  let currentTop = Number.NEGATIVE_INFINITY
  let current: HTMLElement[] = []
  for (const w of words) {
    const top = w.offsetTop
    if (top !== currentTop) {
      if (current.length) groups.push(current)
      current = []
      currentTop = top
    }
    current.push(w)
  }
  if (current.length) groups.push(current)

  const lines: HTMLElement[] = []
  for (const group of groups) {
    const first = group[0] as HTMLElement
    const parent = first.parentNode
    if (!parent) continue
    const line = doc.createElement(opts.wrapperTag) as HTMLElement
    if (opts.lineClass) line.className = opts.lineClass
    line.style.display = "block"
    parent.insertBefore(line, first)
    for (const w of group) {
      line.appendChild(w)
      const ws = trailing.get(w)
      if (ws && ws.parentNode === parent) line.appendChild(ws)
    }
    lines.push(line)
  }
  return lines
}
