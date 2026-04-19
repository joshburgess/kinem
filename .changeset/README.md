# Changesets

This folder is managed by [changesets](https://github.com/changesets/changesets). It holds the pending release notes for each package in the workspace.

## Adding a changeset

When you land a change that should cause a new release (bug fix, new feature, breaking change), run:

```sh
pnpm changeset
```

It will prompt you for:

1. Which packages changed (kinem, @kinem/react, etc.)
2. The bump type for each (patch, minor, major)
3. A summary for the changelog

A markdown file lands in `.changeset/`. Commit it alongside your code change.

## What triggers a release

On every push to `main`, the GitHub Action in `.github/workflows/release.yml` runs `changesets/action`. If there are pending changesets, it opens (or updates) a `Version Packages` PR that bumps `package.json` versions and consolidates the changesets into each package's `CHANGELOG.md`. Merging that PR triggers the publish step.

## Not every PR needs a changeset

Docs-only edits, test refactors, internal chore work, and anything outside of `packages/*` do not need a changeset. Skip `pnpm changeset` in those PRs.
