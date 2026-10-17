"use client";

import { useEffect } from "react";

// While set, closing or leaving the page doesn't ask first. Cleared after a while so a flow that
// ends up staying on the site (for example, Google sign-in turned off) is guarded again.
let leaveAllowedUntil = 0;

/**
 * Lets the page unload without the "Leave site?" prompt for the next few seconds. Call it right
 * before a deliberate exit: Sign out, Leave guest session, or the redirect to Google.
 */
export function allowLeave(ms = 15_000): void {
  leaveAllowedUntil = Date.now() + ms;
}

/**
 * For guests only: asks the browser to confirm before the tab is closed or reloaded, because a guest's
 * medicines and report can't be retrieved later. Browsers show their own wording. In-app navigation
 * doesn't unload the page, so it never triggers this. Phone calls, emails and downloads are let through.
 */
export function GuestLeaveGuard({ isGuest }: { isGuest: boolean }) {
  useEffect(() => {
    if (!isGuest) return;

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Date.now() < leaveAllowedUntil) return;
      e.preventDefault();
      e.returnValue = "";
    };
    // tel:, mailto: and download links fire beforeunload in some browsers without leaving the page.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]");
      if (!link) return;
      const href = link.getAttribute("href") ?? "";
      if (/^(tel|mailto|sms):/i.test(href) || link.hasAttribute("download")) allowLeave(2_000);
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [isGuest]);

  return null;
}
