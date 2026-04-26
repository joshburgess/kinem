/**
 * Typed error class used by every user-facing throw in `@kinem/core`.
 * All messages are prefixed with `kinem:` so consumers can identify the
 * source at a glance, and an optional `hint` field carries actionable
 * guidance separately from the headline message.
 *
 *   try {
 *     play(def, ".missing")
 *   } catch (err) {
 *     if (err instanceof KinemError) console.warn(err.hint)
 *   }
 */
export class KinemError extends Error {
  /** A short, actionable suggestion. May be empty. */
  readonly hint: string

  constructor(message: string, hint = "") {
    super(hint ? `kinem: ${message} - ${hint}` : `kinem: ${message}`)
    this.name = "KinemError"
    this.hint = hint
  }
}
