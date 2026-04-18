# browser benchmarks

Real-browser comparison harness for motif vs motion vs gsap. Runs under
Vite with workspace-aliased `motif-animate`. Unlike the Vitest benches
(which use happy-dom and stub out WAAPI), this harness exercises the
actual Chrome compositor, `Element.animate()`, and layout pipeline.

## Running

```
pnpm -C benchmarks/browser dev
# then open http://localhost:5178/
```

The page exposes `window.__runMotif(scenario, n)`,
`window.__runMotion(scenario, n)`, and `window.__runGsap(scenario, n)`
for driving from devtools or MCP automation. Each call returns the
elapsed wall time in ms.

Scenarios:
- `cancel-before-first` — create N animations and cancel before the first rAF
- `startup-commit` — create N, wait one rAF (forces real keyframe setup), cancel
- `startup-shared-def` — same as startup-commit, but all N plays share one
  `AnimationDef`. Exercises the `planWaapi` memo cache.
- `steady-state` — create N, yield 10 rAFs, cancel

## Interpreting results

Don't trust any single-run number. The click-button path runs 5 samples
and reports the median. If you're automating via `evaluate_script`,
sample at least 5 times and take the median. GC and paint variance are
significant at n=1000.

**Model differences matter.** motif and motion both route compositor-
safe properties through `Element.animate()` (WAAPI), paying real setup
cost to offload ticking to the compositor. GSAP runs everything as
per-frame JS via a single global ticker, so its setup is basically
object allocation and its cancel is a splice. This caches out very
differently across scenarios. Same benchmark, different strategy, both
are defensible for different workloads.

## Observed results (2026-04, Chrome, M-series Mac)

Absolute wall time in milliseconds, median of 5 runs:

| scenario                 | n    | motif | motion |  gsap |
|--------------------------|------|-------|--------|-------|
| startup-commit           |  100 |   9.3 |   10.9 |   9.2 |
| startup-commit           |  500 |  14.5 |   20.0 |  10.7 |
| startup-commit           | 1000 |  21.4 |   38.9 |  12.5 |
| startup-shared-def       |  100 |   8.8 |   10.3 |   8.9 |
| startup-shared-def       |  500 |  14.2 |   19.4 |  10.5 |
| startup-shared-def       | 1000 |  19.9 |   38.1 |  12.3 |
| cancel-before-first      |  100 |   0.2 |    1.3 |   0.1 |
| cancel-before-first      |  500 |   1.3 |    5.8 |   0.1 |
| cancel-before-first      | 1000 |   2.5 |   13.5 |   0.2 |
| steady-state (10 frames) |  100 |  84.0 |   83.5 |  83.3 |
| steady-state (10 frames) |  500 |  86.0 |   85.3 |  83.2 |
| steady-state (10 frames) | 1000 |  97.7 |  110.8 |  83.1 |

Takeaways:

- motif beats motion across the board. At n=1000: startup-commit is
  ~1.8x faster (21.4 vs 38.9 ms), shared-def ~1.9x (19.9 vs 38.1),
  cancel-before-first ~5.4x (2.5 vs 13.5).
- motif is competitive with gsap on small workloads (startup-commit
  n=100: motif 9.3 vs gsap 9.2). At n=1000 gsap still leads by ~1.7x
  on startup because it skips WAAPI entirely, and by ~12x on cancel-
  before-first because its kill is a linked-list unlink. The
  compositor hand-off we pay on startup is what buys free ticking
  later on; gsap trades that for cheap setup + per-tick JS cost.
- At steady-state n=1000, gsap is ~15% faster. The remaining gap is
  the per-handle scheduler overhead for non-compositor bookkeeping
  (the `keepalive` linked list walk) plus the scheduler re-arm cost.
  At n=100, all three are within noise (paint-bound).

Recent work:

- Integrated will-change cleanup into the lazy WAAPI handle. The
  previous single-handle `combineHandles` wrapper existed only to
  chain cleanup onto `finished`; moving that into `lazyHandle`
  removes a whole layer of closure + lazy-promise allocation per
  play. Pre-change cancel-before-first at n=1000 was 6.6 ms; now
  2.5 ms (-62%).
- Cached tier partition per `AnimationDef`. Shared-def plays no
  longer re-run `discoverProperties` + `partitionByTier` each
  time; the result is memoized via WeakMap alongside the existing
  `planWaapi` cache.
- Converted `Controls` to a class with prototype methods, so the
  ~15 methods per play are shared instead of reallocated as fresh
  closures.
- Swapped the frame scheduler's `keepalive: Set` for a doubly-
  linked list. Iteration walks pointers; registration and cancel
  are O(1) via a Map sidecar.
- Lazy-allocated `finished` promises. Handles no longer allocate
  the promise up front; it materializes on first access. For fire-
  and-forget cancel patterns, motif now allocates zero promises
  at all.
