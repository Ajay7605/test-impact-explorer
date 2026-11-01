// Regenerates the README screenshots. Needs a running server:
//   npm run build && npm run start -- --port 3100
//   node scripts/screenshot.mjs [baseUrl] [outDir]
import { chromium } from "@playwright/test";

const baseUrl = process.argv[2] ?? "http://localhost:3100";
const outDir = process.argv[3] ?? "docs";

const shots = [
  { name: "screenshot", viewport: { width: 1360, height: 1100 }, colorScheme: "light", example: "date.ts changed" },
  { name: "screenshot-dark", viewport: { width: 1360, height: 1100 }, colorScheme: "dark", example: "money.ts changed" },
  { name: "screenshot-mobile", viewport: { width: 390, height: 844 }, colorScheme: "light", example: "date.ts changed" },
];

const browser = await chromium.launch();
for (const shot of shots) {
  const page = await browser.newPage({ viewport: shot.viewport, colorScheme: shot.colorScheme, deviceScaleFactor: 2 });
  await page.goto(baseUrl);
  await page.locator("[data-ready=true]").waitFor({ state: "attached" });
  await page.getByRole("button", { name: shot.example }).click();
  await page.getByTestId("results").waitFor();
  await page.screenshot({ path: `${outDir}/${shot.name}.png`, fullPage: true });
  console.log(`saved ${outDir}/${shot.name}.png`);
  await page.close();
}
await browser.close();
