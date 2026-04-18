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
| startup-commit           |  100 |   3.2 |    6.8 |   0.3 |
| startup-commit           |  500 |  13.5 |   21.5 |  11.6 |
| startup-commit           | 1000 |  25.0 |   39.8 |   9.6 |
| startup-shared-def       |  100 |   8.6 |    8.4 |   5.9 |
| startup-shared-def       |  500 |  12.6 |   19.6 |   7.1 |
| startup-shared-def       | 1000 |  21.6 |   37.6 |   8.6 |
| cancel-before-first      |  100 |   1.5 |    1.3 |   0.2 |
| cancel-before-first      |  500 |   5.1 |    6.7 |   0.4 |
| cancel-before-first      | 1000 |  11.7 |   12.0 |   0.5 |
| steady-state (10 frames) |  100 |  76.6 |   81.3 |  81.6 |
| steady-state (10 frames) |  500 |  83.0 |   86.1 |  76.4 |
| steady-state (10 frames) | 1000 |  99.5 |  114.2 |  79.2 |

Takeaways:

- motif is consistently ahead of motion on startup, and at parity or
  better on steady-state. The 1.4x-1.9x startup gap is the clearest
  win from the recent perf work (lazy WAAPI, planWaapi memo cache,
  scheduler tightening, allocation cleanup).
- GSAP wins startup and cancel by a lot. That's the flip side of its
  JS-ticker model: no `Element.animate()` calls at all, so there's
  nothing to set up or tear down. For "churn through many short-lived
  tweens" patterns, it's hard to beat.
- GSAP is ~20% ahead of motif at steady-state n=1000. Its global
  ticker is tight; we're still paying per-handle scheduler overhead.
  Room to close the gap at very high n.
- At steady-state n=100, all three are within noise (paint-bound).
