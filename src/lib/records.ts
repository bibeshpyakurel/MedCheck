import "server-only";

// Data access for caregiver-owned records. Every function runs as the signed-in user, so RLS
// decides what is visible. Features call these instead of querying tables directly.
import {
  entryFieldsSchema,
  type EntryFields,
  type InputMethod,
  type MedicationEntry,
  type SourceDocument,
  type SourceDocumentKind,
} from "@/lib/domain/schema";
import { isSelf } from "@/lib/record-format";
import type { Database, Json } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

type Tables = Database["public"]["Tables"];
type DocumentRow = Tables["source_documents"]["Row"];
type EntryRow = Tables["medication_entries"]["Row"];

export type Caregiver = { id: string; displayName: string | null };
export type Patient = {
  id: string;
  displayName: string;
  relationship: string | null;
  notes: string | null;
  createdAt: string;
};
export type HistoryItem = {
  id: number;
  entity: string;
  entityId: string;
  action: "insert" | "update" | "delete";
  before: unknown;
  after: unknown;
  at: string;
};

export const LABEL_PHOTOS_BUCKET = "label-photos";

// ---------------------------------------------------------------------------
// Caregiver and patients
// ---------------------------------------------------------------------------

export async function getCaregiver(): Promise<Caregiver | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("caregivers").select("id, display_name").maybeSingle();
  if (error) throw error;
  return data ? { id: data.id, displayName: data.display_name } : null;
}

/** Creates the caregiver row for the current user if missing; sets the name when given. */
export async function upsertCaregiver(displayName?: string): Promise<Caregiver> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const id = claims?.claims.sub;
  if (!id) throw new Error("Not signed in");
  const row: Tables["caregivers"]["Insert"] = { id };
  if (displayName !== undefined) row.display_name = displayName;
  const { data, error } = await supabase.from("caregivers").upsert(row).select("id, display_name").single();
  if (error) throw error;
  return { id: data.id, displayName: data.display_name };
}

export async function listPatients(): Promise<Patient[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").select("*").order("created_at");
  if (error) throw error;
  return data.map(rowToPatient);
}

export async function getPatient(id: string): Promise<Patient | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToPatient(data) : null;
}

export async function createPatient(input: {
  displayName: string;
  relationship?: string | null;
  notes?: string | null;
}): Promise<Patient> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      display_name: input.displayName,
      relationship: input.relationship ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToPatient(data);
}

/**
 * The account's own record: one person per account. Returns the "self" patient (or, for older
 * accounts, the first patient), creating a "self" patient named `displayName` when there is none.
 */
export async function ensureSelfPatient(displayName: string): Promise<Patient> {
  const patients = await listPatients();
  const existing = patients.find(isSelf) ?? patients[0];
  return existing ?? (await createPatient({ displayName, relationship: "self" }));
}

export async function deletePatient(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("patients").delete().eq("id", id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Source documents and entries
// ---------------------------------------------------------------------------

export async function createSourceDocument(input: {
  patientId: string;
  kind: SourceDocumentKind;
  photoPath?: string | null;
  transcriptText?: string | null;
  documentDate?: string | null;
  facility?: string | null;
  prescriber?: string | null;
  pharmacy?: string | null;
}): Promise<SourceDocument> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("source_documents")
    .insert({
      patient_id: input.patientId,
      kind: input.kind,
      photo_path: input.photoPath ?? null,
      transcript_text: input.transcriptText ?? null,
      document_date: input.documentDate ?? null,
      facility: input.facility ?? null,
      prescriber: input.prescriber ?? null,
      pharmacy: input.pharmacy ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return rowToDocument(data);
}

export async function updateSourceDocument(
  id: string,
  patch: Partial<Pick<SourceDocument, "kind" | "documentDate" | "facility" | "prescriber" | "pharmacy" | "transcriptText">>,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("source_documents")
    .update({
      kind: patch.kind,
      document_date: patch.documentDate,
      facility: patch.facility,
      prescriber: patch.prescriber,
      pharmacy: patch.pharmacy,
      transcript_text: patch.transcriptText,
    })
    .eq("id", id);
  if (error) throw error;
}

export async function getSourceDocument(id: string): Promise<SourceDocument | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("source_documents").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? rowToDocument(data) : null;
}

export async function createDraftEntry(input: {
  patientId: string;
  sourceDocumentId: string | null;
  formulationId: string | null;
  inputMethod: InputMethod;
  fields: EntryFields;
}): Promise<MedicationEntry> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medication_entries")
    .insert({
      patient_id: input.patientId,
      source_document_id: input.sourceDocumentId,
      formulation_id: input.formulationId,
      input_method: input.inputMethod,
      status: "draft",
      fields: entryFieldsSchema.parse(input.fields) as unknown as Json,
    })
    .select("*, source_documents(*)")
    .single();
  if (error) throw error;
  return rowToEntry(data);
}

export async function updateEntryFields(entryId: string, fields: EntryFields): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("medication_entries")
    .update({ fields: entryFieldsSchema.parse(fields) as unknown as Json })
    .eq("id", entryId);
  if (error) throw error;
}

/** Saves the reviewed fields and marks the entry confirmed. Callers must ensure nothing is `pending`. */
export async function confirmEntry(entryId: string, fields: EntryFields): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("medication_entries")
    .update({
      fields: entryFieldsSchema.parse(fields) as unknown as Json,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", entryId);
  if (error) throw error;
}

/**
 * Confirms a draft in one update: its fields, the catalog label it was matched to (or null) and its
 * status. Only a draft is touched; throws when no draft of the user's has this id. Callers must
 * ensure nothing is `pending`. `input_method` is left as it was.
 */
export async function confirmDraftEntry(entryId: string, fields: EntryFields, formulationId: string | null): Promise<void> {
  const parsed = entryFieldsSchema.parse(fields);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medication_entries")
    .update({
      fields: parsed as unknown as Json,
      formulation_id: formulationId,
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", entryId)
    .eq("status", "draft")
    .select("id");
  if (error) throw error;
  if (data.length === 0) throw new Error("No draft entry to confirm");
}

export async function deleteEntry(entryId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("medication_entries").delete().eq("id", entryId);
  if (error) throw error;
}

export async function getEntry(entryId: string): Promise<MedicationEntry | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("medication_entries")
    .select("*, source_documents(*)")
    .eq("id", entryId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToEntry(data) : null;
}

/** Whether the person has any medicine on file, confirmed or waiting for review. */
export async function hasEntries(patientId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("medication_entries")
    .select("id", { count: "exact", head: true })
    .eq("patient_id", patientId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function listEntries(
  patientId: string,
  opts: { status?: "draft" | "confirmed" } = {},
): Promise<MedicationEntry[]> {
  const supabase = await createClient();
  let query = supabase
    .from("medication_entries")
    .select("*, source_documents(*)")
    .eq("patient_id", patientId)
    .order("created_at");
  if (opts.status) query = query.eq("status", opts.status);
  const { data, error } = await query;
  if (error) throw error;
  return data.map(rowToEntry);
}

export async function listHistory(patientId: string, limit = 100): Promise<HistoryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("history")
    .select("*")
    .eq("patient_id", patientId)
    .order("at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((h) => ({
    id: h.id,
    entity: h.entity,
    entityId: h.entity_id,
    action: h.action as HistoryItem["action"],
    before: h.before,
    after: h.after,
    at: h.at,
  }));
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

/** Uploads a label photo to `<uid>/<uuid>.<ext>` and returns the storage path. */
export async function uploadLabelPhoto(file: Blob, contentType: string): Promise<string> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims.sub;
  if (!uid) throw new Error("Not signed in");
  const ext = contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
  const path = `${uid}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(LABEL_PHOTOS_BUCKET).upload(path, file, { contentType });
  if (error) throw error;
  return path;
}

/** Deletes every label photo under the signed-in user's `<uid>/` folder (used when a guest leaves). */
export async function deleteOwnLabelPhotos(): Promise<void> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims.sub;
  if (!uid) return;
  const bucket = supabase.storage.from(LABEL_PHOTOS_BUCKET);
  for (;;) {
    const { data, error } = await bucket.list(uid, { limit: 100 });
    if (error) throw error;
    if (!data.length) return;
    const { error: removeError } = await bucket.remove(data.map((o) => `${uid}/${o.name}`));
    if (removeError) throw removeError;
  }
}

/**
 * Deletes a guest's (anonymous user's) photos and records; they can't be retrieved later anyway.
 * Does nothing for signed-out visitors or account holders. Doesn't sign out.
 */
export async function deleteGuestData(): Promise<void> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims.is_anonymous !== true) return;
  await deleteOwnLabelPhotos();
  for (const p of await listPatients()) await deletePatient(p.id);
}

/** Short-lived URL for showing a private photo (and its crops) in the browser. */
export async function signedPhotoUrl(path: string, expiresInSeconds = 60 * 30): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(LABEL_PHOTOS_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export async function downloadLabelPhoto(path: string): Promise<Blob> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(LABEL_PHOTOS_BUCKET).download(path);
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Row mapping
// ---------------------------------------------------------------------------

function rowToPatient(row: Tables["patients"]["Row"]): Patient {
  return {
    id: row.id,
    displayName: row.display_name,
    relationship: row.relationship,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function rowToDocument(row: DocumentRow): SourceDocument {
  return {
    id: row.id,
    patientId: row.patient_id,
    kind: row.kind as SourceDocumentKind,
    photoPath: row.photo_path,
    transcriptText: row.transcript_text,
    documentDate: row.document_date,
    facility: row.facility,
    prescriber: row.prescriber,
    pharmacy: row.pharmacy,
    createdAt: row.created_at,
  };
}

function rowToEntry(row: EntryRow & { source_documents: DocumentRow | null }): MedicationEntry {
  return {
    id: row.id,
    patientId: row.patient_id,
    sourceDocument: row.source_documents ? rowToDocument(row.source_documents) : null,
    formulationId: row.formulation_id,
    inputMethod: row.input_method as InputMethod,
    status: row.status as MedicationEntry["status"],
    fields: entryFieldsSchema.parse(row.fields),
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
  };
}
