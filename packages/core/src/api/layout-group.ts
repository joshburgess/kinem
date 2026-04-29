/**
 * Shared-element layout transitions on top of FLIP.
 *
 * A `LayoutGroup` is a tiny rect registry keyed by string `layoutId`.
 * When a FLIP-driven element unmounts (or detects it is being replaced)
 * it `capture`s its bounding rect under the id. When a new element
 * mounts with the same id, it `consume`s the captured rect and uses it
 * as the FLIP "previous" rect so the element animates from where the
 * old one was. This is the same pattern Framer Motion exposes as
 * `layoutId`.
 *
 * The registry is intentionally framework-agnostic. Adapters
 * (`@kinem/react`'s `useLayout`, `@kinem/vue`'s `useLayout`, etc.) call
 * into it; consumers only see a `layoutId` option on those hooks.
 *
 * A captured rect has a TTL (default 1 frame at 60Hz). Stale entries
 * are dropped on read so a long-delayed mount does not animate from a
 * position that is no longer meaningful. Set TTL to `Infinity` for a
 * registry that should keep entries indefinitely (test usage).
 */

export interface LayoutGroupRect {
  readonly left: number
  readonly top: number
  readonly width: number
  readonly height: number
}

export interface LayoutGroupSnapshot {
  readonly id: string
  readonly rect: LayoutGroupRect
  readonly capturedAt: number
}

export interface LayoutGroup {
  /**
   * Store `rect` for `id`, replacing any prior capture.
   */
  capture(id: string, rect: LayoutGroupRect): void
  /**
   * Read and remove the snapshot for `id`. Returns `undefined` if no
   * snapshot is stored or if the stored snapshot is older than the TTL.
   */
  consume(id: string): LayoutGroupSnapshot | undefined
  /**
   * Read the snapshot for `id` without removing it. Returns `undefined`
   * if no snapshot is stored or if it is older than the TTL.
   */
  peek(id: string): LayoutGroupSnapshot | undefined
  /**
   * Explicitly drop the snapshot for `id`.
   */
  release(id: string): void
  /**
   * Drop every stored snapshot.
   */
  clear(): void
}

export interface CreateLayoutGroupOpts {
  /**
   * Maximum age (ms) of a stored snapshot before `consume` / `peek`
   * treat it as missing. Default 250ms (a long animation frame batch).
   * Use `Number.POSITIVE_INFINITY` to disable TTL.
   */
  readonly ttl?: number
  /**
   * Time source. Defaults to `Date.now`. Tests can supply a deterministic
   * clock here.
   */
  readonly now?: () => number
}

const DEFAULT_TTL = 250

export function createLayoutGroup(opts: CreateLayoutGroupOpts = {}): LayoutGroup {
  const ttl = opts.ttl ?? DEFAULT_TTL
  const now = opts.now ?? Date.now
  const snapshots = new Map<string, LayoutGroupSnapshot>()

  const isFresh = (snap: LayoutGroupSnapshot): boolean => {
    if (ttl === Number.POSITIVE_INFINITY) return true
    return now() - snap.capturedAt <= ttl
  }

  return {
    capture(id, rect) {
      snapshots.set(id, { id, rect, capturedAt: now() })
    },
    consume(id) {
      const snap = snapshots.get(id)
      if (!snap) return undefined
      snapshots.delete(id)
      return isFresh(snap) ? snap : undefined
    },
    peek(id) {
      const snap = snapshots.get(id)
      if (!snap) return undefined
      if (!isFresh(snap)) {
        snapshots.delete(id)
        return undefined
      }
      return snap
    },
    release(id) {
      snapshots.delete(id)
    },
    clear() {
      snapshots.clear()
    },
  }
}

/**
 * Process-wide default registry. Adapter hooks read from this when a
 * caller-supplied `layoutGroup` is not provided. SSR-safe (the registry
 * holds plain JS values, no DOM references).
 */
export const defaultLayoutGroup: LayoutGroup = createLayoutGroup()
