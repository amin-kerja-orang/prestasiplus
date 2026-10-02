/**
 * Probe routes: a **harness stand-in** for module routes that do not exist yet.
 *
 * The e2e build has only the core routes (`/`, `/logout`, the 404 catch-all; the dev galleries are
 * `import.meta.env.DEV` only). To smoke the real user shell, guards and in-place error pages before
 * any module route is built, a spec adds a route at runtime to the app's own router, with an empty
 * page component and the route meta under test, then navigates to it client-side. The layout host,
 * the shell, the guards and the after-each hook are the real ones.
 *
 * Replace a probe with the real module route as soon as it exists (e.g. `/dashboard`, M08). Tests
 * that use a probe say so in their title ("(probe route)").
 *
 * It reaches the router through `#app.__vue_app__`, which Vue sets on the mount container in every
 * build.
 */

import type { Page } from '@playwright/test'

import { waitForApp } from '../fixtures/mock-handle'

export type ProbeLayout = 'admin' | 'user' | 'role' | 'public-or-user' | 'bare'

export interface ProbeRoute {
  /** Must start with `/__e2e/`, so it can never shadow a real route. */
  path: string
  layout: ProbeLayout
  access?: 'public' | 'auth'
  roles?: readonly string[]
  onForbidden?: 'landing' | '403' | '404'
  title?: string
}

/** Adds `route` to the running app's router (idempotent per page load). */
export async function addProbeRoute(page: Page, route: ProbeRoute): Promise<void> {
  if (!route.path.startsWith('/__e2e/')) {
    throw new Error(`addProbeRoute: path must start with /__e2e/ (got ${route.path})`)
  }
  await waitForApp(page)
  await page.evaluate((r) => {
    type RouterLike = {
      hasRoute(name: string): boolean
      addRoute(record: unknown): void
      isReady(): Promise<void>
    }
    const el = document.querySelector('#app') as Element & {
      __vue_app__: { config: { globalProperties: { $router: RouterLike } } }
    }
    const router = el.__vue_app__.config.globalProperties.$router
    const name = `e2e-probe:${r.path}`
    if (router.hasRoute(name)) return
    const meta: Record<string, unknown> = { layout: r.layout, access: r.access ?? 'auth' }
    if (r.roles) meta.roles = r.roles
    if (r.onForbidden) meta.onForbidden = r.onForbidden
    if (r.title) meta.title = r.title
    router.addRoute({
      path: r.path,
      name,
      component: { name: 'E2eProbePage', render: () => null },
      meta,
    })
  }, route)
}

/**
 * Client-side navigation with the app's router (`router.push`), as a link click would do. Resolves
 * when the navigation (including guard redirects) has finished.
 */
export async function navigateInApp(page: Page, path: string): Promise<void> {
  await waitForApp(page)
  await page.evaluate(async (to) => {
    type RouterLike = { push(to: string): Promise<unknown> }
    const el = document.querySelector('#app') as Element & {
      __vue_app__: { config: { globalProperties: { $router: RouterLike } } }
    }
    await el.__vue_app__.config.globalProperties.$router.push(to)
  }, path)
}

/** `addProbeRoute` then `navigateInApp`. */
export async function openProbeRoute(page: Page, route: ProbeRoute): Promise<void> {
  await addProbeRoute(page, route)
  await navigateInApp(page, route.path)
}
