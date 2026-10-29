import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Playwright specs under e2e/ run via `npm run test:e2e`, not vitest.
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
