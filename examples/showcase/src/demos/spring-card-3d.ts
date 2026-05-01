import type { Demo } from "../demo"

export const springCard3d: Demo = {
  id: "spring-card-3d",
  title: "Spring-settled 3D card",
  blurb:
    "Drag the card to twist it in 3D, then let go. Two independent `spring()` definitions (yaw and pitch) carry the release velocity into Three.js mesh rotations. No DOM target, just kinem driving raw values onto a non-DOM scene graph.",
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

    import("./spring-card-3d-impl")
      .then(({ mountSpringCard3d }) => {
        if (disposed) return
        loading.remove()
        cleanup = mountSpringCard3d(stage)
      })
      .catch((err) => {
        if (disposed) return
        loading.textContent = "Failed to load 3D scene"
        console.error("[spring-card-3d]", err)
      })

    return () => {
      disposed = true
      loading.remove()
      cleanup?.()
    }
  },
}
