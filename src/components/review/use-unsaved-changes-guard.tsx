"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { goBackTo } from "@/components/back-link";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type Leaving = { kind: "link"; href: string } | { kind: "back" };

const GUARD_STATE = { medcheckUnsaved: true };

/** The in-app page a click is heading to, or null for clicks this guard lets through. */
function inAppTarget(e: MouseEvent): string | null {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
  const link = (e.target as Element | null)?.closest?.("a[href]");
  if (!(link instanceof HTMLAnchorElement) || link.hasAttribute("download")) return null;
  if (link.target && link.target !== "_self") return null;
  const url = new URL(link.href, window.location.href);
  // tel:, mailto: and other sites leave nothing behind; a link to this same page (or a #section) isn't leaving.
  if (url.origin !== window.location.origin) return null;
  if (url.pathname === window.location.pathname && url.search === window.location.search) return null;
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Asks "Discard your changes?" before leaving while `dirty`: in-app links (tabs, the logo, back
 * links, the ☰ menu) are held until the person chooses; browser Back is caught by one extra history
 * entry; refresh and closing the tab get the browser's own prompt. Call `disarm()` before saving, so
 * the save's own navigation goes through, and `rearm()` if the save failed.
 */
export function useUnsavedChangesGuard(dirty: boolean): { dialog: ReactNode; disarm: () => Promise<void>; rearm: () => void } {
  const router = useRouter();
  const [armed, setArmed] = useState(true);
  const [leaving, setLeaving] = useState<Leaving | null>(null);
  // The URL while the guard's history entry is the current one; null when it isn't there.
  const entry = useRef<string | null>(null);
  // The next popstate is the guard stepping back over its own entry, not the person pressing Back.
  const ownPop = useRef(false);
  const leaveFreely = useRef(false);
  const active = dirty && armed;

  const pushEntry = useCallback(() => {
    window.history.pushState(GUARD_STATE, "");
    entry.current = window.location.href;
  }, []);

  /** Steps back over the guard's history entry (if it's still the current one) and waits until that's done. */
  const dropEntry = useCallback(async () => {
    const href = entry.current;
    entry.current = null;
    if (href === null || window.location.href !== href) return;
    ownPop.current = true;
    await new Promise<void>((resolve) => {
      window.addEventListener("popstate", () => resolve(), { once: true });
      window.history.back();
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (leaveFreely.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    // Capture on window, ahead of React (which listens on the document), so the link never navigates.
    const onClick = (e: MouseEvent) => {
      const href = inAppTarget(e);
      if (!href) return;
      e.preventDefault();
      e.stopPropagation();
      setLeaving({ kind: "link", href });
    };
    const onPopState = () => {
      if (ownPop.current) {
        ownPop.current = false;
        return;
      }
      if (entry.current === null) return;
      // Back took the person off the guard's entry onto the review itself: ask before going further.
      entry.current = null;
      setLeaving({ kind: "back" });
    };
    // Deferred, so a Strict Mode mount → unmount → mount pushes one entry, not two.
    const timer = setTimeout(pushEntry, 0);
    window.addEventListener("beforeunload", onBeforeUnload);
    window.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeunload", onBeforeUnload);
      window.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      ownPop.current = false;
      const href = entry.current;
      entry.current = null;
      if (href !== null && window.location.href === href) window.history.back();
    };
  }, [active, pushEntry]);

  async function discard() {
    const target = leaving;
    setLeaving(null);
    leaveFreely.current = true;
    if (target?.kind === "back") {
      // The guard's entry is already gone: this Back goes where the person meant to go.
      window.history.back();
      return;
    }
    await dropEntry();
    setArmed(false);
    if (target && !goBackTo(target.href)) router.push(target.href);
  }

  function keepEditing() {
    if (leaving?.kind === "back") pushEntry();
    setLeaving(null);
  }

  const disarm = useCallback(async () => {
    await dropEntry();
    setArmed(false);
  }, [dropEntry]);
  const rearm = useCallback(() => setArmed(true), []);

  const dialog = (
    <AlertDialog open={leaving !== null} onOpenChange={(open) => (open ? undefined : keepEditing())}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
          <AlertDialogDescription>
            What you chose or typed on this page isn&apos;t saved yet. Use Save for later to keep it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="h-11 px-4">Keep editing</AlertDialogCancel>
          <Button variant="destructive" className="h-11 px-4" onClick={() => void discard()}>
            Discard changes
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { dialog, disarm, rearm };
}
