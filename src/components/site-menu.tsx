"use client";

import { ChevronRightIcon, MenuIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { BrandLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

const ABOUT_LINKS = [
  { href: "/how-it-works", label: "How MedCheck works" },
  { href: "/checks", label: "About the checks" },
  { href: "/why", label: "Why it matters" },
];
const DEMO_LINKS = [{ href: "/demo-kit", label: "Printable demo kit" }];

/** The header's ☰ menu: the explainer pages, kept off the home page so it stays short. */
export function SiteMenu() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<Button variant="ghost" size="icon" className="-ml-2 size-11" />}>
        <MenuIcon aria-hidden className="size-5" />
        <span className="sr-only">Menu</span>
      </SheetTrigger>
      <SheetContent side="left" className="gap-0">
        <SheetHeader className="h-16 justify-center border-b px-4">
          <SheetTitle>
            <BrandLogo />
            <span className="sr-only">Menu</span>
          </SheetTitle>
        </SheetHeader>
        <nav aria-label="Menu" className="flex flex-col gap-4 p-2">
          <MenuGroup links={ABOUT_LINKS} onNavigate={close} />
          <div className="border-t pt-4">
            <MenuGroup links={DEMO_LINKS} onNavigate={close} />
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

// Plain links, not SheetClose: Base UI's Close would give each <a> role="button".
function MenuGroup({ links, onNavigate }: { links: { href: string; label: string }[]; onNavigate: () => void }) {
  return (
    <ul className="flex flex-col">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            onClick={onNavigate}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 text-base font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {link.label}
            <ChevronRightIcon aria-hidden className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
