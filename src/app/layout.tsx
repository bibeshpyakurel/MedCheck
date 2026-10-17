import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "MedCheck", template: "%s · MedCheck" },
  description:
    "See when two medicines share an active ingredient, or when a prescription, discharge list and bottle disagree — then bring a clear question to your pharmacist. Evidence, not advice.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7fafa" },
    { media: "(prefers-color-scheme: dark)", color: "#141b20" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <p role="note" className="border-b bg-secondary px-4 py-1.5 text-center text-xs font-medium text-secondary-foreground">
          Demo — please use synthetic information only
        </p>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
