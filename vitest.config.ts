import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    poolOptions: {
      forks: {
        execArgv: ['--import', 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("./loader.mjs", pathToFileURL("./"));']
      }
    }
  },
  esbuild: {
    target: 'node18',
  },
})
