<script setup lang="ts">
/**
 * Portal Pembelajaran layout (design v2-shells 5.1 and 5.5), for the student (learner personality,
 * dark by default) and the teacher / school admin (staff personality). Built on the Nuxt UI
 * dashboard kit, like the Portal Pentadbiran:
 *
 *   >= lg: UDashboardSidebar (full height, collapses to an icon rail) + UDashboardPanel with a
 *          UDashboardNavbar (title, search, reward chips, theme, avatar menu)
 *   <  lg: navbar + main + 5-tab bottom bar + "Lagi" slide-over with the complete menu and the
 *          account block (Log Keluar is always within two taps)
 *
 * Menus come from `pembelajaran-nav.ts` (derived from the user-nav data, filtered by role and the
 * prototype scope). Legacy pages (routes without `meta.v2`) render unchanged inside a light island.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isAlesaAiOn } from '@/app/features'
import { isPathAllowed, shellHomePath } from '@/app/prototype-scope'
import { FlashOutlet } from '@/components/feedback'
import { dsCopy } from '@/ds/copy'
import { TournamentBanner } from '@/modules/m16-battle-games'
import { useFlash } from '@/composables/useFlash'
import { usePageMeta } from '@/composables/usePageMeta'
import { usePrototypeScope } from '@/composables/usePrototypeScope'
import {
  DsArt3D,
  DsBadge,
  DsBrandLogo,
  DsConfirmHost,
  DsFriendPicker,
  DsIcon,
  DsPillNav,
  DsRewardChip,
  provideShellTitle,
} from '@/ds'
import { useGamificationSummary } from '@/shells/user/useGamificationSummary'
import { useToast } from '@nuxt/ui/composables'
import { uiLocale } from '@/theme/locale-ms'
import { useThemeMode, type Personality } from '@/theme/color-mode'

import {
  accountLinks,
  buildLearnNav,
  buildLearnSearch,
  CHIP_CLASS,
  chipSlot,
  flatItems,
  groupTabs,
  currentItem,
  labelTitle,
  drawerEntries,
  LOGOUT_ROW_MIN_HEIGHT_CLASS,
  pembelajaranTabs,
  phClass,
  REWARD_LINK_CLASS,
  routeRoleCheck,
  sectionOf,
  sidebarEntries,
  tabActive,
} from './pembelajaran-nav'
import { FRIEND_OPTIONS, useFriend } from '@/composables/useFriend'
import { LG_QUERY, useMediaQuery } from '@/shells/admin/useMinWidth'
import ModPelajarBanner from '@/shells/shared/ModPelajarBanner.vue'
import { useShellTabTitle } from '@/shells/shared/useShellTabTitle'
import { useIntervalWhileVisible } from '@/composables/useIntervalWhileVisible'
import { BELL_REFRESH_MS, NOTIFICATION_PUSH_EVENT } from '@/shells/user/constants'
import { useNotificationBadgeStore } from '@/stores/notification-badge'
import { useSessionStore } from '@/stores/session'
import { useExclusiveSheets } from './useExclusiveSheets'
import { useShellUser } from './useShellUser'

const route = useRoute()
const { role, name, schoolName } = useShellUser()
const modeOn = computed(() => useSessionStore().mode !== null)
const { allows } = usePrototypeScope()
// Logo link: the role's own dashboard (teacher `/guru`, school admin `/admin-sekolah`), scope on or off.
const home = computed(() => shellHomePath(role.value))
// FR-MUR-SH-12: the tournament banner, as in UserShell; roles without /tournament do not see it (D43).
const showTournamentBanner = computed(() => isPathAllowed(role.value, '/tournament'))
const { flash } = useFlash()
const toast = useToast()

const learner = computed(() => role.value === 'student')
const personality = computed<Personality>(() => (learner.value ? 'learner' : 'staff'))
const theme = useThemeMode(personality)
// One rule for every role: the navbar prints the page title (h1); DsPageHeader leaves its own out.
provideShellTitle()


const { friend, pickerOpen, promptOpen, dismissPrompt, choose, openPicker } = useFriend()
// The first-run prompt belongs to the dashboard only: leaving it closes the prompt for good.
const promptShown = computed(() => learner.value && promptOpen.value && route.path === '/dashboard')
watch(
  () => route.path,
  (path) => {
    if (path !== '/dashboard' && promptOpen.value) dismissPrompt()
  },
)
const { summary, refresh: refreshSummary } = useGamificationSummary()

// Notification bell: the shared unread-count store (router refreshes on navigation) plus the 60 s refresh.
const bell = useNotificationBadgeStore()
const showBell = computed(() => isPathAllowed(role.value, '/notifikasi'))
const bellLabel = computed(() =>
  bell.visible ? `Notifikasi, ${bell.count} belum dibaca` : 'Notifikasi',
)
useIntervalWhileVisible(() => {
  void bell.refresh()
}, BELL_REFRESH_MS)
// FR-M01-53: a foreground push refreshes the bell badge at once (as UserShell does).
function onNotificationPush(): void {
  void bell.refresh()
}
onMounted(() => window.addEventListener(NOTIFICATION_PUSH_EVENT, onNotificationPush))
onBeforeUnmount(() => window.removeEventListener(NOTIFICATION_PUSH_EVENT, onNotificationPush))

const lagiOpen = ref(false)
const sidebarOpen = ref(false)
useExclusiveSheets(lagiOpen, pickerOpen, useMediaQuery(LG_QUERY))
const tabs = computed(() => pembelajaranTabs(role.value))
// Scope off (UAT): also drop the menu items whose route refuses the role (no visible-but-forbidden link).
const router = useRouter()
const canOpen = computed(() => routeRoleCheck(router, role.value))
const sidebar = computed(() => sidebarEntries(role.value, canOpen.value))
const drawer = computed(() => drawerEntries(role.value, canOpen.value))
const links = computed(() => accountLinks(role.value))
const showAlesa = computed(() => isAlesaAiOn() && allows('/cikgu'))
const isLegacy = computed(() => route.meta.v2 !== true)

const navOpts = computed(() => ({ learner: learner.value, currentPath: route.path }))
const navGroups = computed(() => buildLearnNav(sidebar.value, navOpts.value))
const searchGroups = computed(() => {
  const groups = buildLearnSearch(sidebar.value, navOpts.value)
  groups.push({
    id: 'akaun',
    label: 'Akaun',
    items: [
      ...links.value.map((l) => ({
        id: l.id,
        label: l.label,
        icon: phClass(l.icon, learner.value),
        to: l.to,
      })),
      { id: 'logout', label: 'Log Keluar', icon: phClass('sign-out', learner.value), to: '/logout' },
    ],
  })
  return groups
})

const current = computed(() => currentItem(sidebar.value, route.path))
/** In-page tabs of a folded section (Kirkpatrick): its pages, moved between inside the page. */
const sectionTabs = computed(() =>
  groupTabs(sidebar.value, current.value?.id).map((t) => ({ key: t.id, label: t.label, to: t.to })),
)
// A page with a data-driven header (usePageMeta.setHeader) wins over the route's static one.
const pageMeta = usePageMeta()
const header = computed(() => pageMeta.state.header ?? route.meta.header)
const title = computed(() => header.value?.title ?? current.value?.label ?? '')
/** Page description under the title (school-name line, "Tingkatan N"): set by the page or the route. */
const subtitle = computed(() => header.value?.subtitle || '')
useShellTabTitle(title)
/** Sidebar headings are stored in capitals ("HARIAN"); the crumb reads in sentence case like the admin shell. */
const sentenceCase = (t: string): string =>
  t
    .split(' · ')
    .map((p) => (p === p.toUpperCase() ? p.charAt(0) + p.slice(1).toLowerCase() : p))
    .join(' · ')
const crumb = computed(() => {
  const c = current.value ? sectionOf(sidebar.value, current.value.id) : ''
  return c && c !== title.value ? sentenceCase(c) : ''
})
const initials = computed(
  () =>
    name.value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || 'A',
)

watch(
  () => route.fullPath,
  () => {
    lagiOpen.value = false
    sidebarOpen.value = false
    if (learner.value || role.value === 'teacher') void refreshSummary()
  },
  { immediate: true },
)
// The panel body is the scroll container: start every page at the top.
watch(
  () => route.path,
  () => void nextTick(() => document.getElementById('kandungan')?.parentElement?.scrollTo(0, 0)),
)

function onPicked(chosen: 'aiman' | 'aisyah'): void {
  choose(chosen)
  const picked = FRIEND_OPTIONS.find((f) => f.value === chosen)?.name ?? ''
  toast.add({ title: `Rakan belajar: ${picked}`, color: 'success' })
}

const themeLabel = computed(() =>
  theme.scheme.value === 'dark' ? 'Tukar ke tema cerah' : 'Tukar ke tema gelap',
)

/**
 * Account menu of the navbar avatar (role-access-matrix section A + Log Keluar). No sidebar footer and no
 * theme row: the navbar sun/moon button is the one theme control, for every role (PO 2026-11-09).
 */
const accountMenu = computed(() => [
  [
    { label: name.value || 'Akaun', type: 'label' as const },
    ...(schoolName.value
      ? [{ label: schoolName.value, type: 'label' as const, class: 'font-normal' }]
      : []),
  ],
  links.value.map((l) => ({ label: l.label, icon: phClass(l.icon, learner.value), to: l.to })),
  [
    ...(learner.value
      ? [{ label: 'Tukar Rakan Belajar', icon: phClass('smiley', true), onSelect: () => openPicker() }]
      : []),
  ],
  [
    {
      label: 'Log Keluar',
      icon: phClass('sign-out', learner.value),
      to: '/logout',
      color: 'error' as const,
      class: LOGOUT_ROW_MIN_HEIGHT_CLASS,
    },
  ],
])

/** "Lagi" sheet: the complete menu plus the account block. */
const lagiGroups = computed(() => [
  ...buildLearnNav(drawer.value, navOpts.value),
  [
    { label: 'Akaun', type: 'label' as const },
    ...links.value.map((l) => ({
      label: l.label,
      icon: phClass(l.icon, learner.value),
      to: l.to,
    })),
    {
      label: 'Log Keluar',
      icon: phClass('sign-out', learner.value),
      to: '/logout',
      class: `text-error ${LOGOUT_ROW_MIN_HEIGHT_CLASS}`,
    },
  ],
])

/**
 * One line per row, quiet section labels; active row: gradient pill (learner) or tinted pill (staff).
 * The active fill sits on the link itself, not only on its ::before pill: the theme hover
 * background (elevated) paints the link above the pill, so hovering the active learner row used to
 * show the white primary-on label on the light elevated grey. Learner: the primary gradient (ds-c1
 * to ds-primary-2, a background image the hover colour cannot cover) with the primary-on label,
 * light and dark (white label 5.2:1). Staff: the primary-soft tint with the primary-t label, kept
 * on hover. (No quotes or backticks in this comment: the ds-debt scanner reads them as literals.)
 */
const navUi = computed(() => ({
  root: 'gap-0',
  link: learner.value
    ? 'min-h-10 pointer-coarse:min-h-12 py-1 gap-2 px-2.5 rounded-md hover:before:bg-elevated aria-[current=page]:bg-gradient-primary aria-[current=page]:before:bg-gradient-primary aria-[current=page]:text-primary-on aria-[current=page]:hover:text-primary-on aria-[current=page]:font-semibold'
    : 'min-h-10 pointer-coarse:min-h-12 py-1 gap-2 px-2.5 rounded-md hover:before:bg-elevated aria-[current=page]:bg-primary-soft aria-[current=page]:hover:bg-primary-soft aria-[current=page]:text-primary-t aria-[current=page]:hover:text-primary-t aria-[current=page]:font-semibold',
  linkLeadingIcon: 'size-4',
  // A long label wraps beside its pill (never an ellipsis); the pill keeps its size.
  linkLabel: 'min-w-0 whitespace-normal leading-tight',
  linkTrailing: 'shrink-0',
  label: 'px-2.5 pt-5 pb-1.5 text-overline font-semibold text-muted uppercase',
}))

const slotById = computed(() => {
  const m = new Map<string, number>()
  for (const i of [...flatItems(sidebar.value), ...flatItems(drawer.value)]) m.set(i.id, chipSlot(i))
  for (const e of [...sidebar.value, ...drawer.value]) if (e.kind === 'group') m.set(e.id, chipSlot(e))
  return m
})
/** Text of the nav row pill ("LIVE"), when the row has one. */
const badgeOf = (item: unknown): string | undefined => (item as { dsBadge?: string }).dsBadge
const slotOf = (id: unknown): number => slotById.value.get(String(id)) ?? 1

const chipClass = (chip: unknown, active: boolean): string =>
  active && learner.value
    ? 'bg-white/20 text-primary-on'
    : (CHIP_CLASS[Number(chip)] ?? CHIP_CLASS[1] ?? '')
</script>

<template>
  <UApp :locale="uiLocale">
    <div
      class="font-body text-default"
      data-layout="pembelajaran"
      data-portal="pembelajaran"
      :data-role="role ?? undefined"
    >
      <a
        href="#kandungan"
        class="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-chip focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-on"
        >Langkau ke kandungan</a
      >

      <ModPelajarBanner />
      <UDashboardGroup
        storage="local"
        storage-key="pembelajaran-dashboard-v3"
        unit="rem"
        :style="modeOn ? { top: 'var(--mod-bar-h, 2.5rem)' } : undefined"
        class="overflow-clip bg-muted"
      >
        <!-- Sidebar (>= lg): full height, collapses to an icon rail -->
        <UDashboardSidebar
          id="pembelajaran"
          v-model:open="sidebarOpen"
          collapsible
          resizable
          :min-size="14"
          :default-size="16"
          :max-size="20"
          :collapsed-size="4.5"
          :ui="{
            root: modeOn ? 'bg-default min-h-0! h-full!' : 'bg-default',
            header: 'h-16 shrink-0 items-center px-4 py-3',
            body: 'gap-1 px-3 py-3',
          }"
          data-testid="pembelajaran-sidebar"
        >
          <template #header="{ collapsed }">
            <RouterLink
              :to="home"
              class="flex min-w-0 items-center gap-2"
              :class="collapsed ? '' : 'w-full justify-center'"
              aria-label="Laman utama"
            >
              <DsBrandLogo :variant="collapsed ? 'icon' : 'full'" />
            </RouterLink>
          </template>

          <template #default="{ collapsed }">
            <UNavigationMenu
              :items="navGroups"
              :collapsed="collapsed"
              orientation="vertical"
              popover
              tooltip
              :ui="navUi"
              aria-label="Menu utama"
              data-testid="pembelajaran-nav"
            >
              <template #item-leading="{ item, active }">
                <span
                  v-if="item.icon"
                  class="grid size-7 shrink-0 place-items-center rounded-md"
                  :class="chipClass(slotOf(item.value), active)"
                  ><UIcon v-if="item.icon" :name="item.icon" class="size-4"
                /></span>
              </template>
              <template #item-label="{ item }"
                ><span class="min-w-0" :title="labelTitle(item.label)">{{ item.label }}</span
                ><DsBadge
                  v-if="badgeOf(item)"
                  :label="badgeOf(item)"
                  tone="error"
                  emphasis="strong"
                  size="sm"
                  class="ml-1.5 shrink-0 px-1.5"
                  data-testid="pembelajaran-nav-badge"
              /></template
              >
            </UNavigationMenu>
          </template>

        </UDashboardSidebar>

        <UDashboardPanel
          id="pembelajaran-main"
          :ui="{ root: 'bg-muted', body: 'p-0 sm:p-0 gap-0', header: 'p-0' }"
        >
          <template #header>
            <UDashboardNavbar
              :toggle="false"
              :as="{ title: 'div' }"
              :ui="{
                root: 'px-4 pt-[env(safe-area-inset-top)] sm:px-4',
                left: 'min-w-0 flex-1',
                title: 'min-w-0',
                right: 'gap-2',
              }"
              data-testid="pembelajaran-header"
            >
              <template #leading>
                <div class="hidden lg:block">
                  <UDashboardSidebarCollapse
                    color="neutral"
                    variant="ghost"
                    size="sm"
                    aria-label="Tukar saiz menu"
                  />
                </div>
                <RouterLink
                  :to="home"
                  class="inline-flex min-h-11 shrink-0 items-center lg:hidden"
                  aria-label="Laman utama"
                  ><DsBrandLogo
                /></RouterLink>
              </template>
              <template #title>
                <div class="flex min-w-0 flex-col">
                <div class="flex min-w-0 items-baseline gap-2">
                  <span v-if="crumb" class="hidden truncate text-body text-muted xl:block"
                    >{{ crumb }} <span aria-hidden="true">/</span></span
                  >
                  <component
                    :is="route.meta.ownsH1 ? 'p' : 'h1'"
                    v-if="title"
                    class="truncate text-body font-semibold text-highlighted sm:text-subheading"
                    :data-testid="route.meta.ownsH1 ? 'shell-title' : undefined"
                  >
                    {{ title }}
                  </component>
                </div>
                <p
                  v-if="subtitle"
                  class="hidden truncate text-caption text-muted md:block"
                  :title="subtitle"
                  data-testid="pembelajaran-subtitle"
                >
                  {{ subtitle }}
                </p>
                </div>
              </template>
              <template #right>
                <UDashboardSearchButton
                  label="Cari menu"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  class="hidden w-52 justify-start font-normal text-muted lg:inline-flex"
                  :ui="{ label: 'grow text-start' }"
                />
                <UDashboardSearchButton
                  :collapsed="true"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  class="hidden sm:inline-flex lg:hidden"
                />
                <template v-if="learner">
                  <div class="hidden items-center gap-2 sm:flex">
                    <!-- FR-MUR-SH-11 (S5-T10): pupil pills link to Profil (streak) and Syiling & Token (coin). -->
                    <RouterLink
                      to="/profile"
                      :class="REWARD_LINK_CLASS"
                      data-testid="pembelajaran-chip-streak"
                      ><DsRewardChip quiet art="fire" :value="summary.streakDays" label="hari 🔥"
                    /></RouterLink>
                    <RouterLink
                      to="/gamification"
                      :class="REWARD_LINK_CLASS"
                      data-testid="pembelajaran-chip-coin"
                      ><DsRewardChip quiet art="coin" :value="summary.coins" label="koin"
                    /></RouterLink>
                  </div>
                </template>
                <!-- BUG-I1 / v2-shells 5.1: bell with the unread count (UChip, 99+); same store as UserShell. -->
                <RouterLink
                  v-if="showBell"
                  to="/notifikasi"
                  class="grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-elevated hover:text-highlighted focus-visible:outline-2 focus-visible:outline-primary"
                  :aria-label="bellLabel"
                  title="Notifikasi"
                  data-testid="shell-user-bell"
                >
                  <UChip
                    :show="bell.visible"
                    :text="bell.label"
                    color="error"
                    size="2xl"
                    :ui="{ base: 'px-1 font-bold' }"
                  >
                    <UIcon name="i-ph-bell" class="size-5" aria-hidden="true" />
                    <template #content>
                      <span data-testid="shell-user-bell-badge">{{ bell.label }}</span>
                    </template>
                  </UChip>
                </RouterLink>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :icon="theme.scheme.value === 'dark' ? 'i-ph-sun' : 'i-ph-moon'"
                  :aria-label="themeLabel"
                  data-testid="pembelajaran-theme-toggle"
                  @click="theme.toggle()"
                />
                <UDropdownMenu
                  :items="accountMenu"
                  :content="{ align: 'end', side: 'bottom' }"
                  :ui="{ content: 'min-w-60' }"
                >
                  <button
                    type="button"
                    class="grid size-11 shrink-0 place-items-center rounded-full"
                    aria-label="Menu akaun"
                    data-testid="pembelajaran-account-top"
                  >
                    <span
                      class="grid size-8 place-items-center rounded-full bg-gradient-primary text-caption font-semibold text-primary-on"
                      aria-hidden="true"
                      >{{ initials }}</span
                    >
                  </button>
                </UDropdownMenu>
              </template>
            </UDashboardNavbar>
          </template>

          <template #body>
            <main
              id="kandungan"
              :key="route.path"
              class="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col px-4 py-4 sm:pt-6 lg:pb-12"
              :class="promptShown ? 'pb-72' : 'pb-32'"
              data-testid="pembelajaran-main"
              tabindex="-1"
            >
              <!-- FR-MUR-SH-12 / M16 S30: first child of <main>, before the flash (same order as UserShell). -->
              <TournamentBanner v-if="showTournamentBanner" />
              <FlashOutlet :flash="flash" class="mb-4" />
              <DsPillNav
                v-if="sectionTabs.length > 0"
                :items="sectionTabs"
                :active="current?.id ?? null"
                label="Bahagian Kirkpatrick"
                testid-prefix="section-tab"
                class="mb-4"
                data-testid="pembelajaran-section-tabs"
              />
              <div
                v-if="isLegacy"
                class="light overflow-x-auto rounded-sheet bg-default p-4 text-default"
                data-personality="staff"
                data-testid="pembelajaran-legacy-island"
              >
                <slot />
              </div>
              <slot v-else />
              <footer class="mt-8 hidden text-center text-caption text-muted lg:block">
                <p>&copy; 2026 PRESTASIPLUS. Hakcipta Terpelihara.</p>
                <p>Didikan penuh ❤️ dari Malaysia 🇲🇾</p>
              </footer>
            </main>
          </template>
        </UDashboardPanel>

        <UDashboardSearch
          :groups="searchGroups"
          placeholder="Cari menu..."
          :fuse="{ resultLimit: 30 }"
        />
      </UDashboardGroup>

      <!-- Cikgu Alesa floating button -->
      <RouterLink
        v-if="showAlesa"
        to="/cikgu"
        class="fixed end-4 bottom-24 z-30 grid size-14 place-items-center rounded-full bg-ai text-primary-on shadow-lift lg:bottom-6"
        aria-label="Cikgu Alesa"
        data-testid="pembelajaran-alesa"
      >
        <DsArt3D v-if="learner" name="books" size="sm" />
        <DsIcon v-else name="sparkle" class="size-7" />
        <span
          class="absolute -end-1 -top-1 rounded-full bg-highlight px-1.5 text-caption font-bold text-on-highlight"
          aria-hidden="true"
          >AI</span
        >
      </RouterLink>

      <!-- Bottom tab bar (< lg) -->
      <nav
        class="fixed inset-x-0 bottom-0 z-30 rounded-t-sheet bg-default pb-[env(safe-area-inset-bottom)] shadow-bar-up lg:hidden"
        aria-label="Navigasi bawah"
        data-testid="pembelajaran-bottom-nav"
      >
        <ul class="mx-auto flex max-w-xl items-stretch justify-around gap-0.5 p-1.5 sm:gap-1 sm:p-2">
          <li v-for="tab in tabs" :key="tab.id" class="min-w-0 flex-1">
            <RouterLink
              :to="tab.to"
              class="relative flex h-14 flex-col items-center justify-center gap-0.5 rounded-chip px-0.5 text-caption"
              :class="
                tabActive(tab, route.path)
                  ? learner
                    ? 'bg-gradient-primary font-semibold text-primary-on'
                    : 'bg-primary-soft font-semibold text-highlighted'
                  : 'text-muted'
              "
              :aria-current="tabActive(tab, route.path) ? 'page' : undefined"
              :data-nav-id="`tab-${tab.id}`"
            >
              <DsIcon :name="tab.icon" class="size-6 shrink-0" />
              <span
                class="block w-full truncate text-center text-caption leading-tight"
                :title="tab.label"
                >{{ tab.label }}</span
              >
              <template v-if="tab.live">
                <span
                  class="absolute end-3 top-1.5 size-2 rounded-full bg-error"
                  aria-hidden="true"
                />
                <span class="sr-only" data-testid="pembelajaran-tab-live">{{ dsCopy.statusLive }}</span>
              </template>
            </RouterLink>
          </li>
          <li class="min-w-0 flex-1">
            <button
              type="button"
              class="flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-chip px-0.5 text-caption text-muted"
              :aria-expanded="lagiOpen"
              data-nav-id="tab-lagi"
              @click="lagiOpen = true"
            >
              <DsIcon name="dots-three-circle" class="size-6 shrink-0" />
              <span class="block w-full truncate text-center leading-tight">Lagi</span>
            </button>
          </li>
        </ul>
      </nav>

      <USlideover
        v-model:open="lagiOpen"
        side="right"
        title="Menu"
        description="Semua menu PRESTASIPLUS"
        :ui="{ content: 'max-w-[min(88vw,360px)]' }"
      >
        <template #body>
          <div class="mb-2 flex items-center gap-3 rounded-sheet bg-muted p-3">
            <span
              class="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-primary text-label font-bold text-primary-on"
              aria-hidden="true"
              >{{ initials }}</span
            >
            <span class="min-w-0">
              <span class="block break-words text-label text-highlighted">{{ name }}</span>
              <span v-if="schoolName" class="block break-words text-caption text-muted">{{
                schoolName
              }}</span>
            </span>
          </div>
          <UNavigationMenu
            :items="lagiGroups"
            orientation="vertical"
            :ui="navUi"
            aria-label="Menu penuh"
            data-testid="pembelajaran-lagi-nav"
          >
            <template #item-leading="{ item, active }">
              <span
                v-if="item.icon"
                class="grid size-7 shrink-0 place-items-center rounded-md"
                :class="chipClass(slotOf((item as { value?: string }).value), active)"
                ><UIcon v-if="item.icon" :name="item.icon" class="size-4"
              /></span>
            </template>
            <template #item-label="{ item }"
              ><span class="min-w-0" :title="labelTitle(item.label)">{{ item.label }}</span
                ><DsBadge
                  v-if="badgeOf(item)"
                  :label="badgeOf(item)"
                  tone="error"
                  emphasis="strong"
                  size="sm"
                  class="ml-1.5 shrink-0 px-1.5"
                  data-testid="pembelajaran-nav-badge"
              /></template
            >
          </UNavigationMenu>
        </template>
      </USlideover>

      <DsFriendPicker
        v-if="learner"
        v-model:open="pickerOpen"
        :modal="false"
        :selected="friend"
        :friends="FRIEND_OPTIONS"
        title="Pilih rakan belajar awak"
        description="Dia akan temankan awak sepanjang latihan. Boleh tukar bila-bila masa."
        confirm-label="Pilih"
        cancel-label="Batal"
        group-label="Rakan belajar"
        @confirm="onPicked"
      />
      <aside
        v-if="promptShown"
        class="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-sm flex-col gap-3 rounded-card bg-default p-4 shadow-lg ring ring-default lg:inset-x-auto lg:top-20 lg:right-6 lg:bottom-auto"
        aria-label="Pilih rakan belajar"
        data-testid="friend-prompt"
      >
        <div class="flex items-start gap-2">
          <div class="min-w-0 flex-1">
            <p class="text-label text-highlighted">Pilih rakan belajar awak</p>
            <p class="text-caption text-muted">Dia akan temankan awak sepanjang latihan.</p>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-ph-x"
            aria-label="Tutup"
            data-testid="friend-prompt-close"
            @click="dismissPrompt"
          />
        </div>
        <div class="flex gap-2">
          <UButton
            v-for="f in FRIEND_OPTIONS"
            :key="f.value"
            class="min-h-11 flex-1 justify-center"
            color="primary"
            variant="soft"
            :label="f.name"
            :data-testid="`friend-prompt-${f.value}`"
            @click="onPicked(f.value)"
          />
        </div>
      </aside>
      <DsConfirmHost />
    </div>
  </UApp>
</template>
