import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { AdminBanner } from '../../api/admin-media'
import { MEDIA_ROUTES } from '../../lib/admin-media/common'

const stub = { template: '<div />' }

/** A router with the named M09 admin-media routes (and S9/S12 targets) over memory history. */
export function makeRouter(extra: { path: string; component: Component }[] = []): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/banners', name: MEDIA_ROUTES.bannerList, component: stub },
      { path: '/admin/banners/create', name: MEDIA_ROUTES.bannerCreate, component: stub },
      { path: '/admin/banners/:id/edit', name: MEDIA_ROUTES.bannerEdit, component: stub },
      { path: '/admin/audio-kbat', name: MEDIA_ROUTES.audioList, component: stub },
      { path: '/admin/audio-kbat/create', name: MEDIA_ROUTES.audioCreate, component: stub },
      ...extra,
    ],
  })
}

export async function mountAt(
  component: Component,
  path: string,
  props: Record<string, unknown> = {},
  router: Router = makeRouter([{ path: '/page', component }]),
): Promise<{ wrapper: VueWrapper; router: Router }> {
  await router.push(path)
  await router.isReady()
  const wrapper = mount(component, { props, global: { plugins: [router] } })
  await flushPromises()
  return { wrapper, router }
}

export function banner(id: number, extra: Partial<AdminBanner> = {}): AdminBanner {
  return {
    id,
    title: `Banner ${String(id)}`,
    description: 'Penerangan ringkas.',
    imageUrl: null,
    bannerType: 'HERO',
    linkType: 'NONE',
    externalUrl: null,
    targetAudience: 'ALL',
    displayOrder: id,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    isActive: true,
    createdAt: '2026-01-01T09:00:00+08:00',
    updatedAt: '2026-01-01T09:00:00+08:00',
    ...extra,
  }
}

export const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
