"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** The browser's IANA time zone (null during server render), so the PDF shows the user's local time. */
export function useTimeZone(): string | null {
  return useSyncExternalStore(
    noop,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}
