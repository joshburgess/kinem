export interface Example {
  readonly id: string
  readonly title: string
  readonly description: string
  /** Mount into the given stage element. Return a cleanup function. */
  mount(stage: HTMLElement): () => void
  readonly wide?: boolean
  readonly tall?: boolean
}
