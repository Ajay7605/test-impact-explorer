# 003 — Impact analysis and `POST /api/analyze`

## Goal
Answer "which tests do I need to run for this change, and why?"

## Algorithm (`src/lib/impact/impact.ts`)
1. For every changed path, walk the graph **backwards** (dependency → dependents) with
   breadth-first search, so the first path found to a test is the shortest one.
2. A changed file that is itself a test is affected at distance 0.
3. For each affected test keep:
   - `distance`: number of import hops from the nearest change
   - `chain`: the shortest path, `[changedFile, …, testFile]`
   - `triggeredBy`: every changed file that reaches it
4. **Deleted files** are not in the snapshot, but files that still import them show up as
   `unresolved` imports (spec 001). Treat those importers as direct dependents of the
   deleted path, because they are exactly the code the deletion breaks.
5. Renamed files seed from both the new path and the old path (for stale imports).
6. A changed path that isn't in the project and that nothing imports goes into
   `notFound` (a typo, or a non-code file like `README.md`).
7. Sort affected tests by distance, then by path.

## API contract
`POST /api/analyze`

```jsonc
// request
{
  "files":   { "src/a.ts": "…source…" },   // required, 1–5000 entries, ≤ 8 MB total
  "changes": "diff / name-status / path list", // required, see spec 002
  "aliases": { "@/": "src/" }               // optional
}
```

- `200`: `{ summary, changes, affectedTests, skippedTests, impactedFiles, notFound, graph, warnings }`
- `400`: `{ error }` for invalid JSON, wrong types, empty project, no changes found, or
  over the limits. The message must say what to fix.
- `graph` is the impacted subgraph only (changed, impacted and test nodes with a `layer`),
  capped at 150 nodes with `truncated: true`, so the UI can draw it.

## Acceptance criteria
- [ ] Sample project + change to `src/utils/date.ts` selects exactly 3 of 8 tests.
- [ ] Sample project + change to `src/utils/money.ts` selects 6 of 8 tests, through the
      `@/` alias and the `pricing/index.ts` barrel.
- [ ] Deleting a file that is still imported marks its importers' tests as affected.
- [ ] Changing a test file selects that test at distance 0.
- [ ] A cycle (`cart.ts` ↔ `cartEvents.ts`) doesn't loop forever.
- [ ] The route returns 400 with a helpful message for each invalid input listed above.
