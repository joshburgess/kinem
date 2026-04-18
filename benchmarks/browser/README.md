# browser benchmarks

Real-browser comparison harness for motif vs motion vs gsap. Runs under
Vite with workspace-aliased `motif-animate`. Unlike the Vitest benches
(which use happy-dom and stub out WAAPI), this harness exercises the
actual Chrome compositor, `Element.animate()`, and layout pipeline.

## Running

The canonical way is the Playwright runner, which spawns Vite + a
headed Chrome, foregrounds the tab (no rAF throttling), and drives the
bench hooks from Node:

```
pnpm -C benchmarks/browser bench:profile --n 1000 --samples 7
pnpm -C benchmarks/browser bench:compare --n 1000 --samples 5
```

Flags: `--n`, `--samples`, `--channel=chrome|chromium` (default
`chrome`), `--headless` (not recommended for perf).

You can also drive the page manually:

```
pnpm -C benchmarks/browser dev
# then open http://localhost:5178/
```

The page exposes `window.__runMotif(scenario, n)`,
`window.__runMotifMain(scenario, n)`, `window.__runMotion(scenario, n)`,
and `window.__runGsap(scenario, n)`. `__runMotif` uses the default
`mode: "auto"`, which routes compositor-safe props through WAAPI.
`__runMotifMain` passes `mode: "main"`, which forces rAF + per-frame JS
writes (the same model as GSAP). Each call returns the elapsed wall
time in ms.

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

Absolute wall time in milliseconds at n=1000, median of 5 runs. Driven
by `bench:compare` (Playwright, foregrounded tab, no rAF throttling).

| scenario            | motif (auto) | motif (main) | motion |  gsap |
|---------------------|--------------|--------------|--------|-------|
| startup-commit      |         11.4 |          4.3 |   13.7 |  10.2 |
| startup-shared-def  |         11.9 |          4.1 |   13.8 |  10.7 |
| cancel-before-first |          2.2 |          2.5 |    5.0 |   0.9 |
| steady-state        |         82.9 |         71.3 |   87.3 |  79.0 |

Headline:

- With `mode: "main"`, motif is the fastest library here on three of
  the four scenarios. Startup is ~2.4x faster than GSAP (4.3 vs 10.2
  ms) and ~3.2x faster than motion (4.3 vs 13.7). Steady-state beats
  GSAP (71.3 vs 79.0) and motion (71.3 vs 87.3).
- Default `mode: "auto"` pays compositor-setup cost on startup in
  exchange for compositor-driven ticking that's resilient to main-
  thread jank. Still beats motion on all four scenarios.
- GSAP still wins cancel-before-first (0.9 ms) because its kill is a
  linked-list unlink on a tween that hasn't allocated anything yet.
  motif-main is at 2.5, half of motion's 5.0 but ~2.8x behind GSAP.

Pick `mode: "main"` when you want raw throughput and can tolerate
animation pauses if the main thread is blocked. Pick the default
(`mode: "auto"`) when resilience to main-thread jank matters more
than peak startup throughput. Paint and composite are GPU-accelerated
in both modes because `will-change` promotes the element to its own
layer.

### Recent optimizations

- **Merged compute + update scheduler phases in `Timing`.** The
  rAF tick used to register two arrow-field closures (one in
  `compute`, one in `update`); since our compute step doesn't
  touch the DOM, splitting it buys nothing and halves scheduler ops
  per play and per steady-state frame. Also cuts one closure
  allocation per play.
- **Lazy tier partition on the unique-def path.** Unique-def plays
  now ship `tierSplit` + `properties` on the `AnimationDef`
  itself, so the first play never walks `discoverProperties`
  or allocates via `partitionByTier`. Cache hits land in the
  WeakMap only for defs that didn't get pre-partitioned.
- Integrated will-change cleanup into the lazy WAAPI handle. The
  previous single-handle `combineHandles` wrapper existed only to
  chain cleanup onto `finished`; moving that into `lazyHandle`
  removes a whole layer of closure + lazy-promise allocation per
  play.
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
