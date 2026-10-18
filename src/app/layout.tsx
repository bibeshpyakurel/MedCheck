import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter, Inter_Tight } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { NavigationTracker } from "@/components/navigation-tracker";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const interTight = Inter_Tight({ variable: "--font-display", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "MedCheck", template: "%s · MedCheck" },
  description:
    "Photograph your medicines, see what their labels share, and share a simple report. Evidence, not advice.",
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
          {children}
          <Toaster position="top-center" />
          <Suspense fallback={null}>
            <NavigationTracker />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
