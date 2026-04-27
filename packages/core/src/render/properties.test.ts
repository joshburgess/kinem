import { describe, expect, it } from "vitest"
import { classify, isCompositorSafe, partitionByTier, pseudoToTransformFn } from "./properties"

describe("property classification", () => {
  it("classifies known compositor-safe CSS props", () => {
    expect(classify("opacity").tier).toBe("compositor")
    expect(classify("transform").tier).toBe("compositor")
    expect(classify("filter").tier).toBe("compositor")
    expect(classify("clipPath").tier).toBe("compositor")
    expect(classify("clipPath").target).toBe("clip-path")
  })

  it("classifies pseudo transform shorthands", () => {
    expect(classify("x").tier).toBe("pseudo")
    expect(classify("x").target).toBe("transform")
    expect(classify("scale").apply).toBe("transform")
    expect(classify("rotate").tier).toBe("pseudo")
  })

  it("resolves pseudo props to their transform-function name", () => {
    expect(pseudoToTransformFn("x")).toBe("translateX")
    expect(pseudoToTransformFn("scale")).toBe("scale")
    expect(pseudoToTransformFn("rotate")).toBe("rotate")
    expect(pseudoToTransformFn("opacity")).toBeNull()
  })

  it("classifies SVG attrs as main-thread, apply=attr", () => {
    expect(classify("d").tier).toBe("main")
    expect(classify("d").apply).toBe("attr")
    expect(classify("strokeDashoffset").target).toBe("stroke-dashoffset")
  })

  it("preserves viewBox casing rather than kebab-casing", () => {
    // SVG's viewBox is one of the few attrs the spec keeps in camelCase.
    const info = classify("viewBox")
    expect(info.tier).toBe("main")
    expect(info.apply).toBe("attr")
    expect(info.target).toBe("viewBox")
  })

  it("unknown props default to main-thread style writes", () => {
    const info = classify("width")
    expect(info.tier).toBe("main")
    expect(info.apply).toBe("style")
    expect(info.target).toBe("width")
  })

  it("kebab-cases camelCase style names", () => {
    expect(classify("backgroundColor").target).toBe("background-color")
  })

  it("isCompositorSafe groups compositor and pseudo", () => {
    expect(isCompositorSafe("opacity")).toBe(true)
    expect(isCompositorSafe("x")).toBe(true)
    expect(isCompositorSafe("width")).toBe(false)
    expect(isCompositorSafe("d")).toBe(false)
  })

  it("partitionByTier splits props into compositor and main", () => {
    const { compositor, main } = partitionByTier([
      "x",
      "opacity",
      "width",
      "transform",
      "strokeDashoffset",
    ])
    expect(compositor).toEqual(["x", "opacity", "transform"])
    expect(main).toEqual(["width", "strokeDashoffset"])
  })
})
