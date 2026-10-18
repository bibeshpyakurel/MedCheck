"use client";

import { MotionConfig } from "motion/react";
import type { ReactNode } from "react";
import { FxBudgetProvider } from "@/components/fx/fx-budget";

/** Motion follows the device's reduced-motion setting; scenes share one FX budget. */
export function FxProviders({ children }: { children: ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <FxBudgetProvider>{children}</FxBudgetProvider>
    </MotionConfig>
  );
}
