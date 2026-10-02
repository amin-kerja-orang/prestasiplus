/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_MODE: 'mock' | 'http'
  readonly VITE_TEST_HOOKS: 'true' | 'false'
  readonly VITE_MOCK_LATENCY_MS: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
