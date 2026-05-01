import type { Demo } from "../demo"

export const staggerGrid3d: Demo = {
  id: "stagger-grid-3d",
  title: "Stagger ripple · 3D grid",
  blurb:
    "Click anywhere on the grid. `stagger(oneCell, { from: fromGrid(...) })` produces a single AnimationDef whose interpolated value is an array of per-cube states; `playValues` drives them straight into Three.js mesh positions and rotations. Same primitive that drives `cube-wall`, applied to a non-DOM target.",
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
      background: "radial-gradient(ellipse at 50% 30%, #18213d 0%, #060810 75%)",
    })
    stage.appendChild(loading)

    import("./stagger-grid-3d-impl")
      .then(({ mountStaggerGrid3d }) => {
        if (disposed) return
        loading.remove()
        cleanup = mountStaggerGrid3d(stage)
      })
      .catch((err) => {
        if (disposed) return
        loading.textContent = "Failed to load 3D scene"
        console.error("[stagger-grid-3d]", err)
      })

    return () => {
      disposed = true
      loading.remove()
      cleanup?.()
    }
  },
}
