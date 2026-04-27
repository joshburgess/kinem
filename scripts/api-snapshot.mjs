#!/usr/bin/env node
/**
 * Public API surface snapshot.
 *
 * Walks each package's built entry-point declaration file with the
 * TypeScript Compiler API, enumerates every named export, and emits a
 * sorted, normalized listing of `<name>: <type signature>` per package.
 * The output goes to `api/<package>[.<entry>].api.md`.
 *
 * Why: catches unintentional breaking changes (renamed types, removed
 * exports, signature drift) before they ship. A small text file diff in
 * a PR is way easier to review than guessing whether a refactor changed
 * the public surface.
 *
 * Usage:
 *   pnpm api:snapshot   overwrite committed snapshots
 *   pnpm api:check      exit 1 if a re-emit differs from committed
 *
 * The script assumes packages are built (i.e. dist/index.d.ts exists).
 * In CI it runs after `pnpm build`.
 */

import { execSync } from "node:child_process"
import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "typescript"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const root = resolve(__dirname, "..")
const apiDir = resolve(root, "api")

const targets = [
  { name: "core", entry: "packages/core/dist/index.d.ts", outFile: "core.api.md" },
  { name: "core/slim", entry: "packages/core/dist/slim.d.ts", outFile: "core-slim.api.md" },
  { name: "react", entry: "packages/react/dist/index.d.ts", outFile: "react.api.md" },
  { name: "vue", entry: "packages/vue/dist/index.d.ts", outFile: "vue.api.md" },
  { name: "svelte", entry: "packages/svelte/dist/index.d.ts", outFile: "svelte.api.md" },
]

/**
 * Build a TypeScript program rooted at `entryPath` and return a sorted
 * list of `{ name, kind, signature }` for every named export.
 *
 * Signatures are derived via the type checker's `typeToString` so they
 * survive type aliases the source happens to use, and are stable across
 * unrelated refactors. Source-map comments and trailing whitespace are
 * stripped so the output is deterministic byte-for-byte.
 */
function snapshotEntry(entryPath) {
  const program = ts.createProgram([entryPath], {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    declaration: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    allowJs: false,
  })
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(entryPath)
  if (!sourceFile) throw new Error(`could not load ${entryPath}`)

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)
  if (!moduleSymbol) throw new Error(`no module symbol for ${entryPath}`)

  const printer = ts.createPrinter({
    newLine: ts.NewLineKind.LineFeed,
    removeComments: true,
    omitTrailingSemicolon: false,
  })

  const exports = checker.getExportsOfModule(moduleSymbol)
  const entries = []
  for (const exportedSym of exports) {
    const name = exportedSym.getName()
    // `export { Foo }` / `export type { Foo }` produce alias symbols whose
    // own flags are SymbolFlags.Alias only, so follow the chain to the
    // real declaration to pick up the actual kind (interface, type, etc.).
    const sym =
      exportedSym.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exportedSym) : exportedSym
    const decls = sym.declarations ?? []
    const flags = sym.getFlags()
    let kind
    if (flags & ts.SymbolFlags.Class) kind = "class"
    else if (flags & ts.SymbolFlags.Interface) kind = "interface"
    else if (flags & ts.SymbolFlags.TypeAlias) kind = "type"
    else if (flags & ts.SymbolFlags.Enum) kind = "enum"
    else if (flags & ts.SymbolFlags.Function) kind = "function"
    else if (flags & ts.SymbolFlags.Namespace) kind = "namespace"
    else if (flags & ts.SymbolFlags.Variable) kind = "const"
    else kind = "value"

    // Print every declaration node via the TS printer. Interface and
    // function symbols can have multiple declarations (function
    // overloads, interface merges); emit each so signature drift on
    // any overload is caught. Type aliases, classes, enums, and
    // variables have a single declaration each.
    const signatures = []
    for (const decl of decls) {
      // For variable declarations the parent is `const x: ...; ` so use
      // that whole statement so the modifier and type are both visible.
      const node = decl
      if (
        ts.isVariableDeclaration(decl) &&
        decl.parent &&
        ts.isVariableDeclarationList(decl.parent) &&
        decl.parent.parent &&
        ts.isVariableStatement(decl.parent.parent)
      ) {
        // Synthesize a declaration showing only the chosen variable so
        // grouped `const a, b` doesn't bleed into siblings.
        const text = `declare const ${decl.name.getText(decl.getSourceFile())}: ${
          decl.type
            ? decl.type.getText(decl.getSourceFile())
            : checker.typeToString(checker.getTypeAtLocation(decl))
        }`
        signatures.push(text)
        continue
      }
      const text = printer
        .printNode(ts.EmitHint.Unspecified, node, decl.getSourceFile())
        .replace(/\r\n/g, "\n")
        .trim()
      signatures.push(text)
    }
    if (signatures.length === 0) {
      // Fallback: derive from the symbol's type. Should rarely fire.
      const type = checker.getDeclaredTypeOfSymbol(sym)
      signatures.push(checker.typeToString(type))
    }
    entries.push({ name, kind, signatures })
  }

  entries.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return entries
}

function formatSnapshot(target, entries) {
  const lines = [
    `# ${target.name}: public API surface`,
    "",
    "Auto-generated by `scripts/api-snapshot.mjs`. Do not edit by hand.",
    "Regenerate via `pnpm api:snapshot` after a deliberate API change.",
    "",
    `## Exports (${entries.length})`,
    "",
  ]
  for (const e of entries) {
    lines.push(`### ${e.kind} \`${e.name}\``)
    lines.push("")
    lines.push("```ts")
    for (const sig of e.signatures) lines.push(sig)
    lines.push("```")
    lines.push("")
  }
  return `${lines.join("\n").trimEnd()}\n`
}

function ensureBuilt() {
  for (const t of targets) {
    try {
      readFileSync(resolve(root, t.entry))
    } catch {
      console.error(`Missing build artifact: ${t.entry}`)
      console.error("Run `pnpm build` first.")
      process.exit(1)
    }
  }
}

function main() {
  const args = process.argv.slice(2)
  const check = args.includes("--check")

  ensureBuilt()
  mkdirSync(apiDir, { recursive: true })

  let mismatches = 0
  for (const t of targets) {
    const entries = snapshotEntry(resolve(root, t.entry))
    const next = formatSnapshot(t, entries)
    const outPath = resolve(apiDir, t.outFile)
    if (check) {
      let prev = ""
      try {
        prev = readFileSync(outPath, "utf8")
      } catch {
        prev = ""
      }
      if (prev !== next) {
        mismatches++
        console.error(`API drift: ${relative(root, outPath)}`)
        try {
          writeFileSync(`${outPath}.next`, next)
          execSync(`diff -u "${outPath}" "${outPath}.next" || true`, { stdio: "inherit" })
        } finally {
          try {
            execSync(`rm -f "${outPath}.next"`)
          } catch {}
        }
      }
    } else {
      writeFileSync(outPath, next)
      console.log(`wrote ${relative(root, outPath)} (${entries.length} exports)`)
    }
  }

  if (check && mismatches > 0) {
    console.error(
      `\n${mismatches} package(s) have API drift. Run \`pnpm api:snapshot\` and commit the diff if intentional.`,
    )
    process.exit(1)
  }
}

main()
