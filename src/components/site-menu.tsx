"use client";

import { ChevronRightIcon, MenuIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useState } from "react";
import { AccountControls } from "@/components/account-controls";
import { BrandLogo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Account } from "@/lib/auth";

const ABOUT_LINKS = [
  { href: "/how-it-works", label: "How MedCheck works" },
  { href: "/checks", label: "About the checks" },
  { href: "/why", label: "Why it matters" },
];
const DEMO_LINKS = [{ href: "/demo-kit", label: "Printable demo kit" }];
const THEMES = [
  { value: "system", label: "System", icon: MonitorIcon },
  { value: "light", label: "Light", icon: SunIcon },
  { value: "dark", label: "Dark", icon: MoonIcon },
];

/** The header's ☰ menu: the explainer pages, kept off the home page so it stays short, and the appearance setting. */
export function SiteMenu({ account = null }: { account?: Account | null }) {
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
        <AccountControls account={account} onNavigate={close} />
        <ThemeChoice />
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

// Native radios, so arrow keys move between choices. The drawer only renders once opened (after
// hydration), so the saved theme is already known and there is no server/client mismatch.
function ThemeChoice() {
  const { theme, setTheme } = useTheme();

  return (
    <fieldset className="mt-auto border-t p-4">
      <legend className="sr-only">Appearance</legend>
      <p aria-hidden className="mb-2 text-sm font-medium text-muted-foreground">
        Appearance
      </p>
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
        {THEMES.map((t) => (
          <label
            key={t.value}
            className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:text-foreground has-checked:bg-card has-checked:text-foreground has-checked:shadow-xs has-focus-visible:ring-3 has-focus-visible:ring-ring/50"
          >
            <input
              type="radio"
              name="theme"
              value={t.value}
              checked={theme === t.value}
              onChange={() => setTheme(t.value)}
              className="sr-only"
            />
            <t.icon aria-hidden className="size-4" />
            {t.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
