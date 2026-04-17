import { describe, expect, it } from "vitest"
import { type ElementShim, applyValues } from "./apply"

function makeEl(): ElementShim & {
  styles: Map<string, string>
  attrs: Map<string, string>
} {
  const styles = new Map<string, string>()
  const attrs = new Map<string, string>()
  return {
    styles,
    attrs,
    style: {
      setProperty(name, value) {
        styles.set(name, value)
      },
    },
    setAttribute(name, value) {
      attrs.set(name, value)
    },
  }
}

describe("applyValues", () => {
  it("writes simple style props as kebab-case", () => {
    const el = makeEl()
    applyValues(el, { backgroundColor: "#ff0000", width: "100px" })
    expect(el.styles.get("background-color")).toBe("#ff0000")
    expect(el.styles.get("width")).toBe("100px")
  })

  it("composes pseudo transform props in canonical order", () => {
    const el = makeEl()
    applyValues(el, { scale: 1.2, x: 50, rotate: 45 })
    expect(el.styles.get("transform")).toBe("translateX(50px) rotate(45deg) scale(1.2)")
  })

  it("applies default units for pseudo transforms when given numbers", () => {
    const el = makeEl()
    applyValues(el, { x: 10, rotate: 90, scale: 2 })
    const t = el.styles.get("transform")!
    expect(t).toContain("translateX(10px)")
    expect(t).toContain("rotate(90deg)")
    expect(t).toContain("scale(2)")
  })

  it("preserves string values (respecting user-supplied units)", () => {
    const el = makeEl()
    applyValues(el, { x: "5rem", rotate: "0.5turn" })
    const t = el.styles.get("transform")!
    expect(t).toBe("translateX(5rem) rotate(0.5turn)")
  })

  it("pseudo props override explicit transform when both are present", () => {
    const el = makeEl()
    applyValues(el, { transform: "scale(3) rotate(180deg)", x: 20 })
    expect(el.styles.get("transform")).toBe("translateX(20px)")
  })

  it("uses explicit transform when no pseudo props are provided", () => {
    const el = makeEl()
    applyValues(el, { transform: "matrix(1, 0, 0, 1, 10, 20)" })
    expect(el.styles.get("transform")).toBe("matrix(1, 0, 0, 1, 10, 20)")
  })

  it("writes SVG attrs via setAttribute, not style", () => {
    const el = makeEl()
    applyValues(el, { strokeDashoffset: 42, d: "M0 0 L10 10" })
    expect(el.attrs.get("stroke-dashoffset")).toBe("42")
    expect(el.attrs.get("d")).toBe("M0 0 L10 10")
    expect(el.styles.has("stroke-dashoffset")).toBe(false)
  })

  it("skips undefined values", () => {
    const el = makeEl()
    applyValues(el, { opacity: 0.5, width: undefined as unknown as string })
    expect(el.styles.get("opacity")).toBe("0.5")
    expect(el.styles.has("width")).toBe(false)
  })
})
