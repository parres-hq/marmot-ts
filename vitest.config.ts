import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
  esbuild: {
    target: 'node18',
  },
})
