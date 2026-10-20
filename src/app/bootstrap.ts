/**
 * App bootstrap (overview §3 rule 4, §6.13 "Wiring as built", §11).
 *
 * The only UI-side file that decides the transport and the only one allowed to import `@/mock`,
 * always through a dynamic string-literal `import('@/mock')` behind the static
 * `VITE_API_MODE` check, so the `http` build tree-shakes the whole mock.
 *
 * Order:
 * 1. mock mode: `startMock({ persistence, init: window.__MOCK_INIT__ })` resolves first (in dev
 *    and e2e builds it installs `window.__mock` and applies `__MOCK_INIT__.session`, which writes
 *    `pp.auth`); http mode: the fetch transport;
 * 2. `installTransport(withSessionSliding(transport))` (BR-06 client sliding);
 * 3. Pinia, then `useSessionStore()` once (restores `pp.auth`, wires the token and 401 hook);
 * 4. the router from the module registry, then the 401 redirect to `/login`;
 * 5. mount.
 */

import ui from '@nuxt/ui/vue-plugin'
import { createPinia } from 'pinia'
import { createApp, type App as VueApp } from 'vue'
import type { Router, RouterHistory } from 'vue-router'

import { createHttpTransport, installTransport, isHttpMode, type Transport } from '@/api'
import type { BootMockOptions, MockRuntime } from '@/mock'
import { useSessionStore, withSessionSliding } from '@/stores'
import { restoreHttpSession, storedCsrfToken } from '@/stores/http-session'
import { readStoredSession } from '@/stores/session'
import { uiLocale, uiLocaleKey } from '@/theme/locale-ms'

import App from '../App.vue'
import { showBootError } from './boot-error'
import { connectUnauthorizedRedirect, createAppRouter } from './router'

export interface BootstrapOptions {
  /** Mount target. Default `'#app'`. */
  el?: string | Element
  /** Router history. Default `createWebHistory()` (tests pass a memory history). */
  history?: RouterHistory
  /** Extra mock boot options (tests); `persistence` and `init` default as documented. */
  mock?: Partial<BootMockOptions>
}

export interface BootstrappedApp {
  app: VueApp
  router: Router
  /** The mock runtime in `mock` mode, `null` in `http` mode. */
  mockRuntime: MockRuntime | null
}

async function startMockRuntime(
  mockOptions: Partial<BootMockOptions> | undefined,
): Promise<MockRuntime> {
  const { startMock, createMockPersistence } = await import('@/mock')
  return startMock({
    persistence: createMockPersistence(),
    init: window.__MOCK_INIT__ ?? null,
    ...mockOptions,
  })
}

/**
 * Published demo builds (`demo` mode, no test init) mount first and boot the mock in the
 * background: the transport below holds every request until the mock is ready, so behaviour is
 * identical but the login screen no longer waits for the whole mock registry. Dev, e2e and unit
 * runs keep the original "mock first" order (they read `window.__mock` / `mockRuntime`).
 */
function shouldDeferMock(mockOptions: Partial<BootMockOptions> | undefined): boolean {
  return (
    import.meta.env.MODE === 'demo' &&
    mockOptions === undefined &&
    typeof window !== 'undefined' &&
    window.__MOCK_INIT__ === undefined
  )
}

async function createTransport(
  mockOptions: Partial<BootMockOptions> | undefined,
): Promise<{
  transport: Transport
  mockRuntime: MockRuntime | null
  /** Deferred demo boot only: resolves when the mock (and so the mock clock) is ready. */
  mockReady: Promise<unknown> | null
}> {
  if (isHttpMode()) {
    // Cookie session (V2-T31): cookies always sent, the stored CSRF token goes on every write, and
    // the mock-era bearer header is dropped. `withSessionSliding` still sees the bearer on the way in.
    const transport = createHttpTransport({
      credentials: 'include',
      csrfToken: storedCsrfToken,
      sendAuthorization: false,
    })
    return { transport, mockRuntime: null, mockReady: null }
  }
  if (shouldDeferMock(mockOptions)) {
    const ready = startMockRuntime(mockOptions)
    // Log a boot failure once; each request then rejects through the same promise.
    ready.catch((e: unknown) => {
      console.error('Mock boot failed', e)
      showBootError()
    })
    const transport: Transport = {
      request: async (req, signal) => (await ready).transport.request(req, signal),
    }
    return { transport, mockRuntime: null, mockReady: ready }
  }
  const runtime = await startMockRuntime(mockOptions)
  return { transport: runtime.transport, mockRuntime: runtime, mockReady: null }
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrappedApp> {
  const { transport, mockRuntime, mockReady } = await createTransport(options.mock)
  installTransport(withSessionSliding(transport))
  // A stored session is judged by the shared clock. In the deferred demo boot that clock is still
  // the real one (the mock clock is anchored in the past and restored only when the mock is ready),
  // so every stored session would look expired and a reload would log the user out. Wait for the
  // mock first, only when a session is stored; guests keep the fast login screen.
  if (mockReady && readStoredSession() !== null) await mockReady.catch(() => undefined)

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  useSessionStore()
  // T7: in http mode the cookie, not localStorage, is the source of truth for who is signed in.
  if (isHttpMode()) await restoreHttpSession()

  const router = createAppRouter(options.history ? { history: options.history } : {})
  connectUnauthorizedRedirect(router)
  app.use(router)
  // Nuxt UI plugin after the router so its link component finds vue-router (V2-T02).
  app.use(ui)
  // Bahasa Melayu for every Nuxt UI label (carousel, modal close, pagination), not only under a <UApp>.
  app.provide(uiLocaleKey, uiLocale)

  app.mount(options.el ?? '#app')
  return { app, router, mockRuntime }
}
