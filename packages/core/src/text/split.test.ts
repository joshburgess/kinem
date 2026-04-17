// @vitest-environment happy-dom

import { describe, expect, it } from "vitest"
import { splitText } from "./split"

function mount(html: string): HTMLElement {
  const el = document.createElement("div")
  el.innerHTML = html
  document.body.appendChild(el)
  return el
}

describe("splitText", () => {
  it("wraps words by default and preserves whitespace", () => {
    const el = mount("hello world foo")
    const split = splitText(el)
    expect(split.words.length).toBe(3)
    expect(split.words.map((w) => w.textContent)).toEqual(["hello", "world", "foo"])
    expect(el.textContent).toBe("hello world foo")
  })

  it("wraps chars when requested", () => {
    const el = mount("abc de")
    const split = splitText(el, { by: "chars" })
    expect(split.chars.length).toBe(5)
    expect(split.chars.map((c) => c.textContent).join("")).toBe("abcde")
  })

  it("applies custom classes", () => {
    const el = mount("hi there")
    const split = splitText(el, {
      by: ["words", "chars"],
      wordClass: "w",
      charClass: "c",
    })
    for (const w of split.words) expect(w.className).toBe("w")
    for (const c of split.chars) expect(c.className).toBe("c")
  })

  it("wrappers use display: inline-block", () => {
    const el = mount("one two")
    const split = splitText(el, { by: ["words", "chars"] })
    for (const w of split.words) expect(w.style.display).toBe("inline-block")
    for (const c of split.chars) expect(c.style.display).toBe("inline-block")
  })

  it("revert() restores original HTML exactly", () => {
    const el = mount("hello <b>bold</b> world")
    const before = el.innerHTML
    const split = splitText(el, { by: ["words", "chars"] })
    expect(el.innerHTML).not.toBe(before)
    split.revert()
    expect(el.innerHTML).toBe(before)
  })

  it("descends into nested elements and splits their text", () => {
    const el = mount("<span>hello</span> <em>world</em>")
    const split = splitText(el, { by: "words" })
    expect(split.words.length).toBe(2)
    expect(split.words.map((w) => w.textContent)).toEqual(["hello", "world"])
    // wrapped inside original nested elements
    expect(el.querySelector("span")?.children.length).toBe(1)
    expect(el.querySelector("em")?.children.length).toBe(1)
  })

  it("handles unicode chars (emoji) as single grapheme clusters", () => {
    const el = mount("hi 👋")
    const split = splitText(el, { by: "chars" })
    const joined = split.chars.map((c) => c.textContent).join("")
    expect(joined).toBe("hi👋")
    expect(split.chars.at(-1)?.textContent).toBe("👋")
  })

  it("skips script and style tags", () => {
    const el = mount("hello <script>bad()</script> world")
    const split = splitText(el)
    expect(split.words.length).toBe(2)
    expect(el.querySelector("script")?.textContent).toBe("bad()")
  })

  it("returns empty arrays for an empty element", () => {
    const el = mount("")
    const split = splitText(el)
    expect(split.words).toEqual([])
    expect(split.chars).toEqual([])
    expect(split.lines).toEqual([])
  })

  it("groups words into a single line when offsetTop is uniform", () => {
    const el = mount("a b c")
    const split = splitText(el, { by: ["words", "lines"] })
    // happy-dom reports offsetTop 0 for every word; all land in one line
    expect(split.lines.length).toBe(1)
    expect(split.lines[0]!.children.length).toBeGreaterThan(0)
  })
})
