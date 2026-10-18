import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { FAKE_GEMINI_PORT } from "./e2e/fake-gemini-scenarios.mjs";

// Local runs read the Supabase keys from .env.local; CI passes them as environment variables.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  // The e2e tests talk to the real Supabase project; give each step room.
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
  webServer: [
    {
      // A stand-in for Gemini: canned label reads chosen by the photo's width (e2e/fake-gemini-scenarios.mjs).
      command: "node e2e/fake-gemini.mjs",
      url: `http://localhost:${FAKE_GEMINI_PORT}`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: "npm run build && npm start",
      url: `http://localhost:${PORT}`,
      timeout: 300_000,
      reuseExistingServer: !process.env.CI,
      // Gemini is the stand-in above, so photo tests never depend on what a model reads (one model, no fallback).
      // No Resend: the report page offers "Send by email" through the user's own email app.
      env: {
        GOOGLE_GENERATIVE_AI_API_KEY: "e2e-fake-key",
        GOOGLE_GENERATIVE_AI_BASE_URL: `http://localhost:${FAKE_GEMINI_PORT}/v1beta`,
        GEMINI_MODEL: "fake-gemini",
        GEMINI_FALLBACK_MODEL: "none",
        RESEND_API_KEY: "",
      },
    },
  ],
});
