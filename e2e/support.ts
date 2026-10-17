// Helpers for the e2e tests: driving the review screen, making a label "photo", signing in by email
// code without sending email, and deleting the auth users a test run created in the real Supabase project.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

/** One reviewed value on the review screen, found by its heading. */
export function fieldRow(page: Page, label: string): Locator {
  return page.locator("div[data-state]").filter({ has: page.getByRole("heading", { name: label, exact: true }) });
}

/** Review groups fold away; open the one holding this value (its content stays in the page while closed). */
export async function reviewRow(page: Page, label: string): Promise<Locator> {
  const row = fieldRow(page, label);
  const toggle = page.locator("section").filter({ has: row }).locator("h2 > button[aria-expanded]");
  if ((await toggle.getAttribute("aria-expanded")) === "false") await toggle.click();
  await expect(row).toBeVisible();
  return row;
}

/** Types a value on the review screen with "Change it", as printed on the label. */
export async function typeText(page: Page, label: string, value: string) {
  const row = await reviewRow(page, label);
  await row.getByRole("button", { name: "Change it" }).click();
  await row.locator("input, textarea").first().fill(value);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row).toHaveAttribute("data-state", "edited");
}

/** Types a strength in mg ("500 mg per caplet": `{ amount: 500, perUnit: "caplet" }`). */
export async function typeStrength(page: Page, label: string, s: { amount: number; perAmount?: number; perUnit: string }) {
  const row = await reviewRow(page, label);
  await row.getByRole("button", { name: "Change it" }).click();
  await row.getByLabel("Amount", { exact: true }).fill(String(s.amount));
  await row.getByLabel("Unit", { exact: true }).selectOption("mg");
  await row.getByLabel("Per amount (leave empty for 'each')").fill(s.perAmount ? String(s.perAmount) : "");
  await row.getByLabel("Per unit").fill(s.perUnit);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row).toHaveAttribute("data-state", "edited");
}

export async function confirmMedicine(page: Page) {
  await page.getByRole("button", { name: "Confirm medicine" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/review"));
}

/** A PNG "photo" of a simple printed label, rendered in a throwaway page. */
export async function labelPhoto(browser: Browser) {
  const page = await browser.newPage({ viewport: { width: 480, height: 320 } });
  await page.setContent(`
    <body style="margin:0;font:20px/1.4 sans-serif;background:#fff;color:#000">
      <div style="margin:24px;padding:20px;border:3px solid #000">
        <h1 style="margin:0 0 8px;font-size:28px">Drug Facts</h1>
        <p style="margin:0"><b>Active ingredient</b> (in each caplet)<br>Acetaminophen 500 mg</p>
        <p style="margin:8px 0 0"><b>Purpose</b> Pain reliever / fever reducer</p>
      </div>
    </body>`);
  const buffer = await page.screenshot({ type: "png" });
  await page.close();
  return { name: "label.png", mimeType: "image/png", buffer };
}

/** The signed-in user's id, from the Supabase session @supabase/ssr keeps in (possibly chunked) cookies. */
export async function sessionUserId(context: BrowserContext): Promise<string | null> {
  const parts = (await context.cookies())
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (parts.length === 0) return null;
  const raw = parts.map((c) => c.value).join("");
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString("utf8") : raw;
  return (JSON.parse(json) as { user: { id: string } }).user.id;
}

/** The secret-key client, or null when SUPABASE_SECRET_KEY isn't set (e.g. CI without that secret). */
export function adminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  return url && secret ? createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
}

/** The publishable-key client, signed out: what anyone on the internet can read. */
export function publicClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Creates (or finds) the email account and returns a fresh sign-in code for it, without sending any
 * email: the built-in mailer is rate limited and only delivers to team addresses.
 */
export async function emailSignInCode(
  admin: SupabaseClient,
  email: string,
  name: { first_name: string; last_name: string },
): Promise<{ userId: string; code: string }> {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email, options: { data: name } });
  if (error) throw error;
  return { userId: data.user.id, code: data.properties.email_otp };
}

/**
 * Deletes auth users this run created (by id — never anyone else), and their label photos first.
 * Deleting the user cascades to all their rows. Without SUPABASE_SECRET_KEY nothing can be deleted
 * here; a guest's records are already gone once the test leaves the guest session.
 */
export async function deleteTestUsers(userIds: Iterable<string>) {
  const admin = adminClient();
  if (!admin) return;
  for (const id of new Set(userIds)) {
    const photos = await admin.storage.from("label-photos").list(id, { limit: 1000 });
    const paths = (photos.data ?? []).map((f) => `${id}/${f.name}`);
    if (paths.length > 0) await admin.storage.from("label-photos").remove(paths);
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error && error.status !== 404) console.warn(`Could not delete test user ${id}: ${error.message}`);
  }
}
