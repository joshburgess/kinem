export interface Demo {
  readonly id: string
  readonly title: string
  readonly blurb: string
  readonly group: "Gesture" | "Showcase"
  mount(stage: HTMLElement): () => void
}
