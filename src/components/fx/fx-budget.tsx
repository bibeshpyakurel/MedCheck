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

  const recompute = useCallback(() => {
    const slots = window.matchMedia("(min-width: 1024px)").matches ? 2 : 1;
    const winners = [...leases.current].sort((a, b) => b[1] - a[1]).slice(0, slots).map(([id]) => id);
    setGranted(new Set(winners));
  }, []);

  const value = useMemo<Budget>(
    () => ({
      granted,
      request: ({ id, priority }) => {
        leases.current.set(id, priority);
        recompute();
      },
      release: (id) => {
        if (leases.current.delete(id)) recompute();
      },
    }),
    [granted, recompute],
  );

  return <FxBudgetContext.Provider value={value}>{children}</FxBudgetContext.Provider>;
}

export function useFxBudget(): Budget | null {
  return useContext(FxBudgetContext);
}
