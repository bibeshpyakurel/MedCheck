"use server";

// Compare with my medicines (spec: compare-with-my-medicines §3): the medicines to pick from, then the
// existing checks over the card's medicine and the picks. Saves nothing. Only this person's own entries
// (RLS, plus the patientId checks here); a photo's draft compares as its matched label (subjectEntry).
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { getFormulation, getFormulationsByIds } from "@/lib/catalog";
import { runChecks } from "@/lib/checks";
import { type CompareSubject, type MedicineSummary, pickOptions, subjectEntry, summarize } from "@/lib/compare-view";
import type { CheckRun, Formulation, MedicationEntry } from "@/lib/domain/schema";
import { getEntry, listEntries } from "@/lib/records";

export type CompareError = { error: string };
export type CompareChoices = { subject: MedicineSummary; options: MedicineSummary[] };
export type CompareResult = { entries: MedicationEntry[]; formulations: Record<string, Formulation>; runs: CheckRun[] };

const NOT_FOUND: CompareError = { error: "This medicine isn't on file for this person any more." };
const subjectSchema = z.object({ entryId: z.guid(), formulationId: z.guid().optional() });
const choicesSchema = z.object({ patientId: z.guid(), subject: subjectSchema });
const compareSchema = choicesSchema.extend({ entryIds: z.array(z.guid()).min(1).max(20) });

const labelIds = (entries: MedicationEntry[]) => [...new Set(entries.flatMap((e) => (e.formulationId ? [e.formulationId] : [])))];

/** The card's medicine as the checks see it, with the person's entries; null when it isn't this person's. */
async function load(patientId: string, subject: CompareSubject) {
  await requireUser();
  const [entry, entries, label] = await Promise.all([
    getEntry(subject.entryId),
    listEntries(patientId),
    subject.formulationId ? getFormulation(subject.formulationId) : null,
  ]);
  if (!entry || entry.patientId !== patientId || (subject.formulationId && !label)) return null;
  return { subject: subjectEntry(entry, label), entries };
}

export async function compareChoicesAction(input: { patientId: string; subject: CompareSubject }): Promise<CompareChoices | CompareError> {
  const parsed = choicesSchema.safeParse(input);
  if (!parsed.success) return NOT_FOUND;
  const loaded = await load(parsed.data.patientId, parsed.data.subject);
  if (!loaded) return NOT_FOUND;
  const formulations = await getFormulationsByIds(labelIds([loaded.subject, ...loaded.entries]));
  const subjectLabel = loaded.subject.formulationId ? formulations[loaded.subject.formulationId] : null;
  return { subject: summarize(loaded.subject, subjectLabel), options: pickOptions(loaded.entries, loaded.subject, formulations) };
}

export async function compareMedicinesAction(input: {
  patientId: string;
  subject: CompareSubject;
  entryIds: string[];
}): Promise<CompareResult | CompareError> {
  const parsed = compareSchema.safeParse(input);
  if (!parsed.success) return { error: "Pick at least one medicine to compare." };
  const loaded = await load(parsed.data.patientId, parsed.data.subject);
  if (!loaded) return NOT_FOUND;
  const subjectId = loaded.subject.id;
  const confirmed = new Map(loaded.entries.filter((e) => e.status === "confirmed" && e.id !== subjectId).map((e) => [e.id, e]));
  const picked = [...new Set(parsed.data.entryIds)].flatMap((id) => confirmed.get(id) ?? []);
  if (picked.length !== new Set(parsed.data.entryIds).size) return { error: "One of those medicines isn't saved and confirmed for this person." };
  const entries = [loaded.subject, ...picked];
  const formulations = await getFormulationsByIds(labelIds(entries));
  return { entries, formulations, runs: runChecks({ entries, formulations }) };
}
