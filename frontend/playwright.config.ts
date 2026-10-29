import { defineConfig, devices } from '@playwright/test'

const isWindows = process.platform === 'win32'
const isCI = !!process.env.CI

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Requires Postgres (podman-compose up -d / docker-compose up -d).
  webServer: [
    {
      command: isWindows
        ? 'mvnw.cmd spring-boot:run -Dspring-boot.run.profiles=local'
        : './mvnw spring-boot:run -Dspring-boot.run.profiles=local',
      cwd: '..',
      url: 'http://localhost:8080/api/health',
      timeout: 180_000,
      reuseExistingServer: !isCI,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5173',
      timeout: 60_000,
      reuseExistingServer: !isCI,
    },
  ],
})
