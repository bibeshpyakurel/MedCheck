// The product end to end against the real app and Supabase: the three doors on the landing page, a
// guest adding medicines by photo (typing what the label says), warnings, the report, Get help and
// leaving, the medicine-package pop-up (confirm, card or comparison, Save / Don't save), and an email sign-in. A photo is read as soon as it's
// chosen; Gemini is a local stand-in (e2e/fake-gemini.mjs) that reads a photo, and says what kind it
// is, by its width; the default photo reads as nothing found (kind unsure, so a package).
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ALREADY_GAVE_BOTH_MESSAGE } from "../src/components/already-gave-both";
import {
  adminClient,
  confirmMedicine,
  deleteTestUsers,
  emailSignInCode,
  labelPhoto,
  publicClient,
  reviewRow,
  sessionUserId,
  typeStrength,
  typeText,
} from "./support";

const PHONE = { width: 375, height: 667 };
const RECORD_URL = /\/patients\/([0-9a-f-]{36})\/add$/;

/** Fits on one screen: no vertical scrolling. */
async function expectNoVerticalScroll(page: Page) {
  const { scrollHeight, innerHeight } = await page.evaluate(() => ({
    scrollHeight: document.scrollingElement!.scrollHeight,
    innerHeight: window.innerHeight,
  }));
  expect(scrollHeight, "page scrolls vertically").toBeLessThanOrEqual(innerHeight + 1);
}

async function expectThreeDoors(page: Page) {
  await expect(page.getByRole("button", { name: "Continue with Google" })).toBeVisible();
  // A link styled as a button (Base UI gives it role="button").
  await expect(page.getByRole("button", { name: "Continue with email" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue as a guest" })).toBeVisible();
}

/** Two ways in, both photos; no barcode scanning. */
async function expectCaptureOptions(page: Page) {
  await expect(page.getByRole("heading", { level: 1, name: "Add a medicine" })).toBeVisible();
  await expect(page.locator("label", { hasText: "Take a photo" }).locator("input[type=file]")).toHaveCount(1);
  await expect(page.locator("label", { hasText: "Choose a photo" }).locator("input[type=file]")).toHaveCount(1);
  await expect(page.getByRole("main").locator("label:has(input[type=file])")).toHaveCount(2);
  await expect(page.locator("body")).not.toContainText(/barcode|\bscan\b/i);
}

/**
 * Choose a photo of a prescription label (Gemini says so, and reads no medicine) → it's read at once →
 * review; types the label's details and confirms.
 */
async function addMedicineByPhoto(page: Page, browser: Browser, base: string, name: string) {
  await page.goto(`${base}/add`);
  await page
    .locator("label", { hasText: "Choose a photo" })
    .locator("input[type=file]")
    .setInputFiles(await labelPhoto(browser, "prescriptionNothingRead"));
  await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/review(\?|$)/, { timeout: 60_000 });
  await typeText(page, "Product name", name);
  await typeText(page, "Form (liquid, caplet, tablet…)", "caplet");
  await typeText(page, "Ingredient 1", "Acetaminophen");
  await typeStrength(page, "Ingredient 1 strength", { amount: 500, perUnit: "caplet" });
  await confirmMedicine(page);
  await expect(page).toHaveURL(new RegExp(`${base}$`));
}

/** Opens a record tab ("Medicines" or "Medicine report") from the record navigation. */
async function openTab(page: Page, name: "Medicines" | "Medicine report") {
  await page.getByRole("navigation", { name: "Record" }).getByRole("link", { name, exact: true }).click();
  await page.waitForURL(name === "Medicines" ? /\/patients\/[0-9a-f-]{36}$/ : /\/export$/);
}

/** Opens "My medicines" or "Medicine report" from the ☰ menu (the add flow shows no tabs). */
async function openFromMenu(page: Page, name: "My medicines" | "Medicine report") {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name, exact: true }).click();
  await page.waitForURL(name === "My medicines" ? /\/patients\/[0-9a-f-]{36}$/ : /\/export$/);
}

async function openMenu(page: Page) {
  await page.getByRole("button", { name: "Menu" }).click();
  const account = page.getByRole("region", { name: "Account" });
  await expect(account).toBeVisible();
  return account;
}

test.describe("signed out", () => {
  test("landing: three doors, one screen, no demo, Poison Control only behind Get help", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/");
    await expectThreeDoors(page);
    await expect(page.locator("body")).not.toContainText(/\bdemo\b/i);
    await expect(page.getByRole("button", { name: /Try the demo/ })).toHaveCount(0);

    const footer = page.locator("footer");
    await expect(footer).toContainText("Evidence, not advice.");
    await expect(footer).not.toContainText("1-800-222-1222");
    await expect(footer.locator('a[href^="tel:"]')).toHaveCount(0);
    await expectNoVerticalScroll(page);

    await page.getByRole("button", { name: "Get help" }).click();
    const help = page.locator("#get-help");
    await expect(help).toBeVisible();
    await expect(help).toContainText(ALREADY_GAVE_BOTH_MESSAGE);
    await expect(help.locator('a[href="tel:18002221222"]')).toBeVisible();
  });

  test("Continue with Google: a friendly message while the provider is off", async ({ page, context }) => {
    const settings = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
    }).then((r) => r.json() as Promise<{ external?: { google?: boolean } }>);
    test.skip(settings.external?.google === true, "Google sign-in is enabled in Supabase; this test covers it being off");

    await page.goto("/");
    await page.getByRole("button", { name: "Continue with Google" }).click();
    await expect(page.getByText("Google sign-in isn't available right now", { exact: false })).toBeVisible();
    await expect(page).toHaveURL(/\/\?error=google$/);
    await expectThreeDoors(page);
    expect(await sessionUserId(context)).toBeNull();
  });
});

test.describe("guest", () => {
  test.describe.configure({ mode: "serial" });

  let context: BrowserContext;
  let page: Page;
  let base: string;
  let patientId: string;
  let userId: string | null = null;
  const beforeUnloadPrompts: string[] = [];

  test.beforeAll(async ({ browser }, testInfo) => {
    context = await browser.newContext(testInfo.project.use);
    page = await context.newPage();
    // A guest's tab asks before closing or reloading; let the test's own navigations through.
    page.on("dialog", (dialog) => {
      if (dialog.type() === "beforeunload") {
        beforeUnloadPrompts.push(page.url());
        return dialog.accept();
      }
      return dialog.dismiss();
    });
  });

  test.afterAll(async () => {
    if (userId) await deleteTestUsers([userId]);
    await context.close();
  });

  test("Continue as a guest lands on the capture page", async () => {
    await page.goto("/");
    await page.getByRole("button", { name: "Continue as a guest" }).click();
    await page.waitForURL(RECORD_URL);
    patientId = RECORD_URL.exec(new URL(page.url()).pathname)![1];
    base = `/patients/${patientId}`;
    userId = await sessionUserId(context);
    expect(userId).not.toBeNull();
    await expectCaptureOptions(page);
  });

  test("the report starts empty", async () => {
    // The capture page is part of adding a medicine: Cancel and its steps instead of the tabs.
    await expect(page.getByText("Step 1 of 3 · Photo")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Record" })).toHaveCount(0);
    await openFromMenu(page, "Medicine report");
    await expect(page.getByRole("heading", { level: 1, name: "Medicine report" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "You haven't added any medicines yet" })).toBeVisible();
    // Nothing to share yet: every action waits for a confirmed medicine.
    await expect(page.getByRole("button", { name: "Preview report" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Send by email" })).toBeDisabled();
  });

  test("two medicines by photo share acetaminophen → a warning on the Medicines tab", async ({ browser }) => {
    await addMedicineByPhoto(page, browser, base, "Extra Strength Pain Reliever");
    await addMedicineByPhoto(page, browser, base, "Severe Cold & Flu");

    await expect(page.getByText("2 medicines on file")).toBeVisible();
    const warnings = page.getByRole("region", { name: /^Warnings/ });
    await expect(warnings.getByRole("heading", { name: /^Warnings \(1\)$/ })).toBeVisible();
    const overlap = warnings.getByRole("heading", { name: /both contain Acetaminophen$/ });
    await expect(overlap).toBeVisible();
    await expect(overlap).toContainText("Extra Strength Pain Reliever");
    await expect(overlap).toContainText("Severe Cold & Flu");

    // The old checks list is gone: no Checks tab, no check counts, no pharmacist questions, never "safe".
    const main = page.getByRole("main");
    // The two tabs (on phones, a bottom bar with Add between them).
    const record = page.getByRole("navigation", { name: "Record" });
    await expect(record.getByRole("link", { name: "Medicines", exact: true })).toBeVisible();
    await expect(record.getByRole("link", { name: "Medicine report", exact: true })).toBeVisible();
    await expect(record.getByRole("link", { name: /check/i })).toHaveCount(0);
    await expect(main).not.toContainText(/six checks|\d of 6 checks|pharmacist question|Ask a pharmacist|Copy question/i);
    await expect(main).not.toContainText(/\bsafe\b/i);
  });

  test("a prescription label photo → per-field review; the draft waits on the Medicines tab", async ({ browser }) => {
    await page.goto(`${base}/add`);
    await page
      .locator("label", { hasText: "Choose a photo" })
      .locator("input[type=file]")
      .setInputFiles(await labelPhoto(browser, "prescriptionNothingRead"));
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/review(\?|$)/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Check the details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm medicine" })).toBeVisible();
    await expect(page.getByText("Step 2 of 3 · Check the details")).toBeVisible();

    // Leaving with a change asks first; Discard changes goes on (the draft keeps waiting).
    await typeText(page, "Product name", "Half-typed name");
    await page.getByRole("button", { name: "Menu" }).click();
    await page.getByRole("navigation", { name: "Menu" }).getByRole("link", { name: "My medicines" }).click();
    const discard = page.getByRole("alertdialog", { name: "Discard your changes?" });
    await expect(discard).toBeVisible();
    await expect(page).toHaveURL(/\/review(\?|$)/);
    await discard.getByRole("button", { name: "Keep editing" }).click();
    await expect(discard).toBeHidden();
    // The menu is still open: Back closes it, and asks nothing.
    await page.goBack();
    await expect(page.getByRole("navigation", { name: "Menu" })).toBeHidden();
    await expect(discard).toBeHidden();
    // Back again would leave the page: it asks.
    await page.goBack();
    await expect(discard).toBeVisible();
    // Back was heading to Add a medicine (the photo step was replaced by the review).
    await discard.getByRole("button", { name: "Discard changes" }).click();
    await page.waitForURL(/\/add$/);
    await openFromMenu(page, "My medicines");
    const waiting = page.getByRole("region", { name: /Waiting for your review/ });
    await expect(waiting.getByRole("heading", { name: "Waiting for your review (1)" })).toBeVisible();
    await expect(waiting.getByRole("link", { name: /Check details/ })).toHaveAttribute("href", /\/review$/);
    await expect(page.getByText("2 medicines on file")).toBeVisible();
  });

  // Before the report test: its download link lets the page unload unprompted for a couple of seconds.
  test("reloading asks first (beforeunload), because a guest's records can't be retrieved", async () => {
    const before = beforeUnloadPrompts.length;
    await page.reload();
    expect(beforeUnloadPrompts.length).toBe(before + 1);
  });

  test("report: pending line, PDF download, preview, share and email", async () => {
    await openTab(page, "Medicine report");
    await expect(page.getByText("In this report: 2 medicines · 1 warning")).toBeVisible();
    // As a paragraph: the report thumbnail repeats it, but the thumbnail is a picture (aria-hidden).
    await expect(
      page.getByRole("paragraph").filter({
        hasText: "1 medicine is waiting for you to check its details. It'll appear in the report once you confirm it.",
      }),
    ).toBeVisible();

    // Headless Chromium can't share files and this run has no email sender, so Share would only repeat
    // Send by email (download + your email app): it isn't shown.
    await expect(page.getByRole("button", { name: "Send by email" })).toBeVisible();
    await expect(page.getByRole("button", { name: /^(Share|Download and email)$/ })).toHaveCount(0);

    // The preview is a MedCheck page, with the way back and the actions below.
    await page.getByRole("button", { name: "Preview report" }).click();
    await page.waitForURL(new RegExp(`/patients/${patientId}/export/preview`));
    await expect(page.getByText("This is what the PDF contains.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Warnings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Download PDF" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Medicine report" }).last().click();
    await page.waitForURL(/\/export$/);

    const [download] = await Promise.all([page.waitForEvent("download"), page.locator("a[download]").click()]);
    expect(download.suggestedFilename()).toMatch(/^Medicine-report.*\.pdf$/);
    const chunks: Buffer[] = [];
    for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
    expect(Buffer.concat(chunks).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("Get help shows the fixed message with a tap-to-call link", async () => {
    await page.getByRole("button", { name: "Get help" }).click();
    const help = page.locator("#get-help");
    await expect(help).toBeVisible();
    await expect(help).toContainText(ALREADY_GAVE_BOTH_MESSAGE);
    await expect(help.locator('a[href="tel:18002221222"]')).toBeVisible();
    await help.getByRole("button", { name: "Close" }).click();
    await expect(help).toBeHidden();
    // Closing steps back over Get help's history entry (device Back closes it); let that land.
    await page.waitForFunction(() => !(history.state as { medcheckOverlay?: number } | null)?.medcheckOverlay);
  });

  test("a medicine that isn't there: the 404 page, titled Page not found, leads to My medicines", async () => {
    await page.goto(`${base}/entries/${GHOST_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "We couldn't find that page" })).toBeVisible();
    await expect(page).toHaveTitle("Page not found · MedCheck");
    await page.getByRole("button", { name: "Back to my medicines" }).click();
    await page.waitForURL(new RegExp(`${base}$`));
    // The URL changes with the loading skeleton; My medicines is there once its title is.
    await expect(page.getByRole("heading", { level: 1, name: "My medicines" })).toBeVisible();
  });

  test("☰ → Leave guest session asks, then signs out and the record is gone", async () => {
    const recordUrl = `${base}`;
    const account = await openMenu(page);
    await account.getByRole("button", { name: "Leave guest session" }).click();
    const confirm = page.getByRole("alertdialog", { name: "Leave without saving?" });
    await expect(confirm.getByRole("button", { name: "Cancel" })).toBeFocused();
    await confirm.getByRole("button", { name: "Leave and delete" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expectThreeDoors(page);
    expect(await sessionUserId(context)).toBeNull();

    await page.goto(recordUrl);
    await expect(page).toHaveURL((url) => url.pathname === "/");
    await expectThreeDoors(page);

    // Signed out, the record can't be read; and the guest's rows were deleted, not just hidden.
    const { data: visible } = await publicClient().from("patients").select("id").eq("id", patientId);
    expect(visible ?? []).toEqual([]);
    const admin = adminClient();
    if (admin) {
      const { data: rows, error } = await admin.from("patients").select("id").eq("id", patientId);
      expect(error).toBeNull();
      expect(rows).toEqual([]);
      // Nothing is kept after a guest leaves: the label photo is gone from Storage too.
      const { data: photos } = await admin.storage.from("label-photos").list(userId!);
      expect(photos ?? []).toEqual([]);
    }
  });
});

/** Choose a photo on the capture page; MedCheck reads it at once (no questions, no "Read" tap). */
async function readPackagePhoto(
  page: Page,
  browser: Browser,
  base: string,
  scenario?: "tylenolExtraStrength" | "unreadable" | "advilAndTylenol" | "tylenolByCode",
) {
  await page.goto(`${base}/add`);
  await page.locator("label", { hasText: "Choose a photo" }).locator("input[type=file]").setInputFiles(await labelPhoto(browser, scenario));
}

/** How many medicines My medicines lists as confirmed ("3 medicines on file"). */
async function medicinesOnFile(page: Page, base: string): Promise<number> {
  await page.goto(base);
  const text = await page.getByText(/\d+ medicines? on file/).textContent();
  return Number(/\d+/.exec(text ?? "")?.[0]);
}

// `?card=new` opens the just-added card, then drops off the URL.
const ENTRY_WITH_CARD = /\/entries\/[0-9a-f-]{36}(\?card=new)?$/;
const GHOST_ID = "00000000-0000-4000-8000-000000000000";

// The fast path for store-bought medicines, against the hand-checked Tylenol rows in the catalog.
test.describe("medicine package photo", () => {
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

  test("one medicine: the pop-up asks “Is this …?” → Continue → its card with Quick answers → Save → My medicines", async ({ browser }) => {
    await readPackagePhoto(page, browser, base, "tylenolExtraStrength");
    // The pop-up opens over the photo screen; nothing navigates and nothing is saved yet.
    const confirm = page.getByRole("dialog", { name: "Is this Tylenol Extra Strength (caplets)?" });
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/add\/photo\?source=library$/);
    await expect(confirm).toContainText("Acetaminophen 500 mg per caplet");
    await expect(confirm).toContainText("Kenvue");
    await expect(confirm).not.toContainText(/\bsafe\b|bottle/i);

    // Other products are offered, not chosen, and each product once: the catalog's two TYLENOL Extra
    // Strength gelcap rows are one choice. The chosen one, shown above, isn't listed again.
    await confirm.getByRole("button", { name: "Not this one?" }).click();
    const others = confirm.getByRole("radio", { name: /^TYLENOL Extra Strength, Acetaminophen 500 mg per / });
    await expect(others.first()).toBeVisible();
    await expect(others.first()).not.toBeChecked();
    await expect(confirm.getByRole("radio", { name: "TYLENOL Extra Strength, Acetaminophen 500 mg per gelcap" })).toHaveCount(1);
    await expect(confirm.getByRole("radio", { name: /^Tylenol Extra Strength \(caplets\),/ })).toHaveCount(0);
    await expect(confirm.getByRole("radio", { checked: true })).toHaveCount(0);
    expect(await confirm.getByRole("radio").count()).toBeLessThanOrEqual(5);

    await confirm.getByRole("button", { name: "Continue" }).click();
    const card = page.getByRole("dialog", { name: "Tylenol Extra Strength (caplets)" });
    await expect(card.getByRole("heading", { name: "Quick answers" })).toBeVisible();
    // Quick answers' "Took too much?" and the footer both carry Poison Control.
    await expect(card.locator('a[href="tel:18002221222"]').first()).toBeVisible();
    await expect(card).toContainText("Nothing is saved yet.");

    // Device Back returns to the question; Continue again.
    await page.goBack();
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Continue" }).click();
    await card.getByRole("button", { name: "Save to My medicines" }).click();

    await page.waitForURL(new RegExp(`${base}$`));
    await expect(page.getByText("1 medicine on file")).toBeVisible();
    await expect(page.getByRole("region", { name: /Waiting for your review/ })).toHaveCount(0);
    // My medicines took the photo page's place: Back skips the finished photo.
    await page.goBack();
    await page.waitForURL(/\/add$/);
    await page.goForward();
    await page.waitForURL(new RegExp(`${base}$`));
    await page.getByRole("link", { name: /Tylenol Extra Strength \(caplets\)/ }).first().click();
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Photo", { exact: true }).first()).toBeVisible();
    // The card stays reachable from the entry page.
    await page.getByRole("button", { name: "View medicine card" }).click();
    await expect(page.getByRole("dialog", { name: "Tylenol Extra Strength (caplets)" })).toBeVisible();
  });

  test("unreadable package → retake screen → Type it in instead → pick from the FDA list", async ({ browser }) => {
    await readPackagePhoto(page, browser, base, "unreadable");
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/retake\?why=glare$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "We couldn't read this label — retake the photo" })).toBeVisible();
    // Gemini's reason, in words about the photo.
    await expect(page.getByText("Light is reflecting off the label.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Retake photo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check the details" })).toHaveCount(0);

    await page.getByRole("button", { name: "Type it in instead" }).click();
    await page.waitForURL(/\/match\?search=1$/);
    await page.getByLabel("Medicine name").fill("Tylenol Regular");
    const regular = page.getByRole("radio", { name: /Tylenol Regular Strength \(tablets\)/ });
    await regular.check();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.waitForURL(ENTRY_WITH_CARD);
    const card = page.getByRole("dialog", { name: "Tylenol Regular Strength (tablets)" });
    await expect(card).toBeVisible();

    // Device Back closes the card and stays on the medicine…
    await page.goBack();
    await expect(card).toBeHidden();
    await expect(page).toHaveURL(/\/entries\/[0-9a-f-]{36}$/);
    // …and Back again skips the answered steps (retake, "Type it in") to Add a medicine.
    await page.goBack();
    await page.waitForURL(/\/add$/);
    await page.goForward();
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("dialog")).toHaveCount(0);

    // With medicines on file, the logo opens My medicines.
    await page.getByRole("banner").getByRole("link").first().click();
    await page.waitForURL(new RegExp(`${base}$`));
    await expect(page.getByText("2 medicines on file")).toBeVisible();
  });

  test("unreadable package → Retake photo → back to the camera, nothing left waiting", async ({ browser }) => {
    await readPackagePhoto(page, browser, base, "unreadable");
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/retake\?why=glare$/, { timeout: 60_000 });
    await page.getByRole("button", { name: "Retake photo" }).click();
    await page.waitForURL(/\/add\/photo\?source=camera$/);
    await expect(page.locator("label", { hasText: "Take a photo" }).locator("input[type=file]")).toHaveCount(1);
    await expect(page.getByRole("radio")).toHaveCount(0);
    await page.goto(base);
    await expect(page.getByRole("region", { name: /Waiting for your review/ })).toHaveCount(0);
  });

  test("a medicine package with nothing found (Gemini read no medicine) also asks for a retake", async ({ browser }) => {
    await readPackagePhoto(page, browser, base);
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/retake$/, { timeout: 60_000 });
    await expect(page.getByRole("button", { name: "Type it in instead" })).toBeVisible();

    // Left waiting: a package draft goes back to its one-tap step, not the per-field review.
    await page.goto(base);
    const waiting = page.getByRole("region", { name: /Waiting for your review/ });
    await expect(waiting.getByRole("link", { name: /Check details/ })).toHaveAttribute("href", /\/entries\/[0-9a-f-]{36}\/match$/);

    // Cancel in the add flow asks, then deletes the medicine that was waiting.
    await waiting.getByRole("link", { name: /Check details/ }).click();
    await page.waitForURL(/\/match$/);
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("alertdialog", { name: "Discard this medicine?" }).getByRole("button", { name: "Discard" }).click();
    await page.waitForURL(new RegExp(`${base}$`));
    await expect(page.getByRole("region", { name: /Waiting for your review/ })).toHaveCount(0);
  });

  test("the photo page asks nothing first; a prescription photo is read at once → per-field review", async ({ browser }) => {
    await page.goto(`${base}/add/photo?source=library`);
    await expect(page.getByText("MedCheck reads the photo, then you confirm what it found.")).toBeVisible();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(page.getByText("What is this a photo of?")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Read this photo" })).toHaveCount(0);

    // Gemini says it's a prescription label: the per-field review, with what it read waiting for a check.
    await page.locator("label", { hasText: "Choose a photo" }).locator("input[type=file]").setInputFiles(await labelPhoto(browser, "prescriptionLabel"));
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/review$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Check the details" })).toBeVisible();
    const name = await reviewRow(page, "Product name");
    await expect(name).toContainText("Amoxicillin");
    await expect(name).toHaveAttribute("data-state", "pending");

    // The kind is saved on the photo's document: the waiting draft goes back to the review, not /match.
    await page.goto(base);
    const waiting = page.getByRole("region", { name: /Waiting for your review/ });
    await expect(waiting.getByRole("link", { name: /Check details/ })).toHaveCount(1);
    await expect(waiting.getByRole("link", { name: /Check details/ })).toHaveAttribute("href", /\/review$/);
  });

  test("two medicines: a row each → Continue → Together (nothing shared) and both cards → Save → both on My medicines", async ({ browser }) => {
    const before = await medicinesOnFile(page, base);
    await readPackagePhoto(page, browser, base, "advilAndTylenol");
    const confirm = page.getByRole("dialog", { name: "2 medicines in this photo" });
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    const first = confirm.getByRole("region", { name: /Advil/ });
    const second = confirm.getByRole("region", { name: /Tylenol Extra Strength/i });
    await expect(first).toContainText("1 of 2");
    await expect(second).toContainText("2 of 2");
    await expect(first.getByRole("button", { name: "Remove from this photo" })).toBeVisible();
    await expect(second.getByRole("button", { name: "None of these — type it in" })).toBeVisible();

    await confirm.getByRole("button", { name: "Continue" }).click();
    const result = page.getByRole("dialog", { name: "2 medicines from this photo" });
    await expect(result.getByRole("heading", { name: "Together" })).toBeVisible();
    await expect(result).toContainText("No shared active ingredient found in confirmed fields.");
    await expect(result).not.toContainText(/\bsafe\b/i);
    const cards = result.getByRole("heading", { level: 4 }).getByRole("button");
    await expect(cards).toHaveCount(2);
    await cards.filter({ hasText: /Tylenol/i }).click();
    await expect(result.getByRole("heading", { name: "Quick answers" })).toBeVisible();

    await result.getByRole("button", { name: "Save to My medicines" }).click();
    await page.waitForURL(new RegExp(`${base}$`));
    await expect(page.getByText(`${before + 2} medicines on file`)).toBeVisible();
    await expect(page.getByRole("main").getByRole("link", { name: /Advil/ }).first()).toBeVisible();
    const waiting = page.getByRole("region", { name: /Waiting for your review/ });
    await expect(waiting.locator('a[href$="/match"]')).toHaveCount(0);
  });

  test("Remove from this photo: only the medicine kept is saved; the removed one is gone", async ({ browser }) => {
    const before = await medicinesOnFile(page, base);
    await readPackagePhoto(page, browser, base, "advilAndTylenol");
    const confirm = page.getByRole("dialog", { name: "2 medicines in this photo" });
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    await confirm.getByRole("region", { name: /Advil/ }).getByRole("button", { name: "Remove from this photo" }).click();
    await expect(confirm.getByRole("region", { name: "Medicine 1 of 2, removed" })).toContainText("removed from this photo");
    await confirm.getByRole("button", { name: "Continue" }).click();

    // One medicine left: its card, not a comparison.
    const card = page.getByRole("dialog", { name: /^TYLENOL Extra Strength|^Tylenol Extra Strength/ });
    await expect(card.getByRole("heading", { name: "Quick answers" })).toBeVisible();
    await expect(card.getByRole("heading", { name: "Together" })).toHaveCount(0);
    await card.getByRole("button", { name: "Save to My medicines" }).click();
    await page.waitForURL(new RegExp(`${base}$`));
    await expect(page.getByText(`${before + 1} medicines on file`)).toBeVisible();
    const waiting = page.getByRole("region", { name: /Waiting for your review/ });
    await expect(waiting.locator('a[href$="/match"]')).toHaveCount(0);
  });

  test("Don't save: nothing is saved, and the photo screen starts again", async ({ browser }) => {
    const before = await medicinesOnFile(page, base);
    await readPackagePhoto(page, browser, base, "tylenolExtraStrength");
    const confirm = page.getByRole("dialog", { name: "Is this Tylenol Extra Strength (caplets)?" });
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    await confirm.getByRole("button", { name: "Continue" }).click();
    const card = page.getByRole("dialog", { name: "Tylenol Extra Strength (caplets)" });
    await card.getByRole("button", { name: "Don't save" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/\/add\/photo\?source=library$/);
    await expect(page.getByText("No photo yet")).toBeVisible();

    expect(await medicinesOnFile(page, base)).toBe(before);
    await expect(page.getByRole("region", { name: /Waiting for your review/ }).locator('a[href$="/match"]')).toHaveCount(0);
  });

  test("Cancel discards the read; closing the pop-up instead keeps it waiting for review", async ({ browser }) => {
    await readPackagePhoto(page, browser, base, "tylenolExtraStrength");
    const confirm = page.getByRole("dialog", { name: "Is this Tylenol Extra Strength (caplets)?" });
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("No photo yet")).toBeVisible();

    // Device Back (or ×) only closes it: the read waits, and the pop-up can open again.
    await page.locator("label", { hasText: "Choose a photo" }).locator("input[type=file]").setInputFiles(await labelPhoto(browser, "tylenolExtraStrength"));
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    await page.goBack();
    await expect(confirm).toBeHidden();
    await expect(page.getByRole("status").filter({ hasText: "Not saved yet." })).toBeVisible();
    await page.getByRole("button", { name: "Check the medicines again" }).click();
    await expect(confirm).toBeVisible();
    await confirm.getByRole("button", { name: "Close" }).click();
    await expect(confirm).toBeHidden();

    await page.goto(base);
    await expect(page.getByRole("region", { name: /Waiting for your review/ }).locator('a[href$="/match"]')).toHaveCount(1);
  });

  test("a package where only the printed NDC is legible still finds its FDA label, pre-selected", async ({ browser }) => {
    await readPackagePhoto(page, browser, base, "tylenolByCode");
    const confirm = page.getByRole("dialog", { name: "Is this Tylenol Extra Strength (caplets)?" });
    await expect(confirm).toBeVisible({ timeout: 60_000 });
    await expect(confirm).toContainText("Matches the NDC printed on the package.");
    await expect(confirm).toContainText("Acetaminophen 500 mg per caplet");
    await confirm.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });

  test("the type-in search never offers fictional demo products", async () => {
    const response = await page.request.get("/api/catalog/search?q=Calmora");
    expect(response.ok()).toBe(true);
    const { options } = (await response.json()) as { options: { brandName: string }[] };
    expect(options.filter((o) => /calmora/i.test(o.brandName))).toEqual([]);
  });
});

// Its own guest, so a layout regression doesn't skip the guest journey above.
test("the capture page fits one phone screen", async ({ page, context }) => {
  await page.setViewportSize(PHONE);
  await page.goto("/");
  await page.getByRole("button", { name: "Continue as a guest" }).click();
  await page.waitForURL(RECORD_URL);
  const userId = await sessionUserId(context);
  try {
    await expectCaptureOptions(page);
    await expectNoVerticalScroll(page);
  } finally {
    if (userId) await deleteTestUsers([userId]);
  }
});

test("Continue with email: code sign-in, name in the menu, sign out", async ({ page }) => {
  const admin = adminClient();
  test.skip(!admin, "SUPABASE_SECRET_KEY is not set: the test can't make a sign-in code without sending email");

  const email = `e2e+${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}@medcheck-e2e.test`;
  const created: string[] = [];
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Continue with email" }).click();
    await page.waitForURL(/\/sign-in$/);
    await page.getByLabel("Email").fill(email);
    await page.getByLabel(/First name/).fill("E2E");
    await page.getByLabel(/Last name/).fill("Tester");
    await expect(page.getByRole("button", { name: "Email me a code" })).toBeEnabled();
    // Not submitted: the built-in mailer is rate limited. The admin API makes the same code instead.

    const { userId, code } = await emailSignInCode(admin!, email, { first_name: "E2E", last_name: "Tester" });
    created.push(userId);
    const query = new URLSearchParams({ email, first_name: "E2E", last_name: "Tester" });
    await page.goto(`/sign-in/verify?${query}`);
    await expect(page.getByRole("heading", { level: 1, name: "Check your email" })).toBeVisible();
    await page.getByLabel("Code").fill(code);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(RECORD_URL);
    await expectCaptureOptions(page);

    const account = await openMenu(page);
    await expect(account).toContainText("Signed in as E2E Tester");
    await expect(account.getByRole("button", { name: "Leave guest session" })).toHaveCount(0);
    await account.getByRole("button", { name: "Sign out" }).click();
    await page.waitForURL((url) => url.pathname === "/");
    await expectThreeDoors(page);
  } finally {
    await deleteTestUsers(created);
  }
});
