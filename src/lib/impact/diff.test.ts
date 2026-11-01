import { describe, expect, it } from "vitest";
import { parseChanges } from "./diff";

describe("parseChanges: git diff", () => {
  it("reads modified, added, deleted and renamed files", () => {
    const diff = [
      "diff --git a/src/a.ts b/src/a.ts",
      "index 1111111..2222222 100644",
      "--- a/src/a.ts",
      "+++ b/src/a.ts",
      "@@ -1 +1 @@",
      "-old",
      "+new",
      "diff --git a/src/new.ts b/src/new.ts",
      "new file mode 100644",
      "index 0000000..3333333",
      "--- /dev/null",
      "+++ b/src/new.ts",
      "@@ -0,0 +1 @@",
      "+export const x = 1;",
      "diff --git a/src/gone.ts b/src/gone.ts",
      "deleted file mode 100644",
      "index 4444444..0000000",
      "--- a/src/gone.ts",
      "+++ /dev/null",
      "@@ -1 +0,0 @@",
      "-export const y = 2;",
      "diff --git a/src/old-name.ts b/src/new-name.ts",
      "similarity index 100%",
      "rename from src/old-name.ts",
      "rename to src/new-name.ts",
    ].join("\n");

    expect(parseChanges(diff)).toEqual([
      { path: "src/a.ts", status: "modified" },
      { path: "src/new.ts", status: "added" },
      { path: "src/gone.ts", status: "deleted" },
      { path: "src/new-name.ts", status: "renamed", previousPath: "src/old-name.ts" },
    ]);
  });

  it("doesn't treat a removed '--- ' line inside a hunk as a new file", () => {
    const diff = [
      "diff --git a/db/schema.sql b/db/schema.sql",
      "--- a/db/schema.sql",
      "+++ b/db/schema.sql",
      "@@ -1,3 +1,2 @@",
      "--- old SQL comment",
      " CREATE TABLE t (id int);",
      "+-- new SQL comment",
    ].join("\n");
    expect(parseChanges(diff)).toEqual([{ path: "db/schema.sql", status: "modified" }]);
  });

  it("handles binary files and CRLF line endings", () => {
    const diff = "diff --git a/logo.png b/logo.png\r\nindex 1..2 100644\r\nBinary files a/logo.png and b/logo.png differ\r\n";
    expect(parseChanges(diff)).toEqual([{ path: "logo.png", status: "modified" }]);
  });
});

describe("parseChanges: other formats", () => {
  it("reads a plain diff -u without diff --git lines", () => {
    const diff = [
      "--- src/a.ts\t2026-01-01 10:00:00",
      "+++ src/a.ts\t2026-01-02 10:00:00",
      "@@ -1 +1 @@",
      "-a",
      "+b",
      "--- src/b.ts",
      "+++ src/b.ts",
      "@@ -1 +1 @@",
      "-c",
      "+d",
    ].join("\n");
    expect(parseChanges(diff).map((c) => c.path)).toEqual(["src/a.ts", "src/b.ts"]);
  });

  it("reads git diff --name-status", () => {
    const input = "M\tsrc/a.ts\nA\tsrc/b.ts\nD\tsrc/c.ts\nR087\tsrc/old.ts\tsrc/new.ts\n";
    expect(parseChanges(input)).toEqual([
      { path: "src/a.ts", status: "modified" },
      { path: "src/b.ts", status: "added" },
      { path: "src/c.ts", status: "deleted" },
      { path: "src/new.ts", status: "renamed", previousPath: "src/old.ts" },
    ]);
  });

  it("reads a list of paths, skipping blanks, comments and duplicates", () => {
    const input = "\n# changed in this PR\nsrc/a.ts\n  ./src/b.ts  \nsrc\\a.ts\n";
    expect(parseChanges(input)).toEqual([
      { path: "src/a.ts", status: "modified" },
      { path: "src/b.ts", status: "modified" },
    ]);
  });

  it("returns nothing for empty input", () => {
    expect(parseChanges("")).toEqual([]);
    expect(parseChanges("  \n\t\n")).toEqual([]);
  });
});
