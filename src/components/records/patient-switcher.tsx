"use client";

import { CheckIcon, ChevronsUpDownIcon, UsersRoundIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Option = { id: string; label: string; isDemo: boolean };

/** Header control for moving between people. Falls back to a plain "People" link for one person. */
export function PatientSwitcher({ patients, currentId }: { patients: Option[]; currentId: string }) {
  if (patients.length < 2) {
    return (
      <Button variant="ghost" className="h-11" nativeButton={false} render={<Link href="/patients" />}>
        <UsersRoundIcon aria-hidden /> People
      </Button>
    );
  }
  const current = patients.find((p) => p.id === currentId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" className="h-11 max-w-48 gap-2 px-3" aria-label="Switch person" />}
      >
        <span className="truncate">{current?.label ?? "Switch person"}</span>
        <ChevronsUpDownIcon aria-hidden className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Switch person</DropdownMenuLabel>
          {patients.map((p) => (
            <DropdownMenuItem key={p.id} className="min-h-11 px-2" render={<Link href={`/patients/${p.id}`} />}>
              <span className="flex-1 truncate">{p.label}</span>
              {p.isDemo ? <span className="text-xs text-muted-foreground">Demo</span> : null}
              {p.id === currentId ? <CheckIcon aria-label="Current" /> : null}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 px-2" render={<Link href="/patients" />}>
          <UsersRoundIcon aria-hidden /> All people
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
