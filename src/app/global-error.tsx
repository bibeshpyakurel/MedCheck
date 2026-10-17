"use client";

import { Geist } from "next/font/google";
import { ErrorPanel } from "@/components/error-panel";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });

/** Replaces the root layout when the layout itself fails, so it brings its own document and styles. */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <title>Something went wrong · MedCheck</title>
        <ErrorPanel error={error} retry={retry} />
      </body>
    </html>
  );
}
