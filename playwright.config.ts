import { defineConfig } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3001";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  use: { baseURL, trace: "retain-on-failure" },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev -- --port 3001",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120000,
      },
  projects: [
    {
      name: "desktop",
      use: { browserName: "chromium", viewport: { width: 1440, height: 1100 } },
    },
    {
      name: "mobile",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
