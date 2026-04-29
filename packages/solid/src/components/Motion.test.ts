import { describe, expect, it } from "vitest"
import { Motion, type MotionProps } from "./Motion"

// The Solid `Motion` component is a Solid component (a function that
// returns a `JSX.Element`). Full DOM-rendering tests require Solid's
// browser/dev build, which Vitest's default Node resolution does not
// pick up out-of-the-box. The component's animation logic is shared
// with the React/Vue/Svelte adapters and is exercised by their tests
// against `@kinem/core`. The smoke tests here validate the exported
// shape; integration coverage lives in the showcase example.

describe("Motion (solid)", () => {
  it("is exported as a function", () => {
    expect(typeof Motion).toBe("function")
  })

  it("accepts the documented `MotionProps` shape", () => {
    // Compile-time check: the assignment below must typecheck without
    // error. No runtime assertion is needed beyond the test running.
    const props: MotionProps = {
      as: "div",
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 200 },
      class: "x",
      "data-testid": "m",
    }
    expect(typeof props.as).toBe("string")
  })
})
