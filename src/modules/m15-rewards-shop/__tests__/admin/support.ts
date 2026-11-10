/**
 * Shared fixtures of the admin Hadiah and Tebusan page tests (S7-T11): the client module is mocked, rows are
 * built here, and `DsDialog` is a plain section so the dialogs can be read in jsdom.
 */

import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import type { HadiahListItem, HadiahListMeta, RedemptionListItem } from '../../api/types'

/** A `DsDialog` that renders only while open (UModal needs a portal and the browser). */
export const DsDialogStub = defineComponent({
  name: 'DsDialogStub',
  props: { open: Boolean, title: { type: String, default: '' } },
  emits: ['update:open'],
  setup(props, { slots }) {
    return () =>
      props.open
        ? h('section', { role: 'dialog', 'aria-label': props.title, 'data-dialog': props.title }, [
            slots.default?.(),
            slots.footer?.(),
          ])
        : null
  },
})

export const hadiahRow = (over: Partial<HadiahListItem> = {}): HadiahListItem => ({
  id: '1',
  category: 'gaming',
  categoryLabel: '🎮 Gaming',
  vendor: 'Roblox',
  title: 'Roblox Gift Card RM10',
  iconEmoji: '🎮',
  denominationRm: 10,
  tokenCost: 10,
  stockQuantity: null,
  redemptionCount: 1,
  isActive: false,
  ...over,
})

export const listBody = (
  rows: HadiahListItem[],
  meta: Partial<HadiahListMeta> & { page?: number; totalPages?: number; totalItems?: number } = {},
) => ({
  data: rows,
  meta: {
    page: 1,
    pageSize: 50,
    totalItems: rows.length,
    totalPages: 1,
    from: rows.length ? 1 : null,
    to: rows.length ? rows.length : null,
    activeCat: 'all' as const,
    cards: { total: 59, active: 2, redemptionsThisMonth: 4, pendingAdmin: 3 },
    ...meta,
  },
})

export const redemptionRow = (over: Partial<RedemptionListItem> = {}): RedemptionListItem => ({
  id: '15101',
  user: { id: '2', name: 'Pelajar Demo', email: 'pelajar@demo.test' },
  rewardId: '40',
  rewardTitle: 'TnG eWallet RM10',
  rewardVendor: 'Touch n Go',
  denominationRm: 10,
  tokenCost: 10,
  status: 'pending_admin',
  createdAt: '2026-09-24T20:15:00+08:00',
  ...over,
})

export const queueBody = (
  rows: RedemptionListItem[],
  meta: { activeStatus?: 'pending_admin' | 'delivered' | 'cancelled' | 'all' | null; page?: number; totalPages?: number } = {},
) => ({
  data: rows,
  meta: {
    page: meta.page ?? 1,
    pageSize: 50,
    totalItems: rows.length,
    totalPages: meta.totalPages ?? 1,
    from: rows.length ? 1 : null,
    to: rows.length ? rows.length : null,
    activeStatus: meta.activeStatus === undefined ? ('pending_admin' as const) : meta.activeStatus,
  },
})

export function routerAt(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
}
