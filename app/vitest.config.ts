import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    clearMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/features/auth/**/*.tsx', 'src/hooks/**/*.ts'],
      exclude: ['**/*.test.*', 'src/lib/demo.ts', 'src/lib/utils.ts'],
    },
  },
})
