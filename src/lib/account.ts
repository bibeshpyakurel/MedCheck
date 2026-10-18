// Sign-in helpers: where people land, the name they're known by, and plain-English sign-in errors.
// Pure; client-safe.

/** The add-a-medicine page of a person's record. */
export function capturePath(patientId: string): string {
  return `/patients/${patientId}/add`;
}

/** Home for a signed-in person: their Medicines page once anything is on file, otherwise adding the first medicine. */
export function homePathFor(patientId: string, hasMedicines: boolean): string {
  return hasMedicines ? `/patients/${patientId}` : capturePath(patientId);
}

const MAX_NAME = 120;

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** "First Last" from optional parts, or null when both are blank. */
export function fullName(first: unknown, last: unknown): string | null {
  const name = [text(first), text(last)].filter(Boolean).join(" ").slice(0, MAX_NAME);
  return name || null;
}

/** The person's name from sign-in metadata: Google's full_name/name/given+family, or the email form's first/last. */
export function nameFromMetadata(meta: Record<string, unknown> | null | undefined): string | null {
  if (!meta) return null;
  return (
    fullName(meta.full_name, null) ??
    fullName(meta.name, null) ??
    fullName(meta.given_name, meta.family_name) ??
    fullName(meta.first_name, meta.last_name)
  );
}

/** "jamie" for "jamie@example.com". */
export function emailLocalPart(email: string): string {
  return email.split("@")[0];
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** The emailed sign-in code without spaces or dashes, or null unless it is 6–8 digits. */
export function normalizeOtp(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{6,8}$/.test(digits) ? digits : null;
}

export const SIGN_IN_ERRORS = {
  google: "Google sign-in isn't available right now. Use email or continue as a guest.",
  guest: "We couldn't start a guest session. Please try again.",
  email: "Enter a valid email address.",
  rate: "Too many sign-in emails were requested. Wait a few minutes, then try again.",
  address: "We can't send a sign-in email to that address right now. Try another address, or continue as a guest.",
  send: "We couldn't send the sign-in email. Please try again.",
  format: "Enter the code from the email. It's a number with 6 to 8 digits.",
  code: "That code is wrong or has expired. Check the newest email, or send a new code.",
  link: "That sign-in link has expired or was opened in a different browser. Send a new email and try again.",
  verify: "We couldn't sign you in. Please try again.",
} as const;

export type SignInErrorCode = keyof typeof SIGN_IN_ERRORS;

/** The message for an `?error=` code, or null for missing or unknown codes. */
export function signInErrorMessage(code: unknown): string | null {
  return typeof code === "string" && Object.hasOwn(SIGN_IN_ERRORS, code) ? SIGN_IN_ERRORS[code as SignInErrorCode] : null;
}

/** Turns a Supabase auth error from sending or checking a code into an `?error=` code. */
export function authErrorCode(
  error: { code?: string; status?: number; message: string },
  stage: "send" | "verify",
): SignInErrorCode {
  const message = error.message.toLowerCase();
  if (error.status === 429 || error.code?.startsWith("over_") || message.includes("rate limit")) return "rate";
  if (error.code === "email_address_not_authorized" || message.includes("not authorized")) return "address";
  if (error.code === "email_address_invalid") return "email";
  if (error.code === "otp_expired" || message.includes("expired or is invalid")) return "code";
  return stage;
}

/**
 * Where the auth callback sends someone when signing in fails. Email links fail with an expired OTP or a
 * missing PKCE verifier (opened in another browser); anything else came from Google.
 */
export function linkErrorTarget({ errorCode, message }: { errorCode?: string | null; message?: string | null }): string {
  const m = message?.toLowerCase() ?? "";
  if (errorCode?.startsWith("otp") || m.includes("code verifier") || m.includes("flow state")) return "/sign-in?error=link";
  return "/?error=google";
}

/** The site's origin for auth redirects, from the request headers. */
export function requestOrigin(headers: { get(name: string): string | null }): string {
  const origin = headers.get("origin");
  if (origin) return origin;
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
