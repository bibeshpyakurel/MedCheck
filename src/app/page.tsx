import { MailIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { startGuest } from "@/app/actions/session";
import { GoogleButton } from "@/app/sign-in/google-button";
import { AppShell } from "@/components/app-shell";
import { SubmitButton } from "@/components/records/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { signInErrorMessage } from "@/lib/account";
import { getCurrentUser, homePath } from "@/lib/auth";

// One screen, no scrolling: the job in a line, then the three ways in. The explainers live in the ☰ menu.
// Anyone already signed in (guests too) goes straight home — their medicines, or adding the first one — like opening an app they use.
export default async function Home({ searchParams }: PageProps<"/">) {
  const { error, code } = await searchParams;
  // Supabase falls back to the site root when a redirect URL isn't on its allow list; finish signing in anyway.
  if (typeof code === "string") redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  if (await getCurrentUser()) redirect(await homePath());
  const message = error === "google" || error === "guest" ? signInErrorMessage(error) : null;

  return (
    <AppShell bleed>
      <section className="relative isolate overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)]"
        />
        <div
          aria-hidden
          className="absolute -top-48 left-1/2 -z-10 h-[34rem] w-[60rem] -translate-x-1/2 rounded-full bg-brand/14 blur-3xl"
        />
        <div className="mx-auto w-full max-w-md px-4 pt-8 pb-8 sm:px-6 sm:pt-16 animate-fade-up">
          <h1 className="font-display text-[2rem] leading-[1.1] font-semibold tracking-[-0.03em] text-balance sm:text-5xl">
            Compare your medicine labels.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground text-pretty sm:text-lg">
            Photograph a medicine, check what it contains, and share a simple report.
          </p>

          {message ? (
            <Alert variant="destructive" className="mt-5">
              <AlertDescription>{message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-6 flex flex-col gap-3">
            <GoogleButton from="/" />
            <Button size="lg" className="h-12 w-full px-6 text-base" nativeButton={false} render={<Link href="/sign-in" />}>
              <MailIcon aria-hidden /> Continue with email
            </Button>
            <form action={startGuest}>
              {/* A real third door, not a footnote: tinted outline so it reads as a choice next to the other two. */}
              <SubmitButton
                variant="outline"
                size="lg"
                className="h-12 w-full border-primary/50 bg-primary/8 px-6 text-base font-semibold text-primary hover:border-primary hover:bg-primary/14 hover:text-primary dark:border-primary/60 dark:bg-primary/15 dark:hover:bg-primary/25"
                pendingLabel="Starting…"
              >
                <UserRoundIcon aria-hidden /> Continue as a guest
              </SubmitButton>
            </form>
            <p className="text-center text-sm text-muted-foreground">As a guest, nothing is kept after you leave.</p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
