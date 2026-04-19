import { act, render } from "@testing-library/react"
import { tween } from "@kinem/core"
import { StrictMode, useEffect } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { useAnimation } from "./useAnimation"

type Anim = ReturnType<typeof useAnimation<HTMLDivElement>>

function Box({ onReady }: { onReady?: (anim: Anim) => void }) {
  const anim = useAnimation<HTMLDivElement>()
  useEffect(() => {
    onReady?.(anim)
  }, [anim, onReady])
  return <div data-testid="box" ref={anim.ref} />
}

afterEach(() => {
  // Let any pending rAF callbacks flush so they don't leak across tests.
})

describe("useAnimation", () => {
  it("returns a stable object across renders", () => {
    let seen: Anim | undefined
    let calls = 0
    const { rerender } = render(
      <Box
        onReady={(anim) => {
          seen = anim
          calls++
        }}
      />,
    )
    const first = seen
    rerender(
      <Box
        onReady={(anim) => {
          seen = anim
        }}
      />,
    )
    expect(seen).toBe(first)
    expect(calls).toBeGreaterThan(0)
  })

  it("plays an animation against the ref'd element", async () => {
    let anim: ReturnType<typeof useAnimation<HTMLDivElement>> | undefined
    render(
      <Box
        onReady={(a) => {
          anim = a
        }}
      />,
    )
    expect(anim).toBeDefined()
    if (!anim) return
    expect(anim.state).toBe("idle")

    let controls: ReturnType<typeof anim.play> | undefined
    act(() => {
      controls = anim?.play(tween({ width: ["0px", "100px"] }, { duration: 50 }), {
        backend: "raf",
      })
    })
    expect(controls).toBeDefined()
    expect(anim.state === "playing" || anim.state === "finished").toBe(true)

    act(() => {
      anim?.cancel()
    })
    expect(anim.state).toBe("cancelled")
  })

  it("cancels the in-flight animation when a new one is played", () => {
    let anim: ReturnType<typeof useAnimation<HTMLDivElement>> | undefined
    render(
      <Box
        onReady={(a) => {
          anim = a
        }}
      />,
    )
    if (!anim) throw new Error("no anim")

    let c1: ReturnType<typeof anim.play> | undefined
    act(() => {
      c1 = anim?.play(tween({ width: ["0px", "100px"] }, { duration: 1000 }), {
        backend: "raf",
      })
    })

    act(() => {
      anim?.play(tween({ width: ["0px", "50px"] }, { duration: 1000 }), {
        backend: "raf",
      })
    })
    expect(c1?.state).toBe("cancelled")
  })

  it("cancels on unmount", () => {
    let anim: ReturnType<typeof useAnimation<HTMLDivElement>> | undefined
    const { unmount } = render(
      <Box
        onReady={(a) => {
          anim = a
        }}
      />,
    )
    if (!anim) throw new Error("no anim")

    let controls: ReturnType<typeof anim.play> | undefined
    act(() => {
      controls = anim?.play(tween({ width: ["0px", "100px"] }, { duration: 1000 }), {
        backend: "raf",
      })
    })

    unmount()
    expect(controls?.state).toBe("cancelled")
  })

  it("survives StrictMode double-mount", () => {
    let anim: ReturnType<typeof useAnimation<HTMLDivElement>> | undefined
    render(
      <StrictMode>
        <Box
          onReady={(a) => {
            anim = a
          }}
        />
      </StrictMode>,
    )
    if (!anim) throw new Error("no anim")

    act(() => {
      anim?.play(tween({ width: ["0px", "100px"] }, { duration: 50 }), {
        backend: "raf",
      })
    })
    expect(["playing", "finished"]).toContain(anim.state)
  })
})
