# 004 — Explorer UI

## Goal
A single page where someone can try the analysis in under 30 seconds, without
installing anything.

## Layout
- Header: name, a one-line explanation, link to the repo.
- Left column (inputs), right column (results). Stacked on phones, with no
  horizontal scroll at 375px.

## Inputs
1. **Project**: the bundled sample project is loaded by default. "Load your own folder"
   opens a directory picker:
   - keep only `.ts .tsx .js .jsx .mjs .cjs .mts .cts` files
   - skip `node_modules`, `.git`, `.next`, `dist`, `build`, `coverage`, `out`
   - skip files over 512 KB, drop the top folder name so paths are repo-relative
   - "Use sample project" switches back
2. **What changed**, two tabs:
   - *Pick files*: searchable checkbox list of project files
   - *Paste diff*: textarea for anything spec 002 accepts, with a "Use sample diff" button
3. **Analyze impact** button, disabled while a request is running or when nothing is selected.

## Results
- Three numbers: tests to run (x of y), tests skipped, % of the suite skipped.
- Affected tests, each with its import chain (`date.ts → gateway.ts → checkout.ts →
  checkout.spec.ts`) and a "direct" / "n hops" badge.
- A copyable command: `npx vitest run <tests…>`.
- The impact graph: columns by distance, colour by kind (changed / impacted / test).
  Every node has a full-path tooltip.
- Collapsed list of skipped tests, plus warnings (not-found paths, unresolved imports).
- API errors are shown inline, never as a blank screen.

## Acceptance criteria (Playwright)
- [ ] Page loads with the sample project and shows its file and test counts.
- [ ] Picking `src/utils/date.ts` and analysing shows "3 of 8" and lists the gateway and
      checkout tests, but not `money.test.ts`.
- [ ] Pasting the sample diff gives the same result.
- [ ] Loading a folder from disk replaces the project and can be analysed.
- [ ] The API returns 400 for a bad request and 200 for a good one.
