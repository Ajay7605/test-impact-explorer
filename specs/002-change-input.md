# 002 — Reading "what changed"

## Goal
Accept the change set in whatever form a developer already has on their clipboard
and turn it into a list of `{ path, status, previousPath? }`.

## Scope
`src/lib/impact/diff.ts`

## Accepted inputs
1. **Unified git diff** (`git diff`, `git show`, a PR's `.diff` URL)
   - `new file mode` → `added`, `deleted file mode` → `deleted`
   - `rename from` / `rename to` → `renamed` with `previousPath`
   - `--- /dev/null` / `+++ /dev/null` also mark added / deleted
   - binary files and pure renames (no `---`/`+++` header) still count
2. **Plain unified diff without `diff --git` lines** (`diff -u`): read the `---`/`+++` pairs.
3. **`git diff --name-status`**: `M\tpath`, `A\tpath`, `D\tpath`, `R100\told\tnew`
4. **`git diff --name-only`** or a hand-typed list: one path per line. Blank lines and
   `#` comments are ignored.

## Rules
- Lines inside a hunk that happen to start with `---` must not be read as headers.
  A header is a `--- ` line immediately followed by a `+++ ` line.
- Strip the `a/` and `b/` prefixes and any trailing tab plus timestamp.
- Normalise paths the same way as spec 001.
- The same path listed twice appears once.

## Acceptance criteria
- [ ] Each input format above has a unit test with the expected statuses.
- [ ] A diff where a removed line is `--- old SQL comment` doesn't create a phantom file.
- [ ] Empty or whitespace-only input returns an empty list (the API turns that into a 400).
