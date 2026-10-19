/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE: 'mock' | 'http'
  readonly VITE_TEST_HOOKS: 'true' | 'false'
  readonly VITE_MOCK_LATENCY_MS: string
  readonly VITE_HASH_HISTORY?: 'true' | 'false'
  /** Prototype scope (TRACKER D43): ON unless `off`. */
  readonly VITE_PROTOTYPE_SCOPE?: 'on' | 'off'
  /** Virtual dataset size (D45): `poc` = small, `full` = observed live totals. See `src/mock/dataset/data-profile.ts`. */
  readonly VITE_DATA_PROFILE?: 'full' | 'poc'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
