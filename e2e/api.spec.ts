import { expect, test } from "@playwright/test";

test.describe("POST /api/analyze", () => {
  test("returns the impact for a valid request", async ({ request }) => {
    const response = await request.post("/api/analyze", {
      data: {
        files: {
          "src/a.ts": "export const a = 1;",
          "src/b.ts": 'import { a } from "./a"; export const b = a + 1;',
          "src/b.test.ts": 'import { b } from "./b";',
          "src/other.test.ts": "",
        },
        changes: "M\tsrc/a.ts",
      },
    });
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.summary).toMatchObject({ totalTests: 2, selectedTests: 1, reductionPct: 50 });
    expect(body.affectedTests[0]).toMatchObject({
      file: "src/b.test.ts",
      distance: 2,
      chain: ["src/a.ts", "src/b.ts", "src/b.test.ts"],
    });
  });

  test("rejects a body that isn't JSON", async ({ request }) => {
    // A Buffer is sent as-is; a plain string would be JSON-encoded by Playwright.
    const response = await request.post("/api/analyze", {
      headers: { "content-type": "application/json" },
      data: Buffer.from("{not json"),
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: "Request body must be valid JSON." });
  });

  test("explains what's wrong with an invalid request", async ({ request }) => {
    const response = await request.post("/api/analyze", { data: { files: {}, changes: "a.ts" } });
    expect(response.status()).toBe(400);
    expect((await response.json()).error).toContain("`files` is empty");
  });
});
