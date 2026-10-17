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

/**
 * "Change person", always labelled the same: the current person's name sits beside it in the record
 * header. One person: a link to the People screen (where people are added); more: a menu.
 */
export function PatientSwitcher({ patients, currentId }: { patients: Option[]; currentId: string }) {
  if (patients.length < 2) {
    return (
      <Button variant="outline" className="h-11 shrink-0 px-3.5" nativeButton={false} render={<Link href="/patients" />}>
        <UsersRoundIcon aria-hidden /> Change person
      </Button>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" className="h-11 shrink-0 gap-2 pr-2.5 pl-3.5" />}>
        <UsersRoundIcon aria-hidden /> Change person
        <ChevronsUpDownIcon aria-hidden className="text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Whose medicines?</DropdownMenuLabel>
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
          <UsersRoundIcon aria-hidden /> Everyone, or add a person
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
