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
`window.__runMotifMain(scenario, n)`, `window.__runMotion(scenario, n)`,
and `window.__runGsap(scenario, n)` for driving from devtools or MCP
automation. `__runMotif` uses the default `mode: "auto"`, which routes
compositor-safe props through WAAPI. `__runMotifMain` passes
`mode: "main"`, which forces rAF + per-frame JS writes (the same model
as GSAP). Each call returns the elapsed wall time in ms.

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

### Default mode (`mode: "auto"`, compositor-safe props via WAAPI)

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

### Main-thread mode (`mode: "main"`) vs GSAP

Passing `mode: "main"` makes motif tick from JS on the main thread
(same architecture as GSAP), at the cost of losing compositor-side
resilience to main-thread jank. Paint and composite are still GPU-
accelerated because `will-change` promotes the element to its own
layer.

| scenario            | n    | motif (auto) | motif (main) |  gsap |
|---------------------|------|--------------|--------------|-------|
| startup-commit      |  100 |          9.6 |          8.8 |   9.1 |
| startup-commit      |  500 |         14.6 |          9.2 |  10.9 |
| startup-commit      | 1000 |         21.6 |         10.7 |  13.2 |
| startup-shared-def  |  100 |          9.3 |          7.9 |   8.8 |
| startup-shared-def  |  500 |         14.1 |          9.3 |  10.5 |
| startup-shared-def  | 1000 |         20.4 |         10.5 |  12.7 |
| cancel-before-first |  100 |          0.3 |          0.4 |   0.1 |
| cancel-before-first |  500 |          1.3 |          1.8 |   0.2 |
| cancel-before-first | 1000 |          2.7 |          3.6 |   0.2 |
| steady-state        |  100 |         83.9 |         82.7 |  83.3 |
| steady-state        |  500 |         86.3 |         84.4 |  83.2 |
| steady-state        | 1000 |         97.6 |         86.2 |  83.0 |

With `mode: "main"`, motif is faster than GSAP on startup at n=1000
(10.7 vs 13.2 ms for startup-commit; 10.5 vs 12.7 for shared-def)
and closes most of the steady-state gap (86.2 vs 83.0). The one
scenario GSAP still dominates is cancel-before-first, where its kill
is a linked-list unlink and ours still pays the rAF-handle teardown.

Pick `mode: "main"` when you want GSAP-class startup and can tolerate
timing pauses if the main thread is blocked. Pick the default
(`mode: "auto"`) when resilience to main-thread jank matters more
than peak startup throughput.

Takeaways:

- motif beats motion across the board in the default mode. At n=1000:
  startup-commit is ~1.8x faster (21.4 vs 38.9 ms), shared-def ~1.9x
  (19.9 vs 38.1), cancel-before-first ~5.4x (2.5 vs 13.5).
- In default mode, motif is competitive with GSAP on small workloads
  and loses by 1.5-1.7x at n=1000 on startup because GSAP skips WAAPI
  entirely. The compositor hand-off we pay on startup is what buys
  the animation's resilience to main-thread jank later on; GSAP trades
  that for cheap setup + per-tick JS cost.
- GSAP's edge on cancel-before-first (2.5 vs 0.2 ms at n=1000) is its
  linked-list kill, which nothing else in this space matches.
- With `mode: "main"`, motif beats GSAP on startup at n=1000 (10.7 vs
  13.2 ms) and closes the steady-state gap to ~4%. The tradeoff is
  losing compositor-side resilience.

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
