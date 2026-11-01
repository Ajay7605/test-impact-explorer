import { describe, expect, it } from "vitest";
import { buildGraph } from "./graph";
import { parseImports, stripComments } from "./parseImports";
import { candidatePaths, specifierTarget } from "./resolve";
import { isTestFile } from "./tests";

const deps = (graph: ReturnType<typeof buildGraph>, file: string) => [...(graph.dependencies.get(file) ?? [])].sort();

describe("parseImports", () => {
  it("finds every import form", () => {
    const source = `
      import def from "./default";
      import { a,
        b } from './named';
      import type { T } from "./types";
      import * as ns from "./namespace";
      export * from "./barrel";
      export { x } from "./reexport";
      import "./side-effect";
      const lazy = await import("./dynamic");
      const cjs = require('./common');
      import React from "react";
    `;
    expect(parseImports(source)).toEqual([
      "./default",
      "./named",
      "./types",
      "./namespace",
      "./barrel",
      "./reexport",
      "./side-effect",
      "./dynamic",
      "./common",
      "react",
    ]);
  });

  it("ignores imports inside comments", () => {
    const source = `
      // import { old } from "./line-comment";
      /* import { older } from "./block-comment"; */
      /**
       * import { docs } from "./doc-comment";
       */
      import { real } from "./real";
    `;
    expect(parseImports(source)).toEqual(["./real"]);
  });

  it("keeps strings that contain comment markers intact", () => {
    const code = stripComments(`const url = "https://example.com"; // trailing`);
    expect(code).toContain(`"https://example.com"`);
    expect(code).not.toContain("trailing");
  });

  it("keeps line numbers when stripping block comments", () => {
    const source = "a\n/* one\ntwo */\nb";
    expect(stripComments(source).split("\n")).toHaveLength(4);
  });
});

describe("resolve", () => {
  it("resolves relative, root-relative and aliased specifiers", () => {
    expect(specifierTarget("src/cart/cart.ts", "../pricing")).toBe("src/pricing");
    expect(specifierTarget("src/cart/cart.ts", "./events")).toBe("src/cart/events");
    expect(specifierTarget("src/cart/cart.ts", "/lib/x")).toBe("lib/x");
    expect(specifierTarget("src/cart/cart.ts", "@/utils/money")).toBe("src/utils/money");
  });

  it("prefers the longest matching alias", () => {
    const aliases = { "@/": "src/", "@/ui/": "packages/ui/" };
    expect(specifierTarget("a.ts", "@/ui/button", aliases)).toBe("packages/ui/button");
  });

  it("treats package imports as external", () => {
    expect(specifierTarget("src/a.ts", "react")).toBeNull();
    expect(specifierTarget("src/a.ts", "node:fs")).toBeNull();
    expect(specifierTarget("src/a.ts", "@scope/pkg")).toBeNull();
  });

  it("returns null for paths that climb above the project root", () => {
    expect(specifierTarget("src/a.ts", "../../outside")).toBeNull();
  });

  it("maps ESM .js specifiers to .ts files", () => {
    expect(candidatePaths("src/gateway.js")).toEqual(expect.arrayContaining(["src/gateway.ts", "src/gateway.tsx"]));
  });
});

describe("buildGraph", () => {
  it("links extension-less, index and .js-style imports", () => {
    const graph = buildGraph({
      "src/a.ts": `import "./b"; import "./dir"; import "./c.js";`,
      "src/b.tsx": "",
      "src/dir/index.ts": "",
      "src/c.ts": "",
    });
    expect(deps(graph, "src/a.ts")).toEqual(["src/b.tsx", "src/c.ts", "src/dir/index.ts"]);
    expect([...graph.dependents.get("src/b.tsx")!]).toEqual(["src/a.ts"]);
  });

  it("prefers a real .js file over the .ts fallback", () => {
    const graph = buildGraph({ "a.ts": `import "./b.js";`, "b.js": "", "b.ts": "" });
    expect(deps(graph, "a.ts")).toEqual(["b.js"]);
  });

  it("handles circular imports", () => {
    const graph = buildGraph({ "a.ts": `import "./b";`, "b.ts": `import "./a";` });
    expect(deps(graph, "a.ts")).toEqual(["b.ts"]);
    expect(deps(graph, "b.ts")).toEqual(["a.ts"]);
  });

  it("normalises Windows paths and leading ./", () => {
    const graph = buildGraph({ "src\\a.ts": `import "./b";`, "./src/b.ts": "" });
    expect(graph.files).toEqual(["src/a.ts", "src/b.ts"]);
    expect(deps(graph, "src/a.ts")).toEqual(["src/b.ts"]);
  });

  it("records local imports that don't resolve, but not packages", () => {
    const graph = buildGraph({ "src/a.ts": `import "./missing"; import "zod"; import "@/gone";` });
    expect(graph.unresolved).toEqual([
      { from: "src/a.ts", specifier: "./missing", target: "src/missing" },
      { from: "src/a.ts", specifier: "@/gone", target: "src/gone" },
    ]);
  });

  it("lists test files", () => {
    const graph = buildGraph({ "a.ts": "", "a.test.ts": "", "b.spec.tsx": "", "__tests__/c.ts": "" });
    expect(graph.tests).toEqual(["__tests__/c.ts", "a.test.ts", "b.spec.tsx"]);
  });
});

describe("isTestFile", () => {
  it.each([
    ["src/a.test.ts", true],
    ["src/a.spec.jsx", true],
    ["src/a.test.mts", true],
    ["src/__tests__/helpers.ts", true],
    ["src/testing.ts", false],
    ["src/latest.ts", false],
    ["tests/fixtures/data.ts", false],
  ])("%s → %s", (path, expected) => {
    expect(isTestFile(path)).toBe(expected);
  });
});
