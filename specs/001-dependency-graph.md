# 001 — Dependency graph

## Goal
Given a snapshot of a JS/TS project (`path → source text`), build a graph of which
file imports which, so later steps can walk it backwards from a changed file.

## Scope
- `src/lib/impact/parseImports.ts`, `resolve.ts`, `graph.ts`, `paths.ts`, `tests.ts`
- Pure functions, no Node or browser APIs, so the same code runs in the API route,
  in the browser, and in unit tests.

## Behaviour
1. Find module specifiers in all of these forms:
   - `import x from "./a"`, `import { a, b } from "./a"` (also across several lines)
   - `import type { T } from "./a"`, `export * from "./a"`, `export { a } from "./a"`
   - side-effect `import "./a"`, dynamic `import("./a")`, CommonJS `require("./a")`
2. Ignore anything inside `//` and `/* */` comments.
3. Resolve specifiers to files in the snapshot:
   - relative (`./`, `../`) and root-relative (`/`) paths
   - path aliases, default `@/` → `src/` and `~/` → `src/`, overridable per request
   - extension-less imports: try `.ts .tsx .mts .cts .js .jsx .mjs .cjs`, then `/index.*`
   - TS ESM style: `./a.js` resolves to `./a.ts` / `./a.tsx` when the `.js` file doesn't exist
4. Bare package imports (`react`, `zod`, `node:fs`) are external and are not edges.
5. Relative/alias imports that don't resolve are recorded as `unresolved` (with the
   path they pointed at), not thrown away. Spec 003 needs them for deleted files.
6. A path that climbs above the project root (`../../..`) resolves to nothing.
7. Test files are `*.test.*`, `*.spec.*`, or anything under a `__tests__/` folder.

## Acceptance criteria
- [ ] Every import form in (1) produces an edge in a unit test.
- [ ] A specifier that only appears in a comment produces no edge.
- [ ] `import "./a.js"` resolves to `a.ts` when only `a.ts` exists.
- [ ] `import "./pricing"` resolves to `pricing/index.ts`.
- [ ] Circular imports (a → b → a) build without errors or infinite loops.
- [ ] Windows-style paths (`src\\a.ts`) in the snapshot are normalised to `src/a.ts`.

## Known limits (documented, not bugs)
- No full tsconfig `paths` support. Only prefix aliases.
- Template-literal dynamic imports (`` import(`./${name}`) ``) can't be resolved statically.
