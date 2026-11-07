import { defineConfig } from 'vitest/config'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))

// تست‌های واحد منطق‌های خالص — بدون دیتابیس و بدون شبکه
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: [
      {
        // ماژول‌های server-only در محیط تست استاب می‌شوند
        find: 'server-only',
        replacement: path.resolve(root, 'tests/stubs/server-only.ts'),
      },
    ],
  },
})
