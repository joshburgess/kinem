# browser benchmarks

Real-browser comparison harness for motif vs motion. Runs under Vite with
workspace-aliased `motif-animate`. Unlike the Vitest benches (which use
happy-dom and stub out WAAPI), this harness exercises the actual Chrome
compositor, `Element.animate()`, and layout pipeline.

## Running

```
pnpm -C benchmarks/browser dev
# then open http://localhost:5178/
```

The page exposes `window.__runMotif(scenario, n)` and
`window.__runMotion(scenario, n)` for driving from devtools or MCP
automation. Each call returns the elapsed wall time in ms.

Scenarios:
- `cancel-before-first` — create N animations and cancel before the first rAF
- `startup-commit` — create N, wait one rAF (forces real keyframe setup), cancel
- `steady-state` — create N, yield 10 rAFs, cancel

## Interpreting results

Don't trust any single-run number. The click-button path runs 5 samples
and reports the median. If you're automating via `evaluate_script`,
sample at least 5 times and take the median. GC and paint variance are
significant at n=1000.

## Observed results (2026-04, Chrome, M-series Mac)

| scenario                 |   n=100 |   n=500 |  n=1000 |
|--------------------------|---------|---------|---------|
| cancel-before-first      |   0.77x |   0.88x |   1.05x |
| startup-commit           |   0.53x |   0.65x |   0.73x |
| steady-state (10 frames) |   1.03x |   0.90x |   0.91x |

Ratios are motif/motion (< 1.0 means motif is faster). Startup is a
clear motif win across the board (motion's keyframe resolver and
deferred-setup machinery show up here). Steady-state is dominated by
paint and hovers around parity. Cancel-before-first favors motif at
small n and converges at n=1000 where both libs end up doing similar
bookkeeping before the cancel lands.
