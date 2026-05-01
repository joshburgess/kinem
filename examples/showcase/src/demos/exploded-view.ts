import type { Demo } from "../demo"

export const explodedView: Demo = {
  id: "exploded-view",
  title: "Scroll-scrubbed exploded view",
  blurb:
    "Scroll inside the frame. A kinem `scroll({ sync: true })` drives a 0→1 timeline that simultaneously translates Three.js layers outward and projects DOM callouts onto each part. One source of truth, two render targets.",
  group: "3D scenes",
  mount(stage) {
    let disposed = false
    let cleanup: (() => void) | null = null

    // Loading shim while three.js streams in.
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

    import("./exploded-view-impl")
      .then(({ mountExplodedView }) => {
        if (disposed) return
        loading.remove()
        cleanup = mountExplodedView(stage)
      })
      .catch((err) => {
        if (disposed) return
        loading.textContent = "Failed to load 3D scene"
        console.error("[exploded-view]", err)
      })

    return () => {
      disposed = true
      loading.remove()
      cleanup?.()
    }
  },
}
