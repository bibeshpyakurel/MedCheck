import "server-only";

import { redirect } from "next/navigation";
import { capturePath, emailLocalPart } from "@/lib/account";
import { ensureSelfPatient, getCaregiver, upsertCaregiver } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = { id: string; isAnonymous: boolean; email: string | null };

/** What the ☰ menu shows about who is signed in. */
export type Account = { isGuest: true } | { isGuest: false; label: string };

/** The signed-in (possibly anonymous, i.e. guest) user, or null. Verifies the JWT. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return {
    id: claims.sub,
    isAnonymous: claims.is_anonymous === true,
    email: typeof claims.email === "string" && claims.email ? claims.email : null,
  };
}

/** Like getCurrentUser, but sends visitors without a session to the landing page. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  return user;
}

/** The signed-in account for the page chrome, or null when signed out. */
export async function getAccount(): Promise<Account | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  if (user.isAnonymous) return { isGuest: true };
  const caregiver = await getCaregiver();
  return { isGuest: false, label: caregiver?.displayName || user.email || "your account" };
}

/**
 * The signed-in person's capture page (add a medicine to their own record), creating their record
 * if it is missing. Signed-out visitors go to the landing page.
 */
export async function homePath(): Promise<string> {
  const user = await requireUser();
  const caregiver = (await getCaregiver()) ?? (await upsertCaregiver());
  const fallbackName = user.isAnonymous
    ? "Guest"
    : caregiver?.displayName || (user.email ? emailLocalPart(user.email) : "Me");
  const self = await ensureSelfPatient(fallbackName);
  return capturePath(self.id);
}

/**
 * Finishes signing in with an account (Google or email): saves the person's name when one is known
 * (it shows on the pharmacist report), makes sure they have their own record, and returns its capture page.
 */
export async function completeSignIn(name: string | null): Promise<string> {
  await requireUser();
  if (name) await upsertCaregiver(name);
  return homePath();
}
