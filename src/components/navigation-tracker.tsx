"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { recordVisit } from "@/lib/nav-history";

/** Remembers each MedCheck URL visited in this tab, for back links (see BackLink). Renders nothing. */
export function NavigationTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    recordVisit(search ? `${pathname}?${search}` : pathname);
  }, [pathname, search]);
  return null;
}
