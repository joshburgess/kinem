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

| scenario               |   n=100 |   n=500 |  n=1000 |
|------------------------|---------|---------|---------|
| cancel-before-first    |   0.93x |   0.93x |   0.95x |
| startup-commit         |   0.96x |   0.81x |   0.71x |
| steady-state (10 frames) | 1.01x |   1.04x |   0.92x |

Ratios are motif/motion (< 1.0 means motif is faster). Steady-state is
dominated by paint and is roughly at parity. Startup scales better for
motif than for motion (motion's keyframe resolver overhead dominates
at n=1000). Cancel-before-first is a slight motif win in the real
browser, inverting the 2.3x gap we observed under happy-dom: without a
real WAAPI implementation, motion's deferred setup short-circuited to
nothing, which never happens in a real browser.
