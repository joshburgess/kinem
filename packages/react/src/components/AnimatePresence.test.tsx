import { act, render } from "@testing-library/react"
import { type ReactNode, useContext } from "react"
import { describe, expect, it } from "vitest"
import { AnimatePresence } from "./AnimatePresence"
import { Motion } from "./Motion"
import { PresenceContext } from "./presence"

function PresenceProbe({ label, onContext }: { label: string; onContext?: (v: boolean) => void }) {
  const ctx = useContext(PresenceContext)
  onContext?.(ctx?.isPresent ?? true)
  return <div data-testid={label}>{label}</div>
}

function ExitingProbe({ label, onExit }: { label: string; onExit?: () => void }) {
  const ctx = useContext(PresenceContext)
  if (ctx && !ctx.isPresent) {
    // Call safeToRemove asynchronously to simulate a finished exit animation.
    setTimeout(() => {
      onExit?.()
      ctx.safeToRemove()
    }, 0)
  }
  return <div data-testid={label}>{label}</div>
}

describe("AnimatePresence", () => {
  it("renders keyed children as-is when they stay present", () => {
    const { getByTestId, rerender } = render(
      <AnimatePresence>
        <PresenceProbe key="a" label="a" />
      </AnimatePresence>,
    )
    expect(getByTestId("a").textContent).toBe("a")
    rerender(
      <AnimatePresence>
        <PresenceProbe key="a" label="a" />
      </AnimatePresence>,
    )
    expect(getByTestId("a").textContent).toBe("a")
  })

  it("keeps a removed keyed child mounted as exiting until safeToRemove", async () => {
    let exitCalls = 0
    const { queryByTestId, rerender } = render(
      <AnimatePresence>
        <ExitingProbe
          key="a"
          label="a"
          onExit={() => {
            exitCalls++
          }}
        />
      </AnimatePresence>,
    )
    expect(queryByTestId("a")).not.toBeNull()

    rerender(<AnimatePresence>{null as ReactNode}</AnimatePresence>)
    // Still mounted synchronously — exit animation has not completed.
    expect(queryByTestId("a")).not.toBeNull()

    // Wait for the scheduled setTimeout(0) → safeToRemove.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 5))
    })
    expect(queryByTestId("a")).toBeNull()
    expect(exitCalls).toBe(1)
  })

  it("propagates isPresent via context: true for active, false for exiting", async () => {
    const states: boolean[] = []
    const { rerender } = render(
      <AnimatePresence>
        <PresenceProbe key="a" label="a" onContext={(p) => states.push(p)} />
      </AnimatePresence>,
    )
    expect(states[states.length - 1]).toBe(true)

    rerender(
      <AnimatePresence>
        <PresenceProbe key="a" label="a" onContext={(p) => states.push(p)} />
      </AnimatePresence>,
    )

    rerender(<AnimatePresence>{null as ReactNode}</AnimatePresence>)
    await act(async () => {
      await Promise.resolve()
    })
    expect(states).toContain(false)
  })

  it("integrates with <Motion>: exit animation fires safeToRemove", async () => {
    const { queryByTestId, rerender } = render(
      <AnimatePresence>
        <Motion
          key="box"
          data-testid="box"
          initial={{ width: "0px" }}
          animate={{ width: "100px" }}
          exit={{ width: "0px" }}
          transition={{ duration: 20, backend: "raf" }}
        />
      </AnimatePresence>,
    )
    expect(queryByTestId("box")).not.toBeNull()

    rerender(<AnimatePresence>{null as ReactNode}</AnimatePresence>)
    // Wait long enough for the rAF-backed 20ms tween to finish.
    await act(async () => {
      await new Promise<void>((resolve) => setTimeout(resolve, 100))
    })
    expect(queryByTestId("box")).toBeNull()
  })
})
