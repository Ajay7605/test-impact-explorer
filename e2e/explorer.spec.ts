import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

async function open(page: Page) {
  await page.goto("/");
  await expect(page.locator("[data-ready=true]")).toBeAttached();
}

test("loads with the sample project", async ({ page }) => {
  await open(page);
  await expect(page.getByRole("heading", { name: "Test Impact Explorer" })).toBeVisible();
  await expect(page.getByTestId("project-name")).toHaveText("sample-shop");
  await expect(page.getByTestId("project-stats")).toHaveText("19 files · 8 tests · bundled sample");
  await expect(page.getByRole("button", { name: "Analyze impact" })).toBeDisabled();
});

test("picking a changed file selects only the tests that depend on it", async ({ page }) => {
  await open(page);
  await page.getByLabel("Filter files").fill("utils/date");
  await page.getByRole("checkbox", { name: "src/utils/date.ts" }).check();
  await page.getByRole("button", { name: "Analyze impact" }).click();

  await expect(page.getByTestId("stat-selected")).toHaveText("3 of 8");
  await expect(page.getByTestId("stat-reduction")).toHaveText("63%");

  const tests = page.getByTestId("affected-tests");
  await expect(tests).toContainText("src/payments/__tests__/gateway.ts");
  await expect(tests).toContainText("src/checkout/checkout.spec.ts");
  await expect(tests).toContainText("src/orders/history.test.ts");
  await expect(tests).not.toContainText("money.test.ts");

  // The checkout test is three hops away and shows the chain that explains it.
  const checkout = tests.getByRole("listitem").filter({ hasText: "checkout.spec.ts" });
  await expect(checkout).toContainText("3 hops");
  await expect(checkout.getByLabel("Import chain")).toHaveText(/date\.ts.*gateway\.ts.*checkout\.ts.*checkout\.spec\.ts/);

  // Two files are called gateway.ts; the chain must tell them apart.
  const gateway = tests.getByRole("listitem").filter({ hasText: "__tests__/gateway.ts" });
  await expect(gateway.getByLabel("Import chain")).toHaveText("date.ts→payments/gateway.ts→__tests__/gateway.ts");

  await expect(page.getByTestId("run-command")).toHaveText(
    "npx vitest run src/orders/history.test.ts src/payments/__tests__/gateway.ts src/checkout/checkout.spec.ts",
  );
  await expect(page.getByRole("img", { name: /Impact graph with 7 files/ })).toBeVisible();
});

test("pasting the sample diff gives the same answer", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Paste diff" }).click();
  await page.getByRole("button", { name: "Use sample diff" }).click();
  await expect(page.getByLabel("Diff or list of changed files")).toHaveValue(/diff --git a\/src\/utils\/date\.ts/);
  await page.getByRole("button", { name: "Analyze impact" }).click();
  await expect(page.getByTestId("stat-selected")).toHaveText("3 of 8");
});

test("example buttons run an analysis in one click", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "money.ts changed" }).click();
  await expect(page.getByTestId("stat-selected")).toHaveText("6 of 8");
  await page.getByText("Skipped tests (2)").click();
  await expect(page.getByTestId("skipped-tests")).toContainText("src/orders/history.test.ts");
});

test("shows the API's error message for input with no files", async ({ page }) => {
  await open(page);
  await page.getByRole("tab", { name: "Paste diff" }).click();
  await page.getByLabel("Diff or list of changed files").fill("# just a comment");
  await page.getByRole("button", { name: "Analyze impact" }).click();
  // Next.js renders its own (empty) role="alert" route announcer, so target ours by id.
  await expect(page.getByTestId("error")).toHaveText(/No changed files found/);
});

test("loads a project folder from disk", async ({ page }) => {
  await open(page);
  await page.getByTestId("folder-input").setInputFiles(path.resolve("e2e/fixtures/mini-repo"));

  await expect(page.getByTestId("project-name")).toHaveText("mini-repo");
  await expect(page.getByTestId("project-stats")).toHaveText("3 files · 1 test");

  await page.getByRole("checkbox", { name: "src/math.ts" }).check();
  await page.getByRole("button", { name: "Analyze impact" }).click();
  await expect(page.getByTestId("stat-selected")).toHaveText("1 of 1");
  await expect(page.getByTestId("affected-tests")).toContainText("src/format.test.ts");

  await page.getByRole("button", { name: "Use sample project" }).click();
  await expect(page.getByTestId("project-name")).toHaveText("sample-shop");
});

test("results fit the screen without sideways scrolling", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "money.ts changed" }).click();
  await expect(page.getByTestId("results")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
