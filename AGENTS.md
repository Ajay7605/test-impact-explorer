<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Working on Test Impact Explorer

Instructions for coding agents (Claude Code, Codex, Cursor, Copilot) and for people.

## What this is
A Next.js app that takes a JS/TS project snapshot plus a diff and returns the tests
affected by the change, with the import chain that explains each one. See `README.md`.

## Commands
| Task | Command |
| --- | --- |
| Dev server | `npm run dev` |
| Lint + typecheck + unit tests | `npm run check` |
| Unit tests only | `npm test` |
| End-to-end tests | `npm run build && npm run test:e2e` |
| README screenshots | `npm run start -- --port 3100`, then `node scripts/screenshot.mjs` |

Before you say a change is done, `npm run check` must pass. If you touched anything
under `src/app` or `src/components`, the e2e suite must pass too.

## Layout
- `src/lib/impact/`: the analysis. **Pure TypeScript, no Node or DOM APIs.** It runs
  in the API route, the browser and Vitest. Don't import `node:path` or `fs` here.
  - `parseImports.ts` → `resolve.ts` → `graph.ts` → `impact.ts`, with `diff.ts` for input
    and `analyze.ts` as the entry point (validation, summary, warnings).
- `src/app/api/analyze/route.ts`: thin HTTP wrapper. Validation lives in `analyze.ts`.
- `src/components/`: client UI. `Explorer` owns state, `Results` and `ImpactGraph` render.
- `src/lib/sample/sampleProject.ts`: the demo project. Several unit and e2e tests assert
  exact counts against it (19 files, 8 tests, "3 of 8" for `date.ts`). If you change it,
  update those tests in the same commit and say so.
- `specs/`: one spec per feature, with acceptance criteria. Read the matching spec
  before changing behaviour, and update it when the behaviour changes.
- `e2e/`: Playwright tests, run on a desktop and a mobile viewport.

## Conventions
- Paths inside the analyzer are always POSIX, repo-relative, with no leading `./`.
  Normalise at the boundary (`normalizePath`), never deep inside.
- Errors the user can fix are `AnalyzeError`s with a message that says what to do.
  The route maps them to 400. Anything else is a 500 and gets logged.
- Prefer roles and labels in Playwright locators. Use `data-testid` only for things
  without an accessible name (stats, result lists). Next.js renders its own empty
  `role="alert"`, so don't locate errors by role alone.
- Wait for `[data-ready=true]` before interacting in e2e tests. Clicks before
  hydration are lost.
- No new runtime dependencies without a reason in the PR description.

## Pull requests
Each PR description has three parts:
1. **What changed and why** (link the spec).
2. **How it was verified**: which tests were added, plus a screenshot for UI changes.
3. **What the agent got wrong**: anything the coding agent produced that had to be
   corrected, and how it was caught. Append notable ones to `docs/agent-log.md`.

## Known traps
- `playwright.config.ts` reuses a server that's already on port 3100. If you rebuild
  while an old `next start` is still running, every page loads stale JS, hydration
  never happens, and most e2e tests time out. Stop the old server first.
- Playwright JSON-encodes string request bodies. To send invalid JSON, pass a `Buffer`.
- Passing tests don't mean the UI looks right. Take screenshots and look at them,
  especially the graph.
