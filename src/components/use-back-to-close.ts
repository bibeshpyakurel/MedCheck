"use client";

import { useCallback, useEffect, useEffectEvent, useRef } from "react";

let lastId = 0;

/** Whether the current history entry is the one with this key (Next.js keeps it across back/forward). */
export function onHistoryEntry(key: string, id: number): boolean {
  return (window.history.state as Record<string, unknown> | null)?.[key] === id;
}

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
  const entry = useRef<{ id: number; released: boolean } | null>(null);
  const back = useEffectEvent(onBack);

  useEffect(() => {
    if (!open) return;
    const id = ++lastId;
    const onPopState = () => {
      // Back from something stacked on top of this overlay's entry: the overlay stays.
      if (entry.current?.id !== id || onHistoryEntry("medcheckOverlay", id)) return;
      entry.current = null;
      back();
    };
    // Deferred, so a Strict Mode mount → unmount → mount pushes one entry, not two.
    const timer = setTimeout(() => {
      window.history.pushState({ medcheckOverlay: id }, "");
      entry.current = { id, released: false };
      window.addEventListener("popstate", onPopState);
    }, 0);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("popstate", onPopState);
      const pushed = entry.current;
      entry.current = null;
      // Still on the overlay's entry (no navigation happened meanwhile): step back over it.
      if (pushed?.id === id && !pushed.released && onHistoryEntry("medcheckOverlay", id)) window.history.back();
    };
  }, [open]);

  return useCallback(() => {
    if (entry.current) entry.current.released = true;
  }, []);
}
