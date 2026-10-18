"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type Lease = { id: string; priority: number };

type Budget = {
  /** Ids currently allowed to run a live scene. */
  granted: ReadonlySet<string>;
  request: (lease: Lease) => void;
  release: (id: string) => void;
};

const FxBudgetContext = createContext<Budget | null>(null);

/**
 * At most one live WebGL scene at a time on a phone (two on a wide screen): each scene slot asks for a
 * lease, the highest priorities win, and the rest keep showing their poster.
 */
export function FxBudgetProvider({ children }: { children: ReactNode }) {
  const leases = useRef(new Map<string, number>());
  const [granted, setGranted] = useState<ReadonlySet<string>>(new Set());

  // Stable callbacks, and no state change when the winners are the same: slots re-request whenever
  // these change, so anything else would loop.
  const recompute = useCallback(() => {
    const slots = window.matchMedia("(min-width: 1024px)").matches ? 2 : 1;
    const winners = [...leases.current].sort((a, b) => b[1] - a[1]).slice(0, slots).map(([id]) => id);
    setGranted((current) => (winners.length === current.size && winners.every((id) => current.has(id)) ? current : new Set(winners)));
  }, []);
  const request = useCallback(
    ({ id, priority }: Lease) => {
      leases.current.set(id, priority);
      recompute();
    },
    [recompute],
  );
  const release = useCallback(
    (id: string) => {
      if (leases.current.delete(id)) recompute();
    },
    [recompute],
  );
  const value = useMemo<Budget>(() => ({ granted, request, release }), [granted, request, release]);

  return <FxBudgetContext.Provider value={value}>{children}</FxBudgetContext.Provider>;
}

export function useFxBudget(): Budget | null {
  return useContext(FxBudgetContext);
}
