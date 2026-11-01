# Agent log

This project was built by directing an AI coding agent (Claude Code) from the specs in
`specs/`. This log records the real problems that came up during the build: what
went wrong, how it was caught, and what changed as a result. Rules that came out of
these entries are in `AGENTS.md` under "Known traps".

---

### 1. Scaffold's `@types/node` blocked the test runner install
- **What happened:** `create-next-app` pinned `@types/node@^20`. Installing Vitest 5
  failed with `ERESOLVE`, because Vitest needs `@types/node` 22 or newer.
- **Caught by:** the install failing.
- **Fix:** bumped `@types/node` to `^24` (the current LTS line) instead of forcing the
  install with `--legacy-peer-deps`, which would only have hidden the conflict.

### 2. A constant exported from a page file
- **What happened:** the first draft of `src/app/page.tsx` exported `REPO_URL`.
  Next.js only allows specific exports from page files.
- **Caught by:** reviewing the diff before the first build.
- **Fix:** moved it to `src/lib/site.ts`.

### 3. An e2e test that checked the wrong thing
- **What happened:** the "rejects invalid JSON" API test sent `data: "not json"`.
  Playwright JSON-encodes strings, so the server got the valid JSON string
  `"not json"` and correctly answered "body must be a JSON object". The test failed
  even though the API was right.
- **Caught by:** reading the failure diff instead of changing the assertion to match.
- **Fix:** send `Buffer.from("{not json")`, which goes over the wire unchanged.

### 4. Locator matched Next.js's own element
- **What happened:** `getByRole("alert")` matched two elements: our error box and
  Next.js's hidden route announcer (also `role="alert"`).
- **Caught by:** Playwright's strict-mode violation.
- **Fix:** gave the error box a `data-testid` and wrote the rule into `AGENTS.md`.

### 5. Hydration race (prevented, not hit)
- **Risk:** the page is server-rendered, so for a moment the buttons are visible but
  React isn't attached yet. Clicks in that window do nothing, for users and tests alike.
- **Fix:** a `useHydrated()` hook (via `useSyncExternalStore`, no effect needed) keeps
  "Analyze impact" disabled until the page is interactive, and sets `data-ready`, which
  the e2e tests wait for.

### 6. All tests green, UI still wrong
- **What happened:** with every test passing, screenshots showed three problems:
  1. The graph was clipped. Its last column sat behind a horizontal scroll with no hint.
  2. Backward and same-column edges (`pricing/index.ts → cart.ts`,
     `cart.ts → CartView.tsx`) were drawn as curves cutting through other boxes.
  3. `payments/gateway.ts` and `payments/__tests__/gateway.ts` were both labelled
     `gateway.ts`, so a chain read "date.ts → gateway.ts → gateway.ts".
- **Caught by:** taking screenshots in light, dark and mobile and looking at them.
- **Fix:**
  - The SVG scales to the card and only scrolls on narrow screens, with a hint.
  - Only forward edges are drawn. A node's column comes from its shortest path, which
    is always a forward edge, so nothing that explains the result is lost.
  - Added `shortNames()`, which adds parent folders only when names collide, with
    unit tests and an e2e assertion on the chain text.

### 7. Stale server made 14 e2e tests fail
- **What happened:** after a rebuild, most e2e tests timed out waiting for hydration.
  An old `next start` from the screenshot step was still on port 3100. Playwright's
  `reuseExistingServer` picked it up, and it served HTML pointing at JS chunks the
  rebuild had deleted.
- **Caught by:** the pattern (every UI test failed, every API test passed) pointed at
  the client bundle, not the code under test.
- **Fix:** stop servers by whoever owns the port, not by matching process names.
  Added to "Known traps".

### 8. "1 test files"
- **What happened:** the project stats line hard-coded plurals.
- **Caught by:** writing the e2e expectation for the one-test fixture project.
- **Fix:** a small `plural()` helper.
