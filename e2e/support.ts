// Helpers for the demo-flow e2e test: driving the review screen, making "photos" from the demo
// kit, and deleting the data a test run created in the real Supabase project.
import { createClient } from "@supabase/supabase-js";
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";

/** One reviewed value on the review screen, found by its heading. */
export function fieldRow(page: Page, label: string): Locator {
  return page.locator("div[data-state]").filter({ has: page.getByRole("heading", { name: label, exact: true }) });
}

export async function typeText(page: Page, label: string, value: string) {
  const row = fieldRow(page, label);
  await row.getByRole("button", { name: "Edit" }).click();
  await row.locator("input, textarea").first().fill(value);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row).toHaveAttribute("data-state", "edited");
}

export async function typeStrength(
  page: Page,
  label: string,
  s: { amount: number; perAmount?: number; perUnit: string },
) {
  const row = fieldRow(page, label);
  await row.getByRole("button", { name: "Edit" }).click();
  await row.getByLabel("Amount", { exact: true }).fill(String(s.amount));
  await row.getByLabel("Unit", { exact: true }).selectOption("mg");
  await row.getByLabel("Per amount (leave empty for 'each')").fill(s.perAmount ? String(s.perAmount) : "");
  await row.getByLabel("Per unit").fill(s.perUnit);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row).toHaveAttribute("data-state", "edited");
}

export async function typeDose(page: Page, label: string, d: { amount: number; unit: string }) {
  const row = fieldRow(page, label);
  await row.getByRole("button", { name: "Edit" }).click();
  await row.getByLabel("Amount", { exact: true }).fill(String(d.amount));
  await row.getByLabel("Unit", { exact: true }).fill(d.unit);
  await row.getByRole("button", { name: "Save" }).click();
  await expect(row).toHaveAttribute("data-state", "edited");
}

/** Taps Matches on every value still waiting for review. */
export async function matchAllPending(page: Page) {
  // The URL changes while the loading skeleton is still up; count rows only once the form is there.
  await page.getByRole("button", { name: "Confirm medicine" }).waitFor();
  const pending = page.locator("div[data-state=pending]");
  while ((await pending.count()) > 0) {
    await pending.first().getByRole("button", { name: "Matches" }).click();
  }
}

export async function confirmMedicine(page: Page) {
  await page.getByRole("button", { name: "Confirm medicine" }).click();
  await page.waitForURL((url) => !url.pathname.includes("/review"));
}

/** A PNG "photo" of one printed item from the public demo kit. */
export async function kitPhoto(context: BrowserContext, itemId: string) {
  const page = await context.newPage();
  await page.goto("/demo-kit");
  const buffer = await page.locator(`#${itemId} .demo-kit-sheet`).screenshot();
  await page.close();
  return { name: `${itemId}.png`, mimeType: "image/png", buffer };
}

/** Reads the Supabase session that @supabase/ssr keeps in (possibly chunked) cookies. */
async function readSession(context: BrowserContext): Promise<{ accessToken: string; userId: string } | null> {
  const parts = (await context.cookies())
    .filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  if (parts.length === 0) return null;
  const raw = parts.map((c) => c.value).join("");
  const json = raw.startsWith("base64-") ? Buffer.from(raw.slice(7), "base64url").toString("utf8") : raw;
  const session = JSON.parse(json) as { access_token: string; user: { id: string } };
  return { accessToken: session.access_token, userId: session.user.id };
}

/**
 * Deletes everything this test's anonymous user created. With SUPABASE_SECRET_KEY (local runs)
 * the anonymous user itself is deleted, which cascades to all their rows; without it (CI) the
 * user's own patients and label photos are deleted through RLS, leaving an empty anonymous user.
 */
export async function deleteTestData(context: BrowserContext) {
  const session = await readSession(context);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!session || !url || !key) return;

  const secret = process.env.SUPABASE_SECRET_KEY;
  const supabase = secret
    ? createClient(url, secret, { auth: { persistSession: false } })
    : createClient(url, key, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${session.accessToken}` } },
      });

  const photos = await supabase.storage.from("label-photos").list(session.userId, { limit: 1000 });
  const paths = (photos.data ?? []).map((f) => `${session.userId}/${f.name}`);
  if (paths.length > 0) await supabase.storage.from("label-photos").remove(paths);

  if (secret) {
    const { error } = await supabase.auth.admin.deleteUser(session.userId);
    if (error) console.warn(`Could not delete test user ${session.userId}: ${error.message}`);
  } else {
    const { error } = await supabase.from("patients").delete().eq("caregiver_id", session.userId);
    if (error) console.warn(`Could not delete test patients: ${error.message}`);
  }
}
