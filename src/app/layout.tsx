import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import { FlaskConicalIcon } from "lucide-react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const interTight = Inter_Tight({ variable: "--font-display", subsets: ["latin"], display: "swap" });
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
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1218" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: next-themes sets the theme class on <html> before React hydrates.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${interTight.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <p
            role="note"
            className="flex items-center justify-center gap-2 bg-ink px-4 py-1.5 text-center text-xs font-medium text-ink-foreground/85"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-ink-foreground/10 px-2 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-ink-foreground uppercase ring-1 ring-ink-foreground/15">
              <FlaskConicalIcon aria-hidden className="size-3" />
              Demo
            </span>
            Use made-up information only
          </p>
          {children}
          <Toaster position="top-center" />
        </ThemeProvider>
      </body>
    </html>
  );
}
