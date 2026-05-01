export type DemoGroup =
  | "Gestures"
  | "Pointer follow"
  | "Reactive values"
  | "Stagger & cascade"
  | "Paths & morphing"
  | "Particles"
  | "Shaders"
  | "Goo & blobs"
  | "Text & scroll"
  | "3D scenes"

export interface Demo {
  readonly id: string
  readonly title: string
  readonly blurb: string
  readonly group: DemoGroup
  mount(stage: HTMLElement): () => void
}
