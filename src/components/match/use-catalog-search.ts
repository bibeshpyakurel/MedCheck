"use client";

import { useEffect, useRef, useState } from "react";
import type { MatchOption } from "@/lib/photo-flow";

const SEARCH_DELAY_MS = 300;

type SearchState = { status: "idle" | "searching" | "done" | "error"; results: MatchOption[]; searched: string };

/** Debounced `GET /api/catalog/search` ("Type it in"); a newer query cancels the one in flight. */
export function useCatalogSearch(initialQuery: string) {
  const [query, setQuery] = useState(initialQuery);
  const [state, setState] = useState<SearchState>({ status: "idle", results: [], searched: "" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      inFlight.current?.abort();
    },
    [],
  );

  async function run(raw: string) {
    if (timer.current) clearTimeout(timer.current);
    inFlight.current?.abort();
    const q = raw.trim();
    if (q.length < 2) {
      setState({ status: "idle", results: [], searched: "" });
      return;
    }
    const controller = new AbortController();
    inFlight.current = controller;
    setState((s) => ({ ...s, status: "searching" }));
    try {
      const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      const { options } = (await response.json()) as { options: MatchOption[] };
      setState({ status: "done", results: options, searched: q });
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error(error);
        setState({ status: "error", results: [], searched: q });
      }
    }
  }

  function change(value: string) {
    setQuery(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(value), SEARCH_DELAY_MS);
  }

  return { query, change, run: (q: string) => void run(q), ...state };
}
