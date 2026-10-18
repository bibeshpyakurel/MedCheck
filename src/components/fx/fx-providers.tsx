"use client";

import type { ReactNode } from "react";
import { FxBudgetProvider } from "@/components/fx/fx-budget";

/** Scenes share one FX budget. (Motion's reduced-motion setting lives with the one component that uses it, OverlapVenn.) */
export function FxProviders({ children }: { children: ReactNode }) {
  return <FxBudgetProvider>{children}</FxBudgetProvider>;
}
