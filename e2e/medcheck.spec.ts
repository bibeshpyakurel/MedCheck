// The product end to end against the real app and Supabase: the three doors on the landing page, a
// guest adding medicines by photo (typing what the label says), warnings, the report, Get help and
// leaving, the one-tap medicine-package path, and an email sign-in. Gemini is a local stand-in
// (e2e/fake-gemini.mjs) that reads a photo by its width; the default photo reads as nothing found.
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { ALREADY_GAVE_BOTH_MESSAGE } from "../src/components/already-gave-both";
import {
  adminClient,
  confirmMedicine,
  deleteTestUsers,
  emailSignInCode,
  labelPhoto,
  publicClient,
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

/** Choose a photo → Prescription label → review; types the label's details (Gemini reads nothing) and confirms. */
async function addMedicineByPhoto(page: Page, browser: Browser, base: string, name: string) {
  await page.goto(`${base}/add`);
  await page.locator("label", { hasText: "Choose a photo" }).locator("input[type=file]").setInputFiles(await labelPhoto(browser));
  await page.waitForURL(/\/add\/photo\?source=library$/);
  await page.getByRole("radio", { name: /Prescription label/ }).check();
  await page.getByRole("button", { name: "Read this photo" }).click();
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
    await openTab(page, "Medicine report");
    await expect(page.getByRole("heading", { level: 1, name: "Medicine report" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "You haven't added any medicines yet" })).toBeVisible();
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
    await expect(page.getByRole("navigation", { name: "Record" }).getByRole("link")).toHaveText([
      "Medicines",
      "Medicine report",
    ]);
    await expect(main).not.toContainText(/six checks|\d of 6 checks|pharmacist question|Ask a pharmacist|Copy question/i);
    await expect(main).not.toContainText(/\bsafe\b/i);
  });

  test("a prescription label photo → per-field review; the draft waits on the Medicines tab", async ({ browser }) => {
    await page.goto(`${base}/add`);
    await page.locator("label", { hasText: "Choose a photo" }).locator("input[type=file]").setInputFiles(await labelPhoto(browser));
    await page.waitForURL(/\/add\/photo\?source=library$/);
    await page.getByRole("radio", { name: /Prescription label/ }).check();
    await page.getByRole("button", { name: "Read this photo" }).click();
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/review(\?|$)/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Check the details" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm medicine" })).toBeVisible();

    await openTab(page, "Medicines");
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
    await expect(
      page.getByText("1 medicine is waiting for you to check its details. It'll appear in the report once you confirm it."),
    ).toBeVisible();

    const preview = page.locator("a", { hasText: "Preview report" });
    await expect(preview).toHaveAttribute("href", new RegExp(`^/api/patients/${patientId}/report\\.pdf\\?(.*&)?inline=1`));
    await expect(preview).toHaveAttribute("target", "_blank");
    await expect(page.getByRole("button", { name: "Share" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Send by email" })).toBeVisible();

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

/** Choose a photo of a medicine package and let MedCheck read it. */
async function readPackagePhoto(page: Page, browser: Browser, base: string, scenario?: "tylenolExtraStrength" | "unreadable") {
  await page.goto(`${base}/add`);
  await page.locator("label", { hasText: "Choose a photo" }).locator("input[type=file]").setInputFiles(await labelPhoto(browser, scenario));
  await page.waitForURL(/\/add\/photo\?source=library$/);
  // Package-first: Medicine package is already chosen.
  await expect(page.getByRole("radio", { name: /Medicine package/ })).toBeChecked();
  await page.getByRole("button", { name: "Read this photo" }).click();
}

const ENTRY_WITH_CARD = /\/entries\/[0-9a-f-]{36}\?card=new$/;

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

  test("photo → “Is this the medicine?” with the match pre-selected → Confirm → card → Done", async ({ browser }) => {
    await readPackagePhoto(page, browser, base, "tylenolExtraStrength");
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/match$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "Is this the medicine?" })).toBeVisible();

    const best = page.getByRole("radio", { name: /Tylenol Extra Strength \(caplets\)/ });
    await expect(best).toBeChecked();
    await expect(page.locator("label", { has: best })).toContainText("Acetaminophen 500 mg per caplet");
    // The 325 mg label is offered, not chosen.
    await page.getByRole("button", { name: /Other matches/ }).click();
    const regular = page.getByRole("radio", { name: /Tylenol Regular Strength/ });
    await expect(regular).not.toBeChecked();
    await expect(page.locator("label", { has: regular })).toContainText("Acetaminophen 325 mg per tablet");
    await expect(page.getByRole("button", { name: "None of these — type it in" })).toBeVisible();
    await expect(page.getByRole("main")).not.toContainText(/pharmacist|\bsafe\b/i);

    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.waitForURL(ENTRY_WITH_CARD);
    const card = page.getByRole("dialog", { name: "Tylenol Extra Strength (caplets)" });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Acetaminophen 500 mg per caplet");
    await expect(card.locator('a[href="tel:18002221222"]')).toBeVisible();
    await card.getByRole("button", { name: "Done" }).click();

    await page.waitForURL(new RegExp(`${base}$`));
    await expect(page.getByText("1 medicine on file")).toBeVisible();
    await expect(page.getByRole("region", { name: /Waiting for your review/ })).toHaveCount(0);
    await page.getByRole("link", { name: /Tylenol Extra Strength \(caplets\)/ }).first().click();
    await expect(page.getByText("Confirmed", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Photo", { exact: true }).first()).toBeVisible();
    // The card stays reachable from the entry page.
    await page.getByRole("button", { name: "View medicine card" }).click();
    await expect(page.getByRole("dialog", { name: "Tylenol Extra Strength (caplets)" })).toBeVisible();
  });

  test("unreadable package → retake screen → Type it in instead → pick from the FDA list", async ({ browser }) => {
    await readPackagePhoto(page, browser, base, "unreadable");
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/retake$/, { timeout: 60_000 });
    await expect(page.getByRole("heading", { level: 1, name: "We couldn't read this label — retake the photo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Retake photo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Check the details" })).toHaveCount(0);

    await page.getByRole("button", { name: "Type it in instead" }).click();
    await page.waitForURL(/\/match\?search=1$/);
    await page.getByLabel("Medicine name").fill("Tylenol Regular");
    const regular = page.getByRole("radio", { name: /Tylenol Regular Strength \(tablets\)/ });
    await regular.check();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await page.waitForURL(ENTRY_WITH_CARD);
    await page.getByRole("dialog", { name: "Tylenol Regular Strength (tablets)" }).getByRole("button", { name: "Done" }).click();
    await page.waitForURL(new RegExp(`${base}$`));
    await expect(page.getByText("2 medicines on file")).toBeVisible();
  });

  test("unreadable package → Retake photo → back to the camera, nothing left waiting", async ({ browser }) => {
    await readPackagePhoto(page, browser, base, "unreadable");
    await page.waitForURL(/\/entries\/[0-9a-f-]{36}\/retake$/, { timeout: 60_000 });
    await page.getByRole("button", { name: "Retake photo" }).click();
    await page.waitForURL(/\/add\/photo\?kind=otc_package&source=camera$/);
    await expect(page.getByRole("radio", { name: /Medicine package/ })).toBeChecked();
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
