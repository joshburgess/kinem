# Public API snapshots

Auto-generated, human-readable summaries of every package's public type
surface. They exist so a PR diff makes API changes obvious: rename a
type, drop an export, or alter a function signature and the relevant
`*.api.md` file shifts.

## How it works

`scripts/api-snapshot.mjs` walks each package's built `dist/index.d.ts`
(and slim entry point for core) with the TypeScript Compiler API,
enumerates every named export, and emits the declaration text. Output is
sorted by export name so unrelated reorderings don't churn the diff.

## Updating

When you intentionally change the public API:

```sh
pnpm build
pnpm api:snapshot
```

Then commit the regenerated `api/*.api.md` alongside the source change.

## CI

`pnpm api:check` runs in CI after `pnpm build`. It re-emits the snapshot
and exits non-zero on any diff, printing a unified diff of the drift.
That makes intentional API changes a deliberate two-line commit and
unintentional ones a CI failure.
