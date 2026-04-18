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
| startup-commit           |  100 |   8.8 |   10.9 |   9.1 |
| startup-commit           |  500 |  15.5 |   23.3 |  11.8 |
| startup-commit           | 1000 |  22.5 |   46.0 |  14.2 |
| startup-shared-def       |  100 |   9.7 |   10.9 |   8.9 |
| startup-shared-def       |  500 |  14.3 |   21.5 |  10.9 |
| startup-shared-def       | 1000 |  22.4 |   40.3 |  13.0 |
| cancel-before-first      |  100 |   0.8 |    1.4 |   0.1 |
| cancel-before-first      |  500 |   3.9 |    6.2 |   0.2 |
| cancel-before-first      | 1000 |   7.7 |   13.4 |   0.3 |
| steady-state (10 frames) |  100 |  84.1 |   83.6 |  83.3 |
| steady-state (10 frames) |  500 |  86.7 |   92.4 |  83.2 |
| steady-state (10 frames) | 1000 | 105.6 |  111.5 |  83.3 |

Takeaways:

- motif beats motion across the board, with startup-commit at n=1000
  roughly 2x faster (22.5 vs 46.0 ms). Shared-def and cancel scenarios
  show the same 2x gap as n grows.
- motif is competitive with gsap at small n (startup-commit n=100:
  motif 8.8 vs gsap 9.1). At n=1000 gsap still leads by ~1.6x on
  startup because it skips WAAPI entirely, and by 25x on cancel-
  before-first because its kill is a linked-list unlink. The
  compositor hand-off we pay on startup is what buys free ticking
  later on; gsap trades that for cheap setup + per-tick JS cost.
- At steady-state n=1000, gsap is ~20% faster. That gap is the per-
  handle scheduler overhead (Set iteration in `keepalive`, per-tick
  scheduler re-arm). Lever B on the roadmap is swapping the
  `keepalive: Set` for a packed linked list to close this.
- At steady-state n=100, all three are within noise (paint-bound).

Recent work:

- Lazy-allocated `finished` promises. Handles no longer allocate the
  promise up front; it materializes on first access. For fire-and-
  forget cancel patterns (create N, cancel N without awaiting), motif
  now allocates zero promises at all. Pre-change cancel-before-first
  at n=1000 was ~11.7 ms; now 7.7 ms.
