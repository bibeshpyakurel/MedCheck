// The two-act live demo (docs/demo-script.md), end to end against the real app and Supabase.
// Gemini is off (see playwright.config.ts), so every photo starts with all fields unknown and the
// test types the values from the printed demo kit, as a user would.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { ALREADY_GAVE_BOTH_MESSAGE } from "../src/components/already-gave-both";
import {
  confirmMedicine,
  deleteTestData,
  fieldRow,
  kitPhoto,
  matchAllPending,
  typeDose,
  typeStrength,
  typeText,
} from "./support";

const checksPanel = (page: Page) => page.getByRole("region", { name: "Checks run" });

test("demo kit renders signed out", async ({ page }) => {
  await page.goto("/demo-kit");
  await expect(page.getByRole("heading", { level: 1, name: "Demo kit" })).toBeVisible();
  for (const id of ["bottle-a", "bottle-b", "prescription-label", "discharge-list", "fallback-barcode"]) {
    await expect(page.locator(`#${id}`)).toBeVisible();
  }
  await expect(page.getByText(/1 of 5/)).toBeVisible();
});

test.describe("demo household", () => {
  test.describe.configure({ mode: "serial" });

  let context: BrowserContext;
  let page: Page;
  let alexUrl: string;
  let samUrl: string;

  test.beforeAll(async ({ browser }, testInfo) => {
    context = await browser.newContext(testInfo.project.use);
    page = await context.newPage();
  });

  test.afterAll(async () => {
    await deleteTestData(context);
    await context.close();
  });

  test("landing → demo household → Alex's record with the checks panel", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: /Try the demo household/ }).click();
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/);
    alexUrl = page.url();

    await expect(page.getByRole("heading", { level: 1, name: "My medicines" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Switch person" })).toContainText("Me (Alex)");
    await expect(page.getByText("Demo data — synthetic").first()).toBeVisible();
    await expect(page.getByText("Tylenol Extra Strength (caplets)")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Checks run" })).toBeVisible();
    await expect(page.getByText(/6 checks run/)).toBeVisible();
  });

  test("Act 1: NyQuil by typed barcode + Drug Facts photo → ingredient overlap with Tylenol", async () => {
    await page.goto(`${alexUrl}/add`);
    await page.getByRole("link", { name: /Scan barcode/ }).click();
    await page.getByLabel(/type the NDC or barcode/).fill("337000523025");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByText("Found in the database")).toBeVisible();
    await expect(page.getByText(/NyQuil Severe/).first()).toBeVisible();

    await page.locator("a", { hasText: "Photograph the Drug Facts panel" }).click();
    await page.waitForURL(/\/add\/photo\?.*formulationId=/);
    await page.locator("input[name=library]").setInputFiles(await kitPhoto(context, "fallback-barcode"));
    await page.getByRole("button", { name: "Read this photo" }).click();
    await page.waitForURL(/\/review/);
    await expect(page.getByText(/Barcode: NyQuil Severe/)).toBeVisible();

    await typeText(page, "Product name", "NyQuil Severe Cold & Flu");
    await typeText(page, "Form (liquid, caplet, tablet…)", "caplet");
    await typeText(page, "Ingredient 1", "Acetaminophen");
    await typeStrength(page, "Ingredient 1 strength", { amount: 325, perUnit: "caplet" });
    await typeText(page, "Directions", "adults & children 12 yrs & over 2 caplets with water every 4 hrs");
    await typeDose(page, "Amount in the directions", { amount: 2, unit: "caplets" });
    await typeText(page, "24-hour maximum", "do not exceed 8 caplets per 24 hrs");
    await confirmMedicine(page);
    expect(page.url()).toBe(alexUrl);

    const panel = checksPanel(page);
    await expect(panel.getByText(/6 checks run/)).toBeVisible();
    for (const check of [
      "Shared active ingredients",
      "Repeated records",
      "Liquid strengths",
      "Dose units",
      "Documents vs bottle",
      "Database label vs box",
    ]) {
      await expect(panel.getByText(check, { exact: true })).toBeVisible();
    }
    const finding = panel.getByText("Acetaminophen is in 2 medicines");
    await expect(finding).toBeVisible();
    await expect(panel.getByText(/Tylenol Extra Strength \(caplets\) and NyQuil Severe Cold & Flu both list Acetaminophen/)).toBeVisible();
    await expect(panel.getByText(/label's own warning/i)).toBeVisible();
    await expect(panel.getByText(/Ask a pharmacist/i).first()).toBeVisible();
    await expect(panel.getByRole("button", { name: /Copy question/ }).first()).toBeVisible();
    await expect(panel).not.toContainText(/\bsafe\b/i);
  });

  test("Act 2: Sam's discharge list, prescription and Bottle B → concentration, units, document findings", async () => {
    await page.getByRole("button", { name: "Switch person" }).click();
    await page.getByRole("menuitem", { name: /Sam/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Sam's medicines" })).toBeVisible();
    samUrl = page.url();
    await expect(page.getByText("Calmora Fever Relief (Bottle A)")).toBeVisible();

    async function photo(kind: "Discharge list" | "Prescription label", itemId: string) {
      await page.goto(`${samUrl}/add`);
      await page.getByRole("link", { name: /Photo of label or document/ }).click();
      await page.getByRole("radio", { name: new RegExp(kind) }).check();
      await page.locator("input[name=library]").setInputFiles(await kitPhoto(context, itemId));
      await page.getByRole("button", { name: "Read this photo" }).click();
      await page.waitForURL(/\/review/);
    }

    // Discharge list, with one value marked "Can't tell".
    await photo("Discharge list", "discharge-list");
    await typeText(page, "Product name", "Acetaminophen 160 mg per 5 mL oral suspension");
    await typeText(page, "Form (liquid, caplet, tablet…)", "oral suspension");
    await typeText(page, "Ingredient 1", "Acetaminophen");
    await typeStrength(page, "Ingredient 1 strength", { amount: 160, perAmount: 5, perUnit: "mL" });
    await typeText(page, "Directions", "10 mL by mouth every 6 hours as needed for fever");
    await typeDose(page, "Amount in the directions", { amount: 10, unit: "mL" });
    await fieldRow(page, "24-hour maximum").getByRole("button", { name: "Can't tell" }).click();
    await page.getByLabel("Date on the document").fill("2026-10-16");
    await page.getByLabel("Hospital or clinic").fill("Lakeside Children's Hospital");
    await page.getByLabel("Prescriber").fill("Dr. Jordan Lee");
    await confirmMedicine(page);

    // Prescription label: "2 tsp".
    await photo("Prescription label", "prescription-label");
    await typeText(page, "Product name", "Acetaminophen oral suspension 160 mg per 5 mL");
    await typeText(page, "Form (liquid, caplet, tablet…)", "oral suspension");
    await typeText(page, "Ingredient 1", "Acetaminophen");
    await typeStrength(page, "Ingredient 1 strength", { amount: 160, perAmount: 5, perUnit: "mL" });
    await typeText(page, "Directions", "Give 2 tsp by mouth every 6 hours as needed for fever");
    await typeDose(page, "Amount in the directions", { amount: 2, unit: "tsp" });
    await page.getByLabel("Date on the document").fill("2026-10-16");
    await page.getByLabel("Prescriber").fill("Dr. Jordan Lee");
    await page.getByLabel("Pharmacy").fill("Riverside Community Pharmacy");
    await confirmMedicine(page);

    // Bottle B by typed UPC → skip the photo → confirm the database label.
    await page.goto(`${samUrl}/add/scan`);
    await page.getByLabel(/type the NDC or barcode/).fill("399999200059");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByText("Calmora Extra Fever Relief (Bottle B)")).toBeVisible();
    await page.getByRole("button", { name: /Skip photo/ }).click();
    await page.waitForURL(/\/review/);
    await matchAllPending(page);
    await confirmMedicine(page);
    expect(page.url()).toBe(samUrl);

    const panel = checksPanel(page);
    await expect(panel.getByText(/6 checks run · 4 found something · 1 couldn't be completed/)).toBeVisible();
    await expect(panel.getByText("Acetaminophen liquids with different strengths")).toBeVisible();
    // Both strengths as printed, never turned into a volume.
    await expect(panel.getByText(/As printed: Calmora Fever Relief \(Bottle A\): 100 mg per 5 mL;.*Calmora Extra Fever Relief \(Bottle B\): 200 mg per 5 mL\./)).toBeVisible();
    await expect(panel.getByText(/Dose and strength use different units/)).toBeVisible();
    await expect(panel.getByText("Your documents list different acetaminophen strengths")).toBeVisible();
    await expect(panel.getByText("Your documents write the acetaminophen dose differently")).toBeVisible();
    await expect(panel.getByText("Couldn't be completed", { exact: true })).toBeVisible();
    await expect(panel).not.toContainText(/\bsafe\b/i);
    // A barcode entry without a photo is grouped under the catalog label, not "No source document".
    await expect(page.getByText("Label in the MedCheck catalog")).toBeVisible();
    await expect(page.getByText("No source document")).toHaveCount(0);

    await page.getByRole("tab", { name: /History/ }).click();
    const history = page.getByRole("tabpanel", { name: "History" });
    await expect(history.getByText(/Medicine confirmed: Calmora Extra Fever Relief \(Bottle B\)/)).toBeVisible();
    await expect(history.getByText(/Document added: Discharge list/)).toBeVisible();
  });

  test("pharmacist report: PDF download, Share fallback, email not configured", async () => {
    await page.goto(samUrl);
    await page.locator("a", { hasText: "Pharmacist report" }).click();
    await page.waitForURL(/\/export$/);
    await expect(page.getByRole("heading", { level: 1, name: "Pharmacist report" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Questions to ask" })).toBeVisible();

    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("a[download]").click()]);
    expect(download.suggestedFilename()).toMatch(/^MedCheck-report-Sam-\d{4}-\d{2}-\d{2}\.pdf$/);
    const pdf = await download.createReadStream().then(async (stream) => {
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return Buffer.concat(chunks);
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0).toBeGreaterThan(1);

    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(page.getByText(/Email isn't set up on this MedCheck/)).toBeVisible();
  });

  test("\"I already gave both\": the record button and a typed description show the fixed message", async () => {
    await page.goto(samUrl);
    await page.getByRole("button", { name: "I already gave both" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(ALREADY_GAVE_BOTH_MESSAGE);
    await expect(dialog.locator('a[href="tel:18002221222"]')).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await page.goto(`${samUrl}/add/describe`);
    await page.getByRole("textbox").fill("I already gave both");
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("dialog")).toContainText(ALREADY_GAVE_BOTH_MESSAGE);
    await expect(page.getByRole("dialog").locator('a[href="tel:18002221222"]')).toBeVisible();
    await page.keyboard.press("Escape");

    // A described medicine: no photo, so the review must not talk about one.
    await page.goto(`${samUrl}/add/describe`);
    await page.getByRole("textbox").fill("Calmora Extra Fever Relief, acetaminophen 200 mg per 5 mL");
    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/review/);
    await expect(page.getByText("From your description, not a label")).toBeVisible();
    await expect(page.getByText(/Your photo is saved/)).toHaveCount(0);
  });

  test("reset demo puts the household back", async () => {
    await page.goto(samUrl);
    await page.getByRole("button", { name: "Reset demo" }).click();
    await page.waitForURL((url) => /\/patients\/[0-9a-f-]{36}$/.test(url.pathname) && url.toString() !== samUrl);
    await expect(page.getByRole("heading", { level: 1, name: "My medicines" })).toBeVisible();
    await expect(page.getByText(/6 checks run · 0 found something/)).toBeVisible();
    await expect(page.getByText("NyQuil Severe Cold & Flu")).toHaveCount(0);
  });
});
