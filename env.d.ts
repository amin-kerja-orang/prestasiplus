/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE: 'mock' | 'http'
  readonly VITE_TEST_HOOKS: 'true' | 'false'
  readonly VITE_MOCK_LATENCY_MS: string
  readonly VITE_HASH_HISTORY?: 'true' | 'false'
  /** Prototype scope (TRACKER D43): ON unless `off`. */
  readonly VITE_PROTOTYPE_SCOPE?: 'on' | 'off'
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
