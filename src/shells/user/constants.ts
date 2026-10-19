import type { PageHeader } from '@/composables/usePageMeta'

/**
 * Live user-layout default header, shown where neither the page (`usePageMeta`) nor the route
 * (`meta.header`) sets one. DV-SH-03 only replaces it on pages whose module DV gives a title.
 */
export const DEFAULT_USER_HEADER: Readonly<PageHeader> = Object.freeze({
  title: 'Dashboard',
  subtitle: 'Selamat datang kembali',
})

/** Bell refresh period (live `setInterval(updateNotifBadge, 60000)`, M01 FR-M01-53). */
export const BELL_REFRESH_MS = 60_000

/** Simulated foreground push (M01 `NOTIFICATION_PUSH_EVENT`, FR-M01-53): refreshes the bell at once. */
export const NOTIFICATION_PUSH_EVENT = 'pp:notification-push'

/** Which header chips a role gets (see `UserHeader.vue`). */
export type ChipsMode = 'full' | 'syiling' | 'none'
