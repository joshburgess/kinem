# Changesets

This folder collects changeset files. Each file is a small markdown doc
describing a change to one or more packages, plus the semver bump it
implies (`patch`, `minor`, `major`).

## Workflow

1. While working on a change, add a changeset:

   ```sh
   pnpm changeset
   ```

   The CLI prompts for which packages changed, the bump type, and a short
   summary. Commit the resulting `.changeset/<name>.md` alongside your code.

2. When you're ready to release, version every package with a pending
   changeset:

   ```sh
   pnpm changeset:version
   ```

   This bumps `package.json` versions, updates each package's
   `CHANGELOG.md`, and removes the consumed changeset files. Commit the
   result.

3. Tag the release commit and push the tag. The existing
   `.github/workflows/release.yml` workflow publishes the bumped packages
   to npm with OIDC provenance.

   ```sh
   git tag v0.X.0
   git push origin v0.X.0
   ```

## Fixed package set

Every public `@kinem/*` package is in a single `fixed` group: they always
share a version. The devtools extension, examples, benchmarks, and docs
sites are private and excluded from changesets via the `ignore` list.

## Pre-1.0 peer dependency note

The framework adapters (`@kinem/react`, `@kinem/vue`, `@kinem/svelte`)
and `@kinem/devtools` declare `@kinem/core` as a `workspace:^`
peerDependency. While we are pre-1.0, a `minor` bump on `@kinem/core`
moves the published version (e.g. `0.3.0` to `0.4.0`) outside of the
`^0.3.0` range that the previous adapter release pinned, so changesets
treats it as a peer-breaking change and escalates every dependent (and
therefore the whole fixed group) to `major`.

In practice this means while pre-1.0 every release is effectively a
"major" jump (`0.3.0` to `1.0.0` to `2.0.0`, etc.). Once we're at
`>=1.0.0` minors will behave as expected. Use `patch` bumps for the
strict additive / bugfix changes that should keep the same minor.
