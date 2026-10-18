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
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { FlashOutlet } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'
import { usePrototypeScope } from '@/composables/usePrototypeScope'
import {
  DsArt3D,
  DsBrandLogo,
  DsConfirmHost,
  DsFriendAvatar,
  DsFriendPicker,
  DsIcon,
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
  currentItem,
  drawerEntries,
  pembelajaranTabs,
  phClass,
  sectionOf,
  sidebarEntries,
  tabActive,
} from './pembelajaran-nav'
import { FRIEND_OPTIONS, useFriend } from '@/composables/useFriend'
import { LG_QUERY, useMediaQuery } from '@/shells/admin/useMinWidth'
import { useExclusiveSheets } from './useExclusiveSheets'
import { useShellUser } from './useShellUser'

const route = useRoute()
const { role, name, schoolName } = useShellUser()
const { allows } = usePrototypeScope()
const { flash } = useFlash()
const toast = useToast()

const learner = computed(() => role.value === 'student')
const personality = computed<Personality>(() => (learner.value ? 'learner' : 'staff'))
const theme = useThemeMode(personality)
// Staff pages let the navbar print the h1; learner pages keep their own headings.
if (role.value !== 'student') provideShellTitle()

const { friend, friendName, pickerOpen, choose, openPicker } = useFriend()
const { summary, refresh: refreshSummary } = useGamificationSummary()

const lagiOpen = ref(false)
const sidebarOpen = ref(false)
useExclusiveSheets(lagiOpen, pickerOpen, useMediaQuery(LG_QUERY))
const tabs = computed(() => pembelajaranTabs(role.value))
const sidebar = computed(() => sidebarEntries(role.value))
const drawer = computed(() => drawerEntries(role.value))
const links = computed(() => accountLinks(role.value))
const showAlesa = computed(() => allows('/cikgu'))
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
const title = computed(() => route.meta.header?.title ?? current.value?.label ?? '')
const crumb = computed(() => {
  const c = current.value ? sectionOf(sidebar.value, current.value.id) : ''
  return c && c !== title.value ? c : ''
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

const ariaFriend = computed(() => `Tukar rakan belajar. Rakan sekarang: ${friendName.value}`)
const themeLabel = computed(() =>
  theme.scheme.value === 'dark' ? 'Tukar ke tema cerah' : 'Tukar ke tema gelap',
)

/** Account menu (role-access-matrix section A + theme + Log Keluar), shared by sidebar and navbar. */
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
    {
      label: themeLabel.value,
      icon: phClass('circle-half', learner.value),
      onSelect: () => theme.toggle(),
    },
  ],
  [
    {
      label: 'Log Keluar',
      icon: phClass('sign-out', learner.value),
      to: '/logout',
      color: 'error' as const,
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
      class: 'text-error',
    },
  ],
])

/** Active row: filled gradient pill for the learner, tonal row for staff. */
const navUi = computed(() => ({
  link: learner.value
    ? 'min-h-11 rounded-md hover:before:bg-elevated aria-[current=page]:before:bg-gradient-primary aria-[current=page]:text-primary-on aria-[current=page]:font-semibold'
    : 'min-h-11 rounded-md hover:before:bg-elevated aria-[current=page]:before:bg-primary/10 aria-[current=page]:font-semibold',
  linkLeadingIcon: 'size-4',
  label: "flex items-center gap-2 px-3 pt-4 pb-1 text-overline text-highlighted before:size-1.5 before:rounded-full before:bg-primary before:content-['']",
}))

const slotById = computed(() => {
  const m = new Map<string, number>()
  for (const i of [...flatItems(sidebar.value), ...flatItems(drawer.value)]) m.set(i.id, chipSlot(i))
  return m
})
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

      <UDashboardGroup
        storage="local"
        storage-key="pembelajaran-dashboard"
        class="overflow-clip bg-muted"
      >
        <!-- Sidebar (>= lg): full height, collapses to an icon rail -->
        <UDashboardSidebar
          id="pembelajaran"
          v-model:open="sidebarOpen"
          collapsible
          resizable
          :min-size="14"
          :default-size="17"
          :max-size="26"
          :collapsed-size="4"
          :ui="{
            root: 'bg-default',
            header: 'h-16 shrink-0 px-4',
            body: 'px-3 py-2',
            footer: 'p-3',
          }"
          data-testid="pembelajaran-sidebar"
        >
          <template #header="{ collapsed }">
            <RouterLink
              to="/dashboard"
              class="flex min-w-0 items-center gap-2"
              aria-label="Laman utama"
            >
              <DsBrandLogo v-if="!collapsed" />
              <span
                v-else
                class="grid size-9 place-items-center rounded-md bg-gradient-primary font-display text-label font-extrabold text-primary-on"
                aria-hidden="true"
                >P+</span
              >
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
                  class="grid size-8 shrink-0 place-items-center rounded-md"
                  :class="chipClass(slotOf(item.value), active)"
                  ><UIcon v-if="item.icon" :name="item.icon" class="size-[18px]"
                /></span>
              </template>
            </UNavigationMenu>
          </template>

          <template #footer="{ collapsed }">
            <UDropdownMenu
              :items="accountMenu"
              :content="{ align: 'start', side: 'top' }"
              :ui="{ content: 'min-w-60' }"
            >
              <button
                type="button"
                class="flex min-h-11 w-full min-w-0 items-center gap-3 rounded-md p-2 text-start hover:bg-elevated"
                aria-label="Menu akaun"
                data-testid="pembelajaran-account"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-full bg-gradient-primary text-label font-bold text-primary-on"
                  aria-hidden="true"
                  >{{ initials }}</span
                >
                <span v-if="!collapsed" class="min-w-0 flex-1">
                  <span class="block truncate text-label font-semibold text-highlighted">{{
                    name || 'Akaun'
                  }}</span>
                  <span v-if="schoolName" class="block truncate text-caption text-muted">{{
                    schoolName
                  }}</span>
                </span>
                <DsIcon v-if="!collapsed" name="caret-up-down" class="size-4 shrink-0 text-muted" />
              </button>
            </UDropdownMenu>
          </template>
        </UDashboardSidebar>

        <UDashboardPanel
          id="pembelajaran-main"
          :ui="{ root: 'bg-muted', body: 'p-0 sm:p-0 gap-0', header: 'p-0' }"
        >
          <template #header>
            <UDashboardNavbar
              :ui="{
                root: 'h-16 bg-default pt-[env(safe-area-inset-top)] shadow-bar',
                title: 'min-w-0',
              }"
              data-testid="pembelajaran-header"
            >
              <template #leading>
                <div class="hidden lg:block">
                  <UDashboardSidebarCollapse
                    color="neutral"
                    variant="ghost"
                    aria-label="Tukar saiz menu"
                  />
                </div>
                <RouterLink
                  to="/dashboard"
                  class="inline-flex min-h-11 shrink-0 items-center lg:hidden"
                  aria-label="Laman utama"
                  ><DsBrandLogo
                /></RouterLink>
              </template>
              <template #title>
                <div class="hidden min-w-0 flex-col leading-tight lg:flex">
                  <span v-if="crumb" class="truncate text-caption text-muted">{{ crumb }}</span>
                  <h1 v-if="!learner" class="truncate text-subheading font-bold text-highlighted">
                    {{ title }}
                  </h1>
                  <p v-else class="truncate text-subheading font-bold text-highlighted">
                    {{ title }}
                  </p>
                </div>
              </template>
              <template #right>
                <UDashboardSearchButton
                  label="Cari menu"
                  color="neutral"
                  variant="soft"
                  class="hidden lg:inline-flex"
                />
                <UDashboardSearchButton
                  :collapsed="true"
                  color="neutral"
                  variant="soft"
                  class="hidden sm:inline-flex lg:hidden"
                />
                <template v-if="learner">
                  <DsRewardChip art="fire" :value="summary.streakDays" label="hari" />
                  <DsRewardChip art="coin" :value="summary.coins" label="Koin" />
                  <DsFriendAvatar
                    :friend="friend"
                    size="sm"
                    interactive
                    :label="ariaFriend"
                    class="hidden sm:inline-flex"
                    @press="openPicker"
                  />
                </template>
                <UButton
                  color="neutral"
                  variant="soft"
                  :icon="theme.scheme.value === 'dark' ? 'i-ph-sun' : 'i-ph-moon'"
                  class="hidden sm:inline-flex"
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
                      class="grid size-9 place-items-center rounded-full bg-gradient-primary text-label font-bold text-primary-on"
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
              class="mx-auto flex w-full max-w-6xl min-w-0 flex-1 flex-col px-4 py-4 pb-32 sm:py-6 lg:pb-12"
              data-testid="pembelajaran-main"
              tabindex="-1"
            >
              <FlashOutlet :flash="flash" class="mb-4" />
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
              class="relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-chip px-0.5 text-caption"
              :class="
                tabActive(tab, route.path)
                  ? learner
                    ? 'bg-gradient-primary font-semibold text-primary-on'
                    : 'bg-primary/10 font-semibold text-highlighted'
                  : 'text-muted'
              "
              :aria-current="tabActive(tab, route.path) ? 'page' : undefined"
              :data-nav-id="`tab-${tab.id}`"
            >
              <DsIcon :name="tab.icon" class="size-6" />
              <span class="max-w-full text-center leading-tight break-words" :title="tab.label">{{
                tab.label
              }}</span>
              <span
                v-if="tab.live"
                class="absolute end-3 top-1.5 size-2 rounded-full bg-error"
                aria-hidden="true"
              />
            </RouterLink>
          </li>
          <li class="min-w-0 flex-1">
            <button
              type="button"
              class="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-chip px-1 text-caption text-muted"
              :aria-expanded="lagiOpen"
              data-nav-id="tab-lagi"
              @click="lagiOpen = true"
            >
              <DsIcon name="dots-three-circle" class="size-6" />
              <span>Lagi</span>
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
              <span class="block truncate text-label font-semibold text-highlighted">{{ name }}</span>
              <span v-if="schoolName" class="block truncate text-caption text-muted">{{
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
                class="grid size-8 shrink-0 place-items-center rounded-md"
                :class="chipClass(slotOf((item as { value?: string }).value), active)"
                ><UIcon v-if="item.icon" :name="item.icon" class="size-[18px]"
              /></span>
            </template>
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
      <DsConfirmHost />
    </div>
  </UApp>
</template>
