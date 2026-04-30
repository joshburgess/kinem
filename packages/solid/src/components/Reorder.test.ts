import { describe, expect, it } from "vitest"
import { ReorderGroup, type ReorderGroupProps, ReorderItem, type ReorderItemProps } from "./Reorder"

// Like the Solid `Motion` tests, full DOM-rendering coverage of the
// Solid `Reorder*` components requires Solid's browser build, which
// Vitest's default Node resolution does not load. The drag/sort engine
// is shared via `createReorderController` in `@kinem/core` and is
// covered there end-to-end against happy-dom; these smoke tests just
// validate the exported shapes for the Solid adapter.

describe("ReorderGroup / ReorderItem (solid)", () => {
  it("are exported as functions", () => {
    expect(typeof ReorderGroup).toBe("function")
    expect(typeof ReorderItem).toBe("function")
  })

  it("accept the documented `ReorderGroupProps` shape", () => {
    const props: ReorderGroupProps<string> = {
      values: ["a", "b"],
      onReorder: () => {},
      axis: "y",
      as: "ul",
    }
    expect(props.values).toHaveLength(2)
  })

  it("accept the documented `ReorderItemProps` shape", () => {
    const props: ReorderItemProps<string> = {
      value: "a",
      as: "li",
      idleCursor: "grab",
    }
    expect(props.value).toBe("a")
  })
})
