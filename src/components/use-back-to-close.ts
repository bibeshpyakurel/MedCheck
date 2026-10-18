"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";

/**
 * While `open`, an overlay (the ☰ menu, Get help, the medicine card) owns one history entry, so the
 * device Back button closes it instead of leaving the page. The entry has no URL of its own; Next.js
 * copies its router state onto it, so going back to the page underneath is a plain restore.
 *
 * Closing it any other way (×, Escape, a tap outside) steps back over that entry. A link inside the
 * overlay calls the returned `release` first and navigates with `replace`, so the new page takes the
 * entry's place instead of being undone.
 */
export function useBackToClose(open: boolean, onBack: () => void): () => void {
  const entry = useRef<{ href: string; released: boolean } | null>(null);
  const back = useEffectEvent(onBack);

  useEffect(() => {
    if (!open) return;
    const onPopState = () => {
      entry.current = null;
      back();
    };
    // Deferred, so a Strict Mode mount → unmount → mount pushes one entry, not two.
    const timer = setTimeout(() => {
      window.history.pushState({ medcheckOverlay: true }, "");
      entry.current = { href: window.location.href, released: false };
      window.addEventListener("popstate", onPopState, { once: true });
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("popstate", onPopState);
      const pushed = entry.current;
      entry.current = null;
      // Still on the overlay's entry (no navigation happened meanwhile): step back over it.
      if (pushed && !pushed.released && window.location.href === pushed.href) window.history.back();
    };
  }, [open]);

  return useCallback(() => {
    if (entry.current) entry.current.released = true;
  }, []);
}
