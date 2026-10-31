import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

const pk = (n: string) => fileURLToPath(new URL(`../../packages/${n}`, import.meta.url))
export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: [
        { find: /^@pp\/contract\/openapi\.json$/, replacement: `${pk('contract')}/openapi.json` },
        { find: /^@pp\/contract$/, replacement: `${pk('contract')}/src/index.ts` },
        { find: /^@pp\/contract-tests$/, replacement: `${pk('contract-tests')}/src/index.ts` },
        { find: /^@pp\/exam-core$/, replacement: `${pk('exam-core')}/src/index.ts` },
        { find: /^@pp\/exam-core\/(.+)$/, replacement: `${pk('exam-core')}/src/$1.ts` },
      ],
    },
  }),
)
