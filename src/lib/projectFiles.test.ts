import { describe, expect, it } from "vitest";
import { toProjectPath } from "./projectFiles";

describe("toProjectPath", () => {
  it("drops the uploaded folder's own name", () => {
    expect(toProjectPath("my-repo/src/a.ts")).toBe("src/a.ts");
    expect(toProjectPath("my-repo\\src\\b.tsx")).toBe("src/b.tsx");
  });

  it("keeps every JS/TS flavour", () => {
    for (const ext of ["ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts"]) {
      expect(toProjectPath(`repo/a.${ext}`)).toBe(`a.${ext}`);
    }
  });

  it("skips non-code files and type declarations", () => {
    expect(toProjectPath("repo/README.md")).toBeNull();
    expect(toProjectPath("repo/package.json")).toBeNull();
    expect(toProjectPath("repo/src/env.d.ts")).toBeNull();
  });

  it("skips dependency and build folders at any depth", () => {
    expect(toProjectPath("repo/node_modules/react/index.js")).toBeNull();
    expect(toProjectPath("repo/packages/web/.next/server/page.js")).toBeNull();
    expect(toProjectPath("repo/dist/index.js")).toBeNull();
  });

  it("doesn't skip files that only share a name with an ignored folder", () => {
    expect(toProjectPath("repo/src/build.ts")).toBe("src/build.ts");
  });
});
