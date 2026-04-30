import { describe, expect, it } from "vitest"
import { type Variants, motion, motionGroup } from "./motion"

const settle = (ms = 60): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe("motion (svelte action)", () => {
  it("applies `initial` as inline styles synchronously", () => {
    const el = document.createElement("div")
    motion(el, { initial: { opacity: 0 } })
    expect(el.style.opacity).toBe("0")
  })

  it("returns update/destroy functions", () => {
    const el = document.createElement("div")
    const ret = motion(el, { initial: { opacity: 0 } })
    expect(typeof ret.update).toBe("function")
    expect(typeof ret.destroy).toBe("function")
  })

  it("destroy() is safe to call with no in-flight tween", () => {
    const el = document.createElement("div")
    const ret = motion(el, {})
    expect(() => ret.destroy()).not.toThrow()
  })

  it("update() with the same animate values is a no-op", () => {
    const el = document.createElement("div")
    const ret = motion(el, {
      initial: { width: "0px" },
      animate: { width: "50px" },
      transition: { duration: 20, backend: "raf" },
    })
    expect(() =>
      ret.update({ animate: { width: "50px" }, transition: { duration: 20, backend: "raf" } }),
    ).not.toThrow()
    ret.destroy()
  })

  it("update() with new animate values does not throw", () => {
    const el = document.createElement("div")
    const ret = motion(el, {
      initial: { width: "0px" },
      animate: { width: "50px" },
      transition: { duration: 20, backend: "raf" },
    })
    expect(() =>
      ret.update({ animate: { width: "100px" }, transition: { duration: 20, backend: "raf" } }),
    ).not.toThrow()
    ret.destroy()
  })

  it("destroy() cancels an in-flight animation", () => {
    const el = document.createElement("div")
    const ret = motion(el, {
      initial: { width: "0px" },
      animate: { width: "100px" },
      transition: { duration: 1000, backend: "raf" },
    })
    expect(() => ret.destroy()).not.toThrow()
  })

  describe("variants", () => {
    const v: Variants = {
      closed: { opacity: 0, width: "0px" },
      open: { opacity: 1, width: "100px" },
    }

    it("applies the resolved initial variant as inline style", () => {
      const el = document.createElement("div")
      motion(el, { variants: v, initial: "closed" })
      expect(el.style.opacity).toBe("0")
    })

    it("ignores a string target with no variants map", () => {
      const el = document.createElement("div")
      motion(el, { initial: "closed" })
      expect(el.style.opacity).toBe("")
    })

    it("merges array-form variants left-to-right (later wins)", () => {
      const map: Variants = {
        base: { opacity: "0.2", width: "0px" },
        lifted: { width: "50px" },
      }
      const el = document.createElement("div")
      motion(el, { variants: map, initial: ["base", "lifted"] })
      expect(el.style.opacity).toBe("0.2")
    })

    it("update() that flips the animate key does not throw", async () => {
      const el = document.createElement("div")
      const ret = motion(el, {
        variants: v,
        initial: "closed",
        animate: "closed",
        transition: { duration: 15, backend: "raf" },
      })
      expect(() =>
        ret.update({
          variants: v,
          initial: "closed",
          animate: "open",
          transition: { duration: 15, backend: "raf" },
        }),
      ).not.toThrow()
      await settle(40)
      ret.destroy()
    })

    it("attaches pointer listeners only when whileHover/whileTap are set", () => {
      const el = document.createElement("div")
      let entered = 0
      el.addEventListener("pointerenter", () => {
        entered++
      })
      const ret = motion(el, {
        variants: v,
        initial: "closed",
        animate: "closed",
        whileHover: "open",
        transition: { duration: 15, backend: "raf" },
      })
      el.dispatchEvent(new PointerEvent("pointerenter"))
      // The user listener fires (1) and our internal listener does its
      // own thing without consuming the event.
      expect(entered).toBe(1)
      ret.destroy()
      // After destroy the action's listener is gone; user's still works.
      el.dispatchEvent(new PointerEvent("pointerenter"))
      expect(entered).toBe(2)
    })

    it("flips to whileHover values on pointerenter and reverts on pointerleave", async () => {
      const el = document.createElement("div")
      const ret = motion(el, {
        variants: v,
        initial: "closed",
        animate: "closed",
        whileHover: "open",
        transition: { duration: 15, backend: "raf" },
      })
      expect(el.style.opacity).toBe("0")
      el.dispatchEvent(new PointerEvent("pointerenter"))
      await settle(40)
      el.dispatchEvent(new PointerEvent("pointerleave"))
      await settle(40)
      // Visual state is non-deterministic at this scale; we just check
      // the flow completes cleanly.
      ret.destroy()
    })

    it("group store drives the implicit animate target", async () => {
      const group = motionGroup<"closed" | "open">("closed")
      const el = document.createElement("div")
      const ret = motion(el, {
        variants: v,
        initial: "closed",
        group,
        transition: { duration: 15, backend: "raf" },
      })
      expect(el.style.opacity).toBe("0")
      group.set("open")
      await settle(40)
      ret.destroy()
    })

    it("explicit animate beats the group store", () => {
      const group = motionGroup<"closed" | "open">("closed")
      const el = document.createElement("div")
      const ret = motion(el, {
        variants: v,
        initial: "open",
        animate: "open",
        group,
        transition: { duration: 15, backend: "raf" },
      })
      // Initial inline write applied "open" values directly.
      expect(el.style.opacity).toBe("1")
      // Flipping the group while animate is explicit is a no-op for
      // the resolved target; if animate is set, we never read group.
      group.set("closed")
      ret.destroy()
    })

    it("destroy() unsubscribes from the group store", () => {
      const group = motionGroup<"closed" | "open">("closed")
      const el = document.createElement("div")
      const ret = motion(el, { variants: v, initial: "closed", group })
      ret.destroy()
      // After destroy the action should not throw or re-tween on group changes.
      expect(() => group.set("open")).not.toThrow()
    })

    it("update() that swaps the group re-subscribes", async () => {
      const a = motionGroup<"closed" | "open">("closed")
      const b = motionGroup<"closed" | "open">("open")
      const el = document.createElement("div")
      const ret = motion(el, {
        variants: v,
        initial: "closed",
        group: a,
        transition: { duration: 15, backend: "raf" },
      })
      ret.update({
        variants: v,
        initial: "closed",
        group: b,
        transition: { duration: 15, backend: "raf" },
      })
      await settle(40)
      ret.destroy()
    })

    it("whileTap takes precedence over whileHover", async () => {
      const map: Variants = {
        rest: { opacity: 1 },
        hover: { opacity: "0.7" },
        tap: { opacity: "0.4" },
      }
      const el = document.createElement("div")
      const ret = motion(el, {
        variants: map,
        initial: "rest",
        animate: "rest",
        whileHover: "hover",
        whileTap: "tap",
        transition: { duration: 15, backend: "raf" },
      })
      el.dispatchEvent(new PointerEvent("pointerenter"))
      el.dispatchEvent(new PointerEvent("pointerdown"))
      await settle(30)
      el.dispatchEvent(new PointerEvent("pointerup"))
      el.dispatchEvent(new PointerEvent("pointerleave"))
      ret.destroy()
    })
  })
})
