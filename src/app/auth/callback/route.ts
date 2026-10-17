import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { linkErrorTarget, nameFromMetadata } from "@/lib/account";
import { completeSignIn } from "@/lib/auth";
import { deleteGuestData } from "@/lib/records";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Google sign-in and the emailed sign-in link come back to. Swaps the one-time `code` (or an
 * email `token_hash`) for a session, saves the person's name from the account, and opens their capture page.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  // A guest who signs in leaves their guest records behind; delete them while this session can still reach them.
  if (code || tokenHash) await deleteGuestData();
  const supabase = await createClient();
  let failure: { errorCode?: string | null; message?: string | null } | null = null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) failure = { errorCode: error.code, message: error.message };
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) failure = { errorCode: error.code, message: error.message };
  } else {
    failure = { errorCode: params.get("error_code"), message: params.get("error_description") };
  }
  if (failure) redirect(linkErrorTarget(failure));

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(linkErrorTarget({}));
  redirect(await completeSignIn(nameFromMetadata(data.user.user_metadata)));
}
