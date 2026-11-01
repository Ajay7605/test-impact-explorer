import { describe, expect, it } from "vitest";
import { SAMPLE_DIFF, SAMPLE_FILES } from "../sample/sampleProject";
import { analyze, AnalyzeError, validateRequest } from "./analyze";

const run = (changes: string, files = SAMPLE_FILES) => analyze({ files, changes });
const testFiles = (result: ReturnType<typeof run>) => result.affectedTests.map((t) => t.file);

describe("analyze on the sample project", () => {
  it("selects 3 of 8 tests when the date helpers change", () => {
    const result = run("src/utils/date.ts");
    expect(result.summary).toEqual({
      totalFiles: 19,
      totalTests: 8,
      selectedTests: 3,
      skippedTests: 5,
      reductionPct: 63,
    });
    expect(testFiles(result)).toEqual([
      "src/orders/history.test.ts",
      "src/payments/__tests__/gateway.ts",
      "src/checkout/checkout.spec.ts",
    ]);
    expect(testFiles(result)).not.toContain("src/utils/money.test.ts");
  });

  it("explains each selection with the shortest import chain", () => {
    const checkout = run("src/utils/date.ts").affectedTests.find((t) => t.file.endsWith("checkout.spec.ts"))!;
    expect(checkout.distance).toBe(3);
    expect(checkout.chain).toEqual([
      "src/utils/date.ts",
      "src/payments/gateway.ts", // reached through "../payments/gateway.js"
      "src/checkout/checkout.ts",
      "src/checkout/checkout.spec.ts",
    ]);
  });

  it("follows the @/ alias and the pricing barrel when money changes", () => {
    const result = run("src/utils/money.ts");
    expect(testFiles(result).sort()).toEqual([
      "src/cart/cart.test.ts",
      "src/checkout/checkout.spec.ts",
      "src/pricing/discount.test.ts",
      "src/pricing/tax.test.ts",
      "src/ui/CartView.test.tsx",
      "src/utils/money.test.ts",
    ]);
    const cart = result.affectedTests.find((t) => t.file === "src/cart/cart.test.ts")!;
    expect(cart.chain).toEqual(["src/utils/money.ts", "src/cart/cart.ts", "src/cart/cart.test.ts"]);
  });

  it("gives the same answer for the sample git diff", () => {
    expect(testFiles(run(SAMPLE_DIFF))).toEqual(testFiles(run("src/utils/date.ts")));
  });

  it("selects a changed test file at distance 0", () => {
    const [test] = run("src/pricing/tax.test.ts").affectedTests;
    expect(test).toMatchObject({ file: "src/pricing/tax.test.ts", distance: 0, chain: ["src/pricing/tax.test.ts"] });
  });

  it("survives the cart ↔ cartEvents cycle", () => {
    const result = run("src/cart/cartEvents.ts");
    expect(testFiles(result)).toEqual(
      expect.arrayContaining(["src/cart/cart.test.ts", "src/checkout/checkout.spec.ts"]),
    );
  });

  it("lists every changed file that reaches a test", () => {
    const result = run("src/utils/money.ts\nsrc/cart/cart.ts");
    const cart = result.affectedTests.find((t) => t.file === "src/cart/cart.test.ts")!;
    expect(cart.triggeredBy.sort()).toEqual(["src/cart/cart.ts", "src/utils/money.ts"]);
    expect(cart.distance).toBe(1);
  });
});

describe("deleted and unknown files", () => {
  it("treats files that still import a deleted file as impacted", () => {
    const files = { ...SAMPLE_FILES };
    delete files["src/utils/date.ts"];
    const result = run("D\tsrc/utils/date.ts", files);
    expect(testFiles(result).sort()).toEqual([
      "src/checkout/checkout.spec.ts",
      "src/orders/history.test.ts",
      "src/payments/__tests__/gateway.ts",
    ]);
    expect(result.changes[0]).toMatchObject({ status: "deleted", inProject: false, directDependents: 2 });
    expect(result.graph.edges).toContainEqual({ from: "src/utils/date.ts", to: "src/payments/gateway.ts" });
  });

  it("follows stale imports of a renamed file's old path", () => {
    const { ["src/utils/date.ts"]: source, ...rest } = SAMPLE_FILES;
    const files = { ...rest, "src/utils/dates.ts": source };
    const result = run("R100\tsrc/utils/date.ts\tsrc/utils/dates.ts", files);
    expect(result.affectedTests).toHaveLength(3);
  });

  it("reports paths that aren't in the project", () => {
    const result = run("README.md\nsrc/utils/typo.ts");
    expect(result.notFound).toEqual(["README.md", "src/utils/typo.ts"]);
    expect(result.affectedTests).toEqual([]);
    expect(result.warnings.join(" ")).toContain("README.md isn't a source file");
  });
});

describe("impact graph", () => {
  it("lays nodes out by distance and colours them by kind", () => {
    const { graph } = run("src/utils/date.ts");
    const node = (id: string) => graph.nodes.find((n) => n.id === id);
    expect(node("src/utils/date.ts")).toEqual({ id: "src/utils/date.ts", kind: "changed", layer: 0 });
    expect(node("src/payments/gateway.ts")).toMatchObject({ kind: "impacted", layer: 1 });
    expect(node("src/checkout/checkout.spec.ts")).toMatchObject({ kind: "test", layer: 3 });
    expect(graph.edges).toContainEqual({ from: "src/payments/gateway.ts", to: "src/checkout/checkout.ts" });
    expect(graph.truncated).toBe(false);
  });

  it("caps the graph at 150 nodes", () => {
    const files: Record<string, string> = { "src/core.ts": "" };
    for (let i = 0; i < 200; i++) files[`src/f${i}.test.ts`] = `import "./core";`;
    const result = run("src/core.ts", files);
    expect(result.affectedTests).toHaveLength(200);
    expect(result.graph.nodes).toHaveLength(150);
    expect(result.graph.truncated).toBe(true);
  });
});

describe("validateRequest", () => {
  const bad = (body: unknown) => () => validateRequest(body);

  it("accepts a well-formed request", () => {
    expect(validateRequest({ files: { "a.ts": "" }, changes: "a.ts" })).toEqual({
      files: { "a.ts": "" },
      changes: "a.ts",
      aliases: undefined,
    });
  });

  it.each([
    ["not an object", "hello"],
    ["an array", []],
    ["missing files", { changes: "a.ts" }],
    ["non-string sources", { files: { "a.ts": 1 }, changes: "a.ts" }],
    ["empty files", { files: {}, changes: "a.ts" }],
    ["missing changes", { files: { "a.ts": "" } }],
    ["bad aliases", { files: { "a.ts": "" }, changes: "a.ts", aliases: ["@/"] }],
  ])("rejects %s", (_label, body) => {
    expect(bad(body)).toThrow(AnalyzeError);
  });

  it("rejects input with no changed files", () => {
    expect(() => analyze({ files: { "a.ts": "" }, changes: "\n# nothing\n" })).toThrow("No changed files found");
  });
});
