"use client";

import { ArrowLeftIcon, XIcon } from "lucide-react";
import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";
import { isBackTo, previousUrl } from "@/lib/nav-history";
import { cn } from "@/lib/utils";

type NavigationApi = { currentEntry: { index: number } | null; entries(): { url: string | null }[] };

/**
 * The page before this one in the tab's history. The Navigation API knows it exactly (and lists only
 * MedCheck's own entries); elsewhere the last page MedCheck saw stands in, trusted only for an exact match.
 */
function previousEntry(): { url: string | null; exact: boolean } {
  const nav = (window as { navigation?: NavigationApi }).navigation;
  if (nav?.currentEntry && typeof nav.entries === "function") {
    const index = nav.currentEntry.index;
    return { url: index > 0 ? (nav.entries()[index - 1]?.url ?? null) : null, exact: true };
  }
  return { url: previousUrl(), exact: false };
}

/**
 * Goes back in history instead of opening `href` fresh, when Back lands on `href` (or, with
 * `toPrevious`, on any MedCheck page). Returns whether it did; the caller navigates otherwise.
 */
export function goBackTo(href: string, { toPrevious = false } = {}): boolean {
  const previous = previousEntry();
  const ok = toPrevious ? previous.exact && previous.url !== null : isBackTo(previous.url, href);
  if (ok) window.history.back();
  return ok;
}

/**
 * "← Back" link used above page titles. Large enough to tap. When the page it names is the one before
 * this in history, it goes back (that page keeps its scroll position, and browser Back stays sensible);
 * otherwise it opens `href`. `toPrevious`: go back to whatever MedCheck page came before (sign-in and the
 * explainer pages, which are opened from anywhere), with `href` for a direct visit. `icon="close"`
 * draws an × (the add flow's Cancel).
 */
export function BackLink({
  href,
  toPrevious = false,
  icon = "back",
  children,
  className,
}: {
  href: string;
  toPrevious?: boolean;
  icon?: "back" | "close";
  children: ReactNode;
  className?: string;
}) {
  const Icon = icon === "close" ? XIcon : ArrowLeftIcon;
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    if (goBackTo(href, { toPrevious })) e.preventDefault();
  }

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "group -ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        className,
      )}
    >
      <span className="grid size-6 place-items-center rounded-md border bg-card shadow-xs transition-transform group-hover:-translate-x-0.5">
        <Icon aria-hidden className="size-3.5" />
      </span>
      {children}
    </Link>
  );
}
