import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Local runs read the Supabase keys from .env.local; CI passes them as environment variables.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  // The e2e flow talks to the real Supabase project; give each step room.
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile",
      use: { ...devices["Desktop Chrome"], viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: "npm run build && npm start",
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    // No Gemini: photos start with every field unknown and the test types the values, as a user would.
    // Without this a local key would add extra drafts (e.g. the discharge list's second medicine).
    env: { GOOGLE_GENERATIVE_AI_API_KEY: "", RESEND_API_KEY: "" },
  },
});
