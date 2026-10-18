"use client";

// Quick View | Original FDA label. Controlled, so Quick View's "See inactive ingredients" can switch tabs.
import { createContext, type ReactNode, useContext, useRef, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type CardTab = "quick" | "original";

const ShowOriginal = createContext<(() => void) | null>(null);

export function MedicineCardTabs({ quick, original, defaultTab = "quick" }: { quick: ReactNode; original: ReactNode; defaultTab?: CardTab }) {
  const [tab, setTab] = useState<CardTab>(defaultTab);
  const listRef = useRef<HTMLDivElement>(null);
  const showOriginal = () => {
    setTab("original");
    listRef.current?.scrollIntoView({ block: "start" });
  };
  return (
    <ShowOriginal.Provider value={showOriginal}>
      <Tabs value={tab} onValueChange={(value) => setTab(value as CardTab)} className="gap-5">
        <div ref={listRef} className="scroll-mt-4">
          <TabsList className="grid w-full grid-cols-2 rounded-xl p-1 group-data-horizontal/tabs:h-12">
            <TabsTrigger value="quick" className="rounded-lg text-[0.9375rem]">
              Quick View
            </TabsTrigger>
            <TabsTrigger value="original" className="rounded-lg text-[0.9375rem]">
              Original FDA label
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="quick" className="text-base">
          {quick}
        </TabsContent>
        <TabsContent value="original" className="text-base">
          {original}
        </TabsContent>
      </Tabs>
    </ShowOriginal.Provider>
  );
}

/** Switches the card to the Original FDA label tab. Renders nothing outside a card. */
export function ShowOriginalButton({ children }: { children: ReactNode }) {
  const show = useContext(ShowOriginal);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={show}
      className="inline-flex min-h-11 items-center text-left text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </button>
  );
}
