// Save with vitals: the photo pop-up saves the medicine, then the vitals scan replaces the photo page.
// The scan itself is never started here: a real one needs a face on camera and spends VitalLens quota.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { deleteTestUsers, labelPhoto, sessionUserId } from "./support";

const RECORD_URL = /\/patients\/([0-9a-f-]{36})\/add$/;

test.describe("save with vitals", () => {
  test.describe.configure({ mode: "serial" });

  let context: BrowserContext;
  let page: Page;
  let base: string;
  let userId: string | null = null;

  test.beforeAll(async ({ browser }, testInfo) => {
    context = await browser.newContext(testInfo.project.use);
    page = await context.newPage();
    page.on("dialog", (dialog) => (dialog.type() === "beforeunload" ? dialog.accept() : dialog.dismiss()));
    await page.goto("/");
    await page.getByRole("button", { name: "Continue as a guest" }).click();
    await page.waitForURL(RECORD_URL);
    base = `/patients/${RECORD_URL.exec(new URL(page.url()).pathname)![1]}`;
    userId = await sessionUserId(context);
  });

  test.afterAll(async () => {
    if (userId) await deleteTestUsers([userId]);
    await context.close();
  });

  test("the card's Save with vitals saves the medicine, then the vitals scan takes the photo page's place", async ({ browser }, testInfo) => {
    await page.goto(`${base}/add`);
    await page.locator("label", { hasText: "Choose a photo" }).locator("input[type=file]").setInputFiles(await labelPhoto(browser, "tylenolExtraStrength"));
    const confirm = page.getByRole("dialog", { name: "Is this Tylenol Extra Strength (caplets)?" });
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    await confirm.getByRole("button", { name: "Continue" }).click();
    const card = page.getByRole("dialog", { name: "Tylenol Extra Strength (caplets)" });
    const withVitals = card.getByRole("button", { name: "Save with vitals" });
    await expect(withVitals).toBeVisible();

    // On a 375px phone all three choices fit the width and keep 44px tap targets.
    if (testInfo.project.name === "mobile") {
      await page.setViewportSize({ width: 375, height: 667 });
      for (const name of ["Don't save", "Save with vitals", "Save to My medicines"]) {
        const box = (await card.getByRole("button", { name }).boundingBox())!;
        expect(box.x, name).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, name).toBeLessThanOrEqual(375);
        expect(box.height, name).toBeGreaterThanOrEqual(44);
      }
    }

    await withVitals.click();
    await page.waitForURL(new RegExp(`${base}/vitals$`));
    await expect(page.getByRole("heading", { level: 1, name: "Check vitals" })).toBeVisible();
    // The start screen waits for Start; the camera (and VitalLens) only start when it's pressed.
    await expect(page.getByText("Look at the camera")).toBeVisible();

    // The vitals page replaced the photo page: Back skips the finished photo.
    await page.goBack();
    await page.waitForURL(/\/add$/);
    await page.goto(base);
    await expect(page.getByText("1 medicine on file")).toBeVisible();
  });
});
