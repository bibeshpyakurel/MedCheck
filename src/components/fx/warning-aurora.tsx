"use client";

import { useEffect, useState } from "react";
import { Aurora } from "@/components/fx/aurora";

const key = (patientId: string) => `medcheck:alert:${patientId}`;

/**
 * The aurora at the top of the Medicines tab: amber while there are warnings, teal otherwise. It
 * starts from what this tab last showed for the record and crossfades to now, so adding a medicine
 * that creates a warning visibly warms the header, and removing it cools it.
 */
export function WarningAurora({ patientId, alert, className }: { patientId: string; alert: boolean; className?: string }) {
  const [state, setState] = useState({ alert: false, instant: true });

  useEffect(() => {
    let previous = false;
    try {
      previous = sessionStorage.getItem(key(patientId)) === "1";
      sessionStorage.setItem(key(patientId), alert ? "1" : "0");
    } catch {
      // Storage blocked: start from teal.
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      setState({ alert: previous, instant: true });
      second = requestAnimationFrame(() => setState({ alert, instant: false }));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [patientId, alert]);

  return <Aurora alert={state.alert} instant={state.instant} className={className} />;
}
