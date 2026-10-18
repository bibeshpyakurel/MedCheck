// What the report's Share button does on this device. Pure; client-safe.

export type ShareMode = "share" | "download-and-email" | "hidden";

/**
 * Phones share the PDF file with the share sheet. Elsewhere Share can only download the PDF and open a
 * prefilled email, so it says so ("Download and email") — or is hidden when "Send by email" already does
 * exactly that (MedCheck can't send email itself). `canShareFiles` is null until the browser is known.
 */
export function shareMode({ canShareFiles, emailConfigured }: { canShareFiles: boolean | null; emailConfigured: boolean }): ShareMode {
  if (canShareFiles !== false) return "share";
  return emailConfigured ? "download-and-email" : "hidden";
}
