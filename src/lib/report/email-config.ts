import "server-only";

export const EMAIL_DAILY_LIMIT = 5;

/** Email sending needs both a Resend key and a verified sender address. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}
