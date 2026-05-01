import type { Demo } from "../demo"

export const productReveal3d: Demo = {
  id: "product-reveal-3d",
  title: "Timeline product reveal",
  blurb:
    "One `playValues` call drives a three-lane composition: camera fly-in (`tween`) → mesh scale-up with overshoot (`spring`) → DOM spec labels staggered in. After it lands, a slow orbit takes over.",
  group: "3D scenes",
  mount(stage) {
    let disposed = false
    let cleanup: (() => void) | null = null

    const loading = document.createElement("div")
    loading.textContent = "Loading 3D scene…"
    Object.assign(loading.style, {
      position: "absolute",
      inset: "0",
      display: "grid",
      placeItems: "center",
      color: "rgba(232,236,244,0.55)",
      font: "500 13px/1.4 ui-sans-serif, system-ui, sans-serif",
      letterSpacing: "0.18em",
      textTransform: "uppercase",
      background: "radial-gradient(ellipse at 50% 30%, #14182a 0%, #07080b 75%)",
    })
    stage.appendChild(loading)

    import("./product-reveal-3d-impl")
      .then(({ mountProductReveal3d }) => {
        if (disposed) return
        loading.remove()
        cleanup = mountProductReveal3d(stage)
      })
      .catch((err) => {
        if (disposed) return
        loading.textContent = "Failed to load 3D scene"
        console.error("[product-reveal-3d]", err)
      })

    return () => {
      disposed = true
      loading.remove()
      cleanup?.()
    }
  },
}
