// The two-act live demo (docs/demo-script.md), end to end against the real app and Supabase.
// Gemini is off (see playwright.config.ts), so every photo starts with all fields unknown and the
// test types the values from the printed demo kit, as a user would.
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { ALREADY_GAVE_BOTH_MESSAGE } from "../src/components/already-gave-both";
import {
  confirmMedicine,
  deleteTestData,
  kitPhoto,
  matchAllPending,
  reviewRow,
  typeDose,
  typeStrength,
  typeText,
} from "./support";

/** The medicine list on a person's home screen (Activity, further down, also names medicines). */
const medicines = (page: Page) => page.getByRole("region", { name: "Medicines", exact: true });

/** Opens the person's Checks screen from the record navigation and returns its content. */
async function openChecks(page: Page) {
  await page.getByRole("navigation", { name: /record sections/ }).getByRole("link", { name: "Checks" }).click();
  await page.waitForURL(/\/checks$/);
  await expect(page.getByRole("heading", { level: 1, name: "Checks" })).toBeVisible();
  return page.getByRole("main");
}

/** Evidence sits one tap under each finding; open every one. */
async function openAllEvidence(page: Page) {
  const closed = page.locator("details:not([open]) > summary", { hasText: "See the label evidence" });
  while ((await closed.count()) > 0) await closed.first().click();
}

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

  test("landing → demo household → Alex's medicines, then the checks", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "Try the demo", exact: true }).first().click();
    await page.waitForURL(/\/patients\/[0-9a-f-]{36}$/);
    alexUrl = page.url();

    await expect(page.getByRole("heading", { level: 1, name: "My medicines" })).toBeVisible();
    // Whose record this is, and Change person, sit in the record header on every record screen.
    await expect(page.getByRole("navigation", { name: "Me (Alex): record sections" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Change person" })).toBeVisible();
    await expect(page.getByText("You're in the demo household. Everything in it is made up.")).toBeVisible();
    await expect(medicines(page).getByText("Tylenol Extra Strength (caplets)")).toBeVisible();
    // One medicine: nothing to compare yet — never an "all clear".
    await expect(page.getByRole("heading", { name: "Nothing to compare yet" })).toBeVisible();

    const checks = await openChecks(page);
    await expect(checks.getByText("None of the 6 checks could compare confirmed values yet · 6 had nothing to compare")).toBeVisible();
    await expect(checks.getByRole("heading", { name: "Didn't apply (6)" })).toBeVisible();
    await expect(checks.getByText("No two different medicines to compare")).toBeVisible();
  });

  test("Act 1: NyQuil by typed barcode + Drug Facts photo → ingredient overlap with Tylenol", async () => {
    await page.goto(`${alexUrl}/add`);
    await page.getByRole("link", { name: /Scan a barcode/ }).click();
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

    // Home: a compact summary that leads with the first finding and points to the questions.
    await expect(page.getByRole("heading", { name: /^\d+ things? to ask a pharmacist$/ })).toBeVisible();
    await expect(page.getByText("Two medicines list Acetaminophen")).toBeVisible();
    await expect(page.getByRole("button", { name: /See the questions/ })).toHaveAttribute("href", /\/checks$/);

    const panel = await openChecks(page);
    await expect(panel.getByText(/\d of 6 checks compared confirmed values · \d found something/)).toBeVisible();
    for (const check of [
      "Same ingredient in two medicines",
      "Same medicine listed twice",
      "Different liquid strengths",
      "Units in the amount and strength",
      "Document and bottle",
      "Medicine listing and package",
    ]) {
      await expect(panel.getByText(check, { exact: true })).toBeVisible();
    }
    // The headline says what it means; the detail gives each product's text once.
    await expect(panel.getByRole("heading", { name: "Two medicines list Acetaminophen" })).toBeVisible();
    await expect(panel.getByText(/Tylenol Extra Strength \(caplets\) lists Acetaminophen .*NyQuil Severe Cold & Flu lists Acetaminophen 325 mg per caplet/)).toBeVisible();
    await expect(panel.getByText(/label's own warning/i)).toBeVisible();
    await expect(panel.getByText(/Ask a pharmacist/i).first()).toBeVisible();
    await expect(panel.getByRole("button", { name: /Copy question/ }).first()).toBeVisible();
    // Each piece of evidence opens its source; real (openFDA) labels also link to DailyMed in a new tab.
    await openAllEvidence(page);
    await expect(panel.getByRole("link", { name: /View source: NyQuil Severe Cold & Flu/ }).first()).toHaveAttribute(
      "href",
      /\/patients\/[0-9a-f-]{36}\/entries\/[0-9a-f-]{36}$/,
    );
    const dailyMed = panel.getByRole("link", { name: /Official FDA label \(DailyMed\)/ }).first();
    await expect(dailyMed).toHaveAttribute("href", /^https:\/\/dailymed\.nlm\.nih\.gov\/dailymed\/lookup\.cfm\?setid=/);
    await expect(dailyMed).toHaveAttribute("target", "_blank");
    await expect(panel).not.toContainText(/\bsafe\b/i);
  });

  test("Act 2: Sam's discharge list, prescription and Bottle B → concentration, units, document findings", async () => {
    await page.goto(alexUrl);
    await page.getByRole("button", { name: "Change person" }).click();
    await page.getByRole("menuitem", { name: /Sam/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Sam's medicines" })).toBeVisible();
    samUrl = page.url();
    await expect(medicines(page).getByText("Calmora Fever Relief (Bottle A)")).toBeVisible();

    async function photo(kind: "Discharge list" | "Prescription label", itemId: string) {
      await page.goto(`${samUrl}/add`);
      await page.getByRole("link", { name: /Take or choose a photo/ }).click();
      await page.getByRole("radio", { name: new RegExp(kind) }).check();
      await page.locator("input[name=library]").setInputFiles(await kitPhoto(context, itemId));
      await page.getByRole("button", { name: "Read this photo" }).click();
      await page.waitForURL(/\/review/);
    }

    // Discharge list, with one value marked "I can't read it".
    await photo("Discharge list", "discharge-list");
    await typeText(page, "Product name", "Acetaminophen 160 mg per 5 mL oral suspension");
    await typeText(page, "Form (liquid, caplet, tablet…)", "oral suspension");
    await typeText(page, "Ingredient 1", "Acetaminophen");
    await typeStrength(page, "Ingredient 1 strength", { amount: 160, perAmount: 5, perUnit: "mL" });
    await typeText(page, "Directions", "10 mL by mouth every 6 hours as needed for fever");
    await typeDose(page, "Amount in the directions", { amount: 10, unit: "mL" });
    const max24h = await reviewRow(page, "24-hour maximum");
    await max24h.getByRole("button", { name: "I can't read it" }).click();
    await expect(max24h.getByText("MedCheck will leave this detail unknown.")).toBeVisible();
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

    // Bottle B by typed UPC → skip the photo → confirm the medicine listing.
    await page.goto(`${samUrl}/add/scan`);
    await page.getByLabel(/type the NDC or barcode/).fill("399999200059");
    await page.getByRole("button", { name: "Look up" }).click();
    await expect(page.getByText("Calmora Extra Fever Relief (Bottle B)")).toBeVisible();
    await page.getByRole("button", { name: /Skip photo/ }).click();
    await page.waitForURL(/\/review/);
    await matchAllPending(page);
    await confirmMedicine(page);
    expect(page.url()).toBe(samUrl);
    // The unfinished check stays visible on the home summary beside the findings.
    await expect(page.getByText("1 check needs more details")).toBeVisible();
    // A barcode entry without a photo is grouped under the catalog label, not "No source document".
    await expect(page.getByText("Label in the MedCheck catalog")).toBeVisible();
    await expect(page.getByText("No source document")).toHaveCount(0);

    await page.locator("summary", { hasText: "Activity" }).click();
    const history = page.locator("details", { has: page.locator("summary", { hasText: "Activity" }) });
    await expect(history.getByText(/Medicine confirmed: Calmora Extra Fever Relief \(Bottle B\)/)).toBeVisible();
    await expect(history.getByText(/Document added: Discharge list/)).toBeVisible();

    const panel = await openChecks(page);
    await expect(panel.getByText("5 of 6 checks compared confirmed values · 4 found something · 1 couldn't be completed")).toBeVisible();
    await expect(panel.getByText("These liquids have different strengths of Acetaminophen")).toBeVisible();
    // Both strengths as recorded, never turned into a volume; the typed ones are marked as typed.
    await expect(
      panel.getByText(
        /As recorded: Calmora Fever Relief \(Bottle A\): 100 mg per 5 mL;.*\(you entered this\);.*Calmora Extra Fever Relief \(Bottle B\): 200 mg per 5 mL\./,
      ),
    ).toBeVisible();
    // The strengths were typed from the photos, so the question never says "the prescription label says".
    await expect(panel.getByText(/I entered the dose for the prescription label as 2 tsp/)).toBeVisible();
    await expect(panel.getByText(/The prescription label says/)).toHaveCount(0);
    await openAllEvidence(page);
    await expect(panel.getByText(/You entered this/).first()).toBeVisible();
    await expect(panel.getByText(/The amount and strength use different units/)).toBeVisible();
    await expect(panel.getByText("Your documents list different acetaminophen strengths")).toBeVisible();
    await expect(panel.getByText("Your documents write the acetaminophen dose differently")).toBeVisible();
    // Couldn't finish is its own state, with what it needs — not folded into "no findings".
    await expect(panel.getByRole("heading", { name: "Needs more details (1)" })).toBeVisible();
    await expect(panel.getByText("This check needs:")).toBeVisible();
    await expect(panel).not.toContainText(/\bsafe\b/i);
  });

  test("pharmacist report: PDF download, Share fallback, email not configured", async () => {
    await page.goto(samUrl);
    await page.getByRole("navigation", { name: /record sections/ }).getByRole("link", { name: "Report" }).click();
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

  test("\"I already gave both\": Get help and a typed description show the fixed message", async () => {
    await page.goto(samUrl);
    await page.getByRole("button", { name: "Get help" }).click();
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
    await page.locator("summary", { hasText: "Demo tools" }).click();
    await page.getByRole("button", { name: "Reset demo" }).click();
    // Asks first; Cancel has focus, so only the explicit button resets.
    const confirm = page.getByRole("alertdialog", { name: "Reset the demo household?" });
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
    await confirm.getByRole("button", { name: "Reset demo" }).click();
    await page.waitForURL((url) => /\/patients\/[0-9a-f-]{36}$/.test(url.pathname) && url.toString() !== samUrl);
    await expect(page.getByRole("heading", { level: 1, name: "My medicines" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Nothing to compare yet" })).toBeVisible();
    await expect(medicines(page).getByText("NyQuil Severe Cold & Flu")).toHaveCount(0);
  });
});
