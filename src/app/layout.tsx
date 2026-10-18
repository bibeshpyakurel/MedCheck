import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import { FxProviders } from "@/components/fx/fx-providers";
import { NavigationTracker } from "@/components/navigation-tracker";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["600", "800"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "MedCheck", template: "%s · MedCheck" },
  description:
    "Photograph your medicines, see what their labels share, and share a simple report. Evidence, not advice.",
  // Installed to the Home Screen: full screen, with a status bar that follows the theme ("black-translucent"
  // would put white text over the light theme's header).
  appleWebApp: { capable: true, statusBarStyle: "default", title: "MedCheck" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the header and bottom bar pad for the notch and home indicator (env(safe-area-inset-*)).
  viewportFit: "cover",
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
      className={`${inter.variable} ${display.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <FxProviders>{children}</FxProviders>
          <Toaster position="top-center" />
          <Suspense fallback={null}>
            <NavigationTracker />
          </Suspense>
        </ThemeProvider>
      </body>
    </html>
  );
}
