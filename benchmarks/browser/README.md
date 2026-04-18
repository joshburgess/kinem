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

Absolute wall time in milliseconds at n=1000, median of 7 runs. Driven
by `bench:compare` (Playwright, foregrounded tab, no rAF throttling).

| scenario            | motif (auto) | motif (main) | motion |  gsap |
|---------------------|--------------|--------------|--------|-------|
| startup-commit      |         10.4 |          2.0 |   13.5 |  11.7 |
| startup-shared-def  |         12.2 |          2.0 |    9.7 |  11.9 |
| cancel-before-first |          0.8 |          0.7 |    3.5 |   0.3 |
| steady-state        |         78.9 |         70.3 |   79.4 |  78.7 |

Headline:

- With `mode: "main"`, motif is fastest on three of four scenarios.
  Startup is ~5.9x faster than GSAP (2.0 vs 11.7) and ~6.0x on
  shared-def (2.0 vs 11.9). Steady-state beats GSAP (70.3 vs 78.7)
  and motion (70.3 vs 79.4).
- Default `mode: "auto"` pays compositor-setup cost on startup in
  exchange for compositor-driven ticking that's resilient to main-
  thread jank. Cancel-before-first is 0.8 ms; motion is 3.5.
- GSAP still wins cancel-before-first at 0.3 ms. motif-main is at
  0.7 ms. The remaining gap is Timing + clock allocation inside
  playRaf (which still runs eagerly because deferring it regressed
  the steady-state path). GSAP's whole fast path is "alloc tween,
  unlink from global list."

Pick `mode: "main"` when you want raw throughput and can tolerate
animation pauses if the main thread is blocked. Pick the default
(`mode: "auto"`) when resilience to main-thread jank matters more
than peak startup throughput. Paint and composite are GPU-accelerated
in both modes because `will-change` promotes the element to its own
layer.

### Recent optimizations

- **Class-based `Clock` and `LazyPromise`.** Both are constructed once
  per play (inside `createTiming`) and previously allocated 5-6 fresh
  closures each from their factory functions. Converting to classes
  with prototype methods shares them across instances. Measured with
  `bench:profile` at n=1000, the unique-def play loop drops from
  ~0.7 ms to ~0.4 ms and shared-def from ~0.7 ms to ~0.4 ms.
- **Raf-only fast path in `playStrategy`.** When `mode: "main"` (or
  `backend: "raf"` directly), the strategy router now short-circuits
  to `playRaf()` without allocating the WAAPI scaffolding: no
  `handles` array, no `ensureWillChange`/`wrapWaapi`/`onWaapiSettle`
  closures, no `combineHandles` single-handle wrapper. Combined with
  inlining the `mode → backend` resolution in `play()` (so opts
  stops being spread per play) and collapsing `createControls`'s
  opts bag into positional args, cancel-before-first drops from
  ~0.9 ms to ~0.7 ms at n=1000.
- **Leaf defs stash the full tier split on the def.** `tween` /
  `keyframes` now publish `tierSplit: { props, compositor, main }`
  at construction, and `splitDef` returns it directly on the leaf
  path. Previously the router allocated a fresh three-field object
  per play to adapt the leaf's two-field split plus `def.properties`
  into the shape it consumed. One object per play at n=1000 was
  measurable; removing it makes the profile's unique-def `play`
  drop from ~1.1 ms to ~0.8 ms.
- **Defer Error alloc on cancel via `LazyPromise.rejectCancelled`.**
  `handle.cancel()` used to construct a `new Error("animation
  cancelled")` and stash it in the lazy promise in case anything
  ever awaits `.finished`. For fire-and-forget cancel patterns,
  nothing ever does. The Error + its stack capture is the single
  biggest per-cancel cost; deferring it to the `.promise` accessor
  made startup-commit at n=1000 go from 4.3 to 1.8 ms (mode:main),
  and cancel-before-first from 2.5 to 0.7 ms.
- **Timing is now a `KeepaliveNode`.** Instead of registering its
  tick fn in the scheduler (which allocated a wrapper node + a
  `Map<fn, node>` entry per play), the Timing instance is the
  linked-list node. Eliminates the per-play wrapper alloc, the
  Map entry, and the per-instance arrow-field closure.
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
