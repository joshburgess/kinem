/**
 * Synchronous read/write batcher for tight DOM interop paths where the
 * frame scheduler's RAF cadence is too coarse. The batcher holds a
 * two-queue buffer: first all `read`s run, then all `write`s. Calling
 * `flush()` drains both in order; calling `read` / `write` inside a
 * flush defers to a follow-up pass.
 *
 * This is primarily used for FLIP-style layout animations, where we
 * need to read rects for many elements and then apply inverse
 * transforms without interleaving reads and writes.
 *
 * Enqueues made *during* a flush:
 *   - A `write` enqueued from inside a read runs in the same flush,
 *     after all reads (same phase ordering as the frame scheduler).
 *   - A `read` enqueued from inside a read or write defers to the next
 *     flush (the read pass is already sealed).
 *   - A `write` enqueued from inside a write defers to the next flush.
 */

export type ReadJob<T> = () => T
export type WriteJob = () => void

export interface Batch {
  /**
   * Enqueue a read. Returns a promise that resolves to the read value
   * when the next flush runs. If a flush is already in progress, the
   * read defers to the following flush pass.
   */
  read<T>(fn: ReadJob<T>): Promise<T>
  /** Enqueue a write. Resolves after the write runs. */
  write(fn: WriteJob): Promise<void>
  /** Drain all pending reads then writes. Returns the count processed. */
  flush(): { reads: number; writes: number }
  readonly size: number
}

interface PendingRead<T = unknown> {
  fn: ReadJob<T>
  resolve: (value: T) => void
  reject: (err: unknown) => void
}

interface PendingWrite {
  fn: WriteJob
  resolve: () => void
  reject: (err: unknown) => void
}

export function createBatch(): Batch {
  let reads: PendingRead[] = []
  let writes: PendingWrite[] = []
  let flushing = false

  const api: Batch = {
    read(fn) {
      return new Promise((resolve, reject) => {
        reads.push({ fn, resolve: resolve as (v: unknown) => void, reject })
      })
    },
    write(fn) {
      return new Promise<void>((resolve, reject) => {
        writes.push({ fn, resolve, reject })
      })
    },
    flush() {
      if (flushing) return { reads: 0, writes: 0 }
      flushing = true
      let readCount = 0
      let writeCount = 0
      try {
        // Snapshot and clear before invoking so re-entrant enqueues
        // land in the next generation.
        const r = reads
        reads = []
        for (let i = 0; i < r.length; i++) {
          const entry = r[i]
          if (!entry) continue
          try {
            entry.resolve(entry.fn())
          } catch (err) {
            entry.reject(err)
          }
          readCount++
        }
        const w = writes
        writes = []
        for (let i = 0; i < w.length; i++) {
          const entry = w[i]
          if (!entry) continue
          try {
            entry.fn()
            entry.resolve()
          } catch (err) {
            entry.reject(err)
          }
          writeCount++
        }
      } finally {
        flushing = false
      }
      return { reads: readCount, writes: writeCount }
    },
    get size() {
      return reads.length + writes.length
    },
  }

  return api
}

/** Process-wide default batch. Tests should construct their own. */
export const batch: Batch = createBatch()
