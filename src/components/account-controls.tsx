"use client";

import { LogOutIcon, UserRoundIcon } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/actions/session";
import { allowLeave } from "@/components/guest-leave-guard";
import { ConfirmAction } from "@/components/records/confirm-action";
import { SubmitButton } from "@/components/records/submit-button";
import type { Account } from "@/lib/auth";

async function leave(): Promise<void> {
  allowLeave();
  await signOut();
}

/** The ☰ menu's account section: who is signed in and the way out. Guests are warned their records will be lost. */
export function AccountControls({ account, onNavigate }: { account: Account | null; onNavigate?: () => void }) {
  if (!account) return null;

  if (account.isGuest) {
    return (
      <section aria-label="Account" className="space-y-3 border-t p-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <UserRoundIcon aria-hidden className="size-4 shrink-0" />
          You&apos;re using MedCheck as a guest
        </p>
        <div className="grid gap-2">
          <ConfirmAction
            action={leave}
            className="h-11 w-full"
            title="Leave without saving?"
            description="You're using MedCheck as a guest. If you leave, your medicines and report can't be retrieved later."
            confirmLabel="Leave and delete"
            pendingLabel="Leaving…"
          >
            <LogOutIcon aria-hidden /> Leave guest session
          </ConfirmAction>
          <Link
            href="/sign-in"
            replace
            onClick={onNavigate}
            className="flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Create an account
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Account" className="space-y-3 border-t p-4">
      <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
        <UserRoundIcon aria-hidden className="size-4 shrink-0" />
        <span className="truncate">
          Signed in as <span className="font-medium text-foreground">{account.label}</span>
        </span>
      </p>
      <form action={leave}>
        <SubmitButton variant="outline" className="h-11 w-full" pendingLabel="Signing out…">
          <LogOutIcon aria-hidden /> Sign out
        </SubmitButton>
      </form>
    </section>
  );
}
