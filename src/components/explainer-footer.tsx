import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { Account } from "@/lib/auth";

/** Where an explainer page's back link and closing button go: the person's medicines, or the start page when signed out. */
export function explainerHome(account: Account | null): { href: string; label: string } {
  return account?.patientId
    ? { href: `/patients/${account.patientId}`, label: "Back to my medicines" }
    : { href: "/", label: "Go to the start page" };
}

/** The way on from an explainer page (How MedCheck works, Why it matters), so it isn't a dead end. */
export function ExplainerFooter({ account }: { account: Account | null }) {
  const home = explainerHome(account);
  return (
    <div className="mt-8 flex">
      <Button size="lg" className="h-12 w-full px-5 text-base sm:w-auto" nativeButton={false} render={<Link href={home.href} />}>
        {home.label}
      </Button>
    </div>
  );
}
