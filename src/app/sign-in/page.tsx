import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { sendEmailCode } from "@/app/actions/session";
import { GoogleButton } from "@/app/sign-in/google-button";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/records/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInErrorMessage } from "@/lib/account";
import { getCurrentUser, homePath } from "@/lib/auth";

export const metadata: Metadata = { title: "Continue with email" };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

/** "Continue with email", step 1: the address to send a sign-in code to, and an optional name for the report. */
export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const user = await getCurrentUser();
  if (user && !user.isAnonymous) redirect(await homePath());
  const params = await searchParams;
  const error = one(params.error);
  const message = signInErrorMessage(error);
  const emailError = error === "email";

  return (
    <AppShell>
      <div className="mx-auto max-w-md">
        <PageHeader
          back={{ href: "/", label: "Back" }}
          title="Continue with email"
          description="We'll email you a sign-in code. No password needed."
        />

        {user?.isAnonymous ? (
          <Alert className="mt-6">
            <InfoIcon aria-hidden />
            <AlertDescription>
              You&apos;re using MedCheck as a guest. Signing in starts a new account; what you added as a guest
              won&apos;t carry over and can&apos;t be retrieved later.
            </AlertDescription>
          </Alert>
        ) : null}

        {message && !emailError ? (
          <Alert variant="destructive" className="mt-6">
            <AlertDescription>{message}</AlertDescription>
          </Alert>
        ) : null}

        <form action={sendEmailCode} className="mt-6 space-y-5 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-base">
              Email
            </Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              maxLength={320}
              autoComplete="email"
              inputMode="email"
              autoFocus
              defaultValue={one(params.email)}
              aria-invalid={emailError || undefined}
              aria-describedby={emailError ? "email-error" : undefined}
              className="h-11 text-base"
            />
            {emailError ? (
              <p id="email-error" role="alert" className="text-sm text-destructive">
                {message}
              </p>
            ) : null}
          </div>
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-3">
            <div className="space-y-2">
              <Label htmlFor="first_name" className="text-base">
                First name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="first_name"
                name="first_name"
                maxLength={60}
                autoComplete="given-name"
                defaultValue={one(params.first_name)}
                className="h-11 text-base"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name" className="text-base">
                Last name <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="last_name"
                name="last_name"
                maxLength={60}
                autoComplete="family-name"
                defaultValue={one(params.last_name)}
                className="h-11 text-base"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Your name appears on your medicine report.</p>
          <SubmitButton size="lg" className="h-12 w-full text-base" pendingLabel="Sending…">
            Email me a code
          </SubmitButton>
        </form>

        <div className="mt-6 space-y-3">
          <p className="text-center text-sm text-muted-foreground">or</p>
          <GoogleButton from="/sign-in" />
        </div>
      </div>
    </AppShell>
  );
}
