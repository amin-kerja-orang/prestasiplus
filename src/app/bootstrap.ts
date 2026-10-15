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

import { createHttpTransport, installTransport, type Transport } from '@/api'
import type { BootMockOptions, MockRuntime } from '@/mock'
import { useSessionStore, withSessionSliding } from '@/stores'

import App from '../App.vue'
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

async function createTransport(
  mockOptions: Partial<BootMockOptions> | undefined,
): Promise<{ transport: Transport; mockRuntime: MockRuntime | null }> {
  if (import.meta.env.VITE_API_MODE === 'http') {
    return { transport: createHttpTransport(), mockRuntime: null }
  }
  const { startMock, createMockPersistence } = await import('@/mock')
  const runtime = await startMock({
    persistence: createMockPersistence(),
    init: window.__MOCK_INIT__ ?? null,
    ...mockOptions,
  })
  return { transport: runtime.transport, mockRuntime: runtime }
}

/**
 * The Nuxt UI colour-mode plugin (`useDark()` of VueUse) follows the OS scheme when nothing is
 * stored, which would put `.dark` on `<html>` and a dark body on every legacy page. Until the new
 * portal layouts own dark mode (V2-T03), an unset preference is stored as `light`
 * (key `vueuse-color-scheme`, not configurable through the plugin).
 */
function seedLightColorMode(): void {
  try {
    if (localStorage.getItem('vueuse-color-scheme') === null) {
      localStorage.setItem('vueuse-color-scheme', 'light')
    }
  } catch {
    // Storage blocked: the plugin then follows the OS, nothing more to do.
  }
}

export async function bootstrap(options: BootstrapOptions = {}): Promise<BootstrappedApp> {
  const { transport, mockRuntime } = await createTransport(options.mock)
  installTransport(withSessionSliding(transport))

  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)
  useSessionStore()

  const router = createAppRouter(options.history ? { history: options.history } : {})
  connectUnauthorizedRedirect(router)
  app.use(router)
  // Nuxt UI plugin after the router so its link component finds vue-router (V2-T02).
  seedLightColorMode()
  app.use(ui)

  app.mount(options.el ?? '#app')
  return { app, router, mockRuntime }
}
