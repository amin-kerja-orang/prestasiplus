<script setup lang="ts">
/**
 * User-portal shell (F-19; 00-global-ui §4, design shells.md §3, overview §10). Wraps every
 * student/teacher/parent page (layout `user`, `role` for non-admins, `public-or-user` when logged
 * in). Structure follows the live layout (`_raw/M05/work/page_dashboard.html`):
 *
 *   aside.sidebar (≥ lg) │ header.topbar + chips strip (< lg) + main + footer (≥ lg)
 *   drawer + overlay (< lg) · bottom nav (< lg)
 *
 * Data: identity from the session (`GET /api/me`, refreshed by the router after each
 * navigation); chips from `GET /api/me/gamification-summary` (refetched after each navigation,
 * as live renders them per page); the bell from the `notificationBadge` store (the router
 * refreshes it after each navigation; this shell adds the live 60 s poll, FR-M01-53).
 *
 * Not rendered (overview §10): the M22 chatbot FAB and the live PWA install banner.
 */
import { computed, onBeforeUnmount, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'

import { FlashOutlet } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'
import { useIntervalWhileVisible } from '@/composables/useIntervalWhileVisible'
import { usePageMeta, type PageHeader } from '@/composables/usePageMeta'
import { TournamentBanner } from '@/modules/m16-battle-games'
import { navFor } from '@/shells/nav/user-nav'
import { useNotificationBadgeStore } from '@/stores/notification-badge'
import { useSessionStore } from '@/stores/session'
import { useShellStore } from '@/stores/shell'

import UserBottomNav from './UserBottomNav.vue'
import UserDrawer from './UserDrawer.vue'
import UserHeader from './UserHeader.vue'
import UserSidebar from './UserSidebar.vue'
import {
  BELL_REFRESH_MS,
  DEFAULT_USER_HEADER,
  NOTIFICATION_PUSH_EVENT,
  type ChipsMode,
} from './constants'
import './user-shell.css'
import { provideNavBadges } from './nav-badges'
import { useGamificationSummary } from './useGamificationSummary'

const route = useRoute()
const session = useSessionStore()
const shell = useShellStore()
const bell = useNotificationBadgeStore()
const pageMeta = usePageMeta()
const { flash } = useFlash()
const { summary, refresh: refreshSummary } = useGamificationSummary()
const { refresh: refreshNavBadges } = provideNavBadges()

const role = computed(() => session.role)
const user = computed(() => session.user)
const sidebarEntries = computed(() => navFor(role.value, 'sidebar'))
const drawerEntries = computed(() => navFor(role.value, 'drawer'))

/** DV-SH-03: `usePageMeta` header, else the route's static header, else the live default. */
const header = computed<PageHeader>(
  () => pageMeta.state.header ?? route.meta.header ?? DEFAULT_USER_HEADER,
)

const chips = computed<ChipsMode>(() => {
  if (role.value === 'student' || role.value === 'admin') return 'full'
  if (role.value === 'teacher') return 'syiling'
  return 'none'
})

watch(
  () => route.fullPath,
  () => {
    if (session.isLoggedIn && chips.value !== 'none') void refreshSummary()
    if (session.isLoggedIn && role.value === 'admin') void refreshNavBadges()
  },
  { immediate: true },
)

useIntervalWhileVisible(() => {
  void bell.refresh()
}, BELL_REFRESH_MS)

function toggleDrawer(): void {
  shell.setDrawerOpen(!shell.drawerOpen)
}

function closeDrawer(): void {
  shell.setDrawerOpen(false)
}

// Live listens on window: `@toggle-drawer.window` and `@keydown.escape.window`.
function onToggleDrawer(): void {
  toggleDrawer()
}

// FR-M01-53: a foreground push refreshes the bell badge at once (only the badge, no reload).
function onNotificationPush(): void {
  void bell.refresh()
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape' && shell.drawerOpen) closeDrawer()
}

onMounted(() => {
  window.addEventListener('toggle-drawer', onToggleDrawer)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener(NOTIFICATION_PUSH_EVENT, onNotificationPush)
})

onBeforeUnmount(() => {
  window.removeEventListener('toggle-drawer', onToggleDrawer)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener(NOTIFICATION_PUSH_EVENT, onNotificationPush)
  shell.closeOverlays()
})
</script>

<template>
  <div class="user-shell min-h-screen bg-app-user font-body antialiased" data-layout="user">
    <UserSidebar
      :open="shell.sidebarOpen"
      :entries="sidebarEntries"
      :current-path="route.path"
      :user="user"
    />

    <!-- Main Content Area -->
    <div
      class="flex min-h-screen flex-col pb-20 transition-[margin] duration-300 lg:pb-0"
      :class="shell.sidebarOpen ? 'lg:ml-64' : 'lg:ml-0'"
    >
      <UserHeader
        :header="header"
        :summary="summary"
        :chips="chips"
        :user="user"
        :bell-count="bell.count"
        @toggle-sidebar="shell.toggleSidebar()"
        @toggle-drawer="toggleDrawer"
      />

      <!-- Main Content (live `page-transition`: fades in on every page load) -->
      <main
        :key="route.path"
        class="mx-auto w-[95%] flex-1 animate-page-transition py-3 sm:py-6"
        data-testid="shell-user-main"
      >
        <!-- M16 S30: live `tournamentBanner()` block (`mb-4`, hidden while
             `GET /api/tournament/active` returns []); mounted once per page (`:key` above).
             Order agreed with Session 2: ImpersonationBanner (M27) first, then TournamentBanner (M16). -->
        <TournamentBanner />
        <FlashOutlet :flash="flash" class="mb-4" />
        <slot />
      </main>

      <!-- Footer (Desktop Only) -->
      <footer class="topbar mt-auto hidden px-6 py-6 lg:block" data-testid="shell-user-footer">
        <div class="footer-text mx-auto w-[95%] text-center text-sm">
          <p class="font-semibold">
            &copy; 2026 PRESTASIPLUS. Hakcipta Terpelihara <span class="emoji">✨</span>
          </p>
          <p class="mt-1.5 font-medium">
            Didikan penuh <span class="emoji text-red-500">❤️</span> dari Malaysia
            <span class="emoji">🇲🇾</span>
          </p>
        </div>
      </footer>
    </div>

    <UserDrawer
      :open="shell.drawerOpen"
      :entries="drawerEntries"
      :current-path="route.path"
      :user="user"
      @close="closeDrawer"
    />

    <UserBottomNav :current-path="route.path" @toggle-drawer="toggleDrawer" />
  </div>
</template>
