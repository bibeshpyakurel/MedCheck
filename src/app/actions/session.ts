"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  authErrorCode,
  fullName,
  isEmail,
  nameFromMetadata,
  normalizeOtp,
  requestOrigin,
} from "@/lib/account";
import { completeSignIn, getCurrentUser, homePath } from "@/lib/auth";
import { deleteGuestData } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

const field = (formData: FormData, key: string, max = 320) => String(formData.get(key) ?? "").trim().slice(0, max);

/** Whether the Google provider is switched on in Supabase Auth (signInWithOAuth builds a URL either way). */
async function googleEnabled(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY! },
      cache: "no-store",
    });
    if (!res.ok) return false;
    const settings = (await res.json()) as { external?: { google?: boolean } };
    return settings.external?.google === true;
  } catch {
    return false;
  }
}

/** "Continue as a guest": an anonymous session with one record named "Guest", then its home (the capture page while it's empty). */
export async function startGuest(): Promise<void> {
  if (!(await getCurrentUser())) {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInAnonymously();
    if (error) redirect("/?error=guest");
  }
  const destination = await homePath();
  revalidatePath("/", "layout");
  redirect(destination);
}

/**
 * "Continue with Google": sends the browser to Google; /auth/callback finishes signing in.
 * A guest's records are deleted in /auth/callback, once Google has signed them in. If Google sign-in is off, the page the
 * button was on (`from`: "/" or "/sign-in") shows a message instead.
 */
export async function startGoogle(formData: FormData): Promise<void> {
  const from = field(formData, "from") === "/sign-in" ? "/sign-in" : "/";
  if (!(await googleEnabled())) redirect(`${from}?error=google`);

  const origin = requestOrigin(await headers());
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) redirect(`${from}?error=google`);
  redirect(data.url);
}

/**
 * "Continue with email", step 1: emails a sign-in code (and a sign-in link) to the address, creating the
 * account if needed. The optional first and last name are kept on the account and carried to step 2.
 * `resend` (from the code page) sends errors back there instead of to the email form.
 */
export async function sendEmailCode(formData: FormData): Promise<void> {
  const email = field(formData, "email").toLowerCase();
  const firstName = field(formData, "first_name", 60);
  const lastName = field(formData, "last_name", 60);
  const resend = formData.get("resend") === "1";

  const params = new URLSearchParams({ email });
  if (firstName) params.set("first_name", firstName);
  if (lastName) params.set("last_name", lastName);
  const back: (error: string) => never = (error) => {
    params.set("error", error);
    redirect(`${resend ? "/sign-in/verify" : "/sign-in"}?${params}`);
  };
  if (!isEmail(email)) back("email");

  // A guest stays signed in (and keeps their records) until the code or link is used, so a failed send loses nothing.
  const origin = requestOrigin(await headers());
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback`,
      data: { first_name: firstName || null, last_name: lastName || null },
    },
  });
  if (error) back(authErrorCode(error, "send"));

  revalidatePath("/", "layout");
  if (resend) params.set("sent", "1");
  redirect(`/sign-in/verify?${params}`);
}

/** "Continue with email", step 2: checks the emailed code, saves the name, and opens the person's home. */
export async function verifyEmailCode(formData: FormData): Promise<void> {
  const email = field(formData, "email").toLowerCase();
  const firstName = field(formData, "first_name", 60);
  const lastName = field(formData, "last_name", 60);
  if (!isEmail(email)) redirect("/sign-in?error=email");

  const params = new URLSearchParams({ email });
  if (firstName) params.set("first_name", firstName);
  if (lastName) params.set("last_name", lastName);
  const back: (error: string) => never = (error) => {
    params.set("error", error);
    redirect(`/sign-in/verify?${params}`);
  };

  const token = normalizeOtp(field(formData, "token", 40));
  if (!token) back("format");

  // Guest records don't carry over to the account; delete them while this session can still reach them.
  await deleteGuestData();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) back(authErrorCode(error, "verify"));
  if (!data.user) back("verify");

  const name = fullName(firstName, lastName) ?? nameFromMetadata(data.user.user_metadata);
  const destination = await completeSignIn(name);
  revalidatePath("/", "layout");
  redirect(destination);
}

/** Signs out and returns to the landing page. A guest's records are deleted first: they can't be retrieved later. */
export async function signOut(): Promise<void> {
  await deleteGuestData();
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
