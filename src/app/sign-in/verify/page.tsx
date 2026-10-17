import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { sendEmailCode, verifyEmailCode } from "@/app/actions/session";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/records/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isEmail, signInErrorMessage } from "@/lib/account";
import { getCurrentUser, homePath } from "@/lib/auth";

export const metadata: Metadata = { title: "Enter your code" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** "Continue with email", step 2: the code from the email (or the email's sign-in link, which skips this page). */
export default async function VerifyPage({ searchParams }: PageProps<"/sign-in/verify">) {
  const user = await getCurrentUser();
  if (user && !user.isAnonymous) redirect(await homePath());
  const params = await searchParams;
  const email = one(params.email);
  if (!isEmail(email)) redirect("/sign-in");
  const message = signInErrorMessage(one(params.error));
  const names = { first_name: one(params.first_name), last_name: one(params.last_name) };
  const codeError = message !== null;

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <PageHeader
          back={{ href: "/sign-in", label: "Back" }}
          title="Check your email"
          description={
            <>
              We sent a sign-in email to <span className="font-medium break-all text-foreground">{email}</span>.
            </>
          }
        />
        <p className="mt-3 text-muted-foreground text-pretty">Enter the code from the email, or just tap the sign-in link in it.</p>

        {params.sent === "1" && !codeError ? (
          <Alert className="mt-6">
            <AlertDescription>We sent a new email. Use the newest one.</AlertDescription>
          </Alert>
        ) : null}

        <form action={verifyEmailCode} className="mt-6 space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <input type="hidden" name="email" value={email} />
          <input type="hidden" name="first_name" value={names.first_name} />
          <input type="hidden" name="last_name" value={names.last_name} />
          <div className="space-y-2">
            <Label htmlFor="token" className="text-base">
              Code
            </Label>
            <Input
              id="token"
              name="token"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              autoFocus
              aria-invalid={codeError || undefined}
              aria-describedby={codeError ? "token-error" : undefined}
              className="h-12 text-center font-mono text-xl tracking-[0.3em] nums"
            />
            {codeError ? (
              <p id="token-error" role="alert" className="text-sm text-destructive">
                {message}
              </p>
            ) : null}
          </div>
          <SubmitButton size="lg" className="h-12 w-full text-base" pendingLabel="Checking…">
            Sign in
          </SubmitButton>
        </form>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <form action={sendEmailCode}>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="first_name" value={names.first_name} />
            <input type="hidden" name="last_name" value={names.last_name} />
            <input type="hidden" name="resend" value="1" />
            <SubmitButton variant="link" className="h-11 px-0 text-sm" pendingLabel="Sending…">
              Resend code
            </SubmitButton>
          </form>
          <Link
            href="/sign-in"
            className="inline-flex min-h-11 items-center text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Use a different email
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
