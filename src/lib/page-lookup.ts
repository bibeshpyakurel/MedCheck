import "server-only";

// A record page's person and entry, read once per request: the page and its generateMetadata share
// the read, so a page that isn't found is titled "Page not found" rather than with its usual title.
import type { Metadata } from "next";
import { cache } from "react";
import { getEntry, getPatient } from "@/lib/records";
import { isUuid } from "@/lib/uuid";

export const NOT_FOUND_TITLE = "Page not found";

/** The person, or null when the id is malformed or not theirs to see. */
export const findPatient = cache(async (patientId: string) => (isUuid(patientId) ? getPatient(patientId) : null));

/** The entry, or null when the id is malformed or not theirs to see. */
export const findEntry = cache(async (entryId: string) => (isUuid(entryId) ? getEntry(entryId) : null));

/** `title` for a person's page that exists, "Page not found" otherwise. */
export async function patientMetadata(params: Promise<{ patientId: string }>, title: string): Promise<Metadata> {
  const { patientId } = await params;
  return { title: (await findPatient(patientId)) ? title : NOT_FOUND_TITLE };
}

/** `title` for an entry's page that exists (and belongs to that person), "Page not found" otherwise. */
export async function entryMetadata(params: Promise<{ patientId: string; entryId: string }>, title: string): Promise<Metadata> {
  const { patientId, entryId } = await params;
  const [patient, entry] = await Promise.all([findPatient(patientId), findEntry(entryId)]);
  return { title: patient && entry?.patientId === patient.id ? title : NOT_FOUND_TITLE };
}
