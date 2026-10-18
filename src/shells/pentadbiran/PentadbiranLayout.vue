<script setup lang="ts">
/**
 * Portal Pentadbiran layout (design `docs/design/v2-admin-pages.md`), staff personality, light and
 * dark. ONE panel for the three old admin surfaces (D30). Built on the Nuxt UI dashboard kit:
 *
 *   UDashboardGroup > UDashboardSidebar (resizable, collapses to an icon rail, slideover < lg)
 *                   + UDashboardPanel (UDashboardNavbar in the header, scrolling body)
 *
 * Pages without `meta.v2` (legacy admin screens) render inside a light island.
 */
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { FlashOutlet } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'
import { DsBrandLogo, DsConfirmHost, DsIcon } from '@/ds'
import { useShellUser } from '@/shells/pembelajaran/useShellUser'
import { useThemeMode } from '@/theme/color-mode'
import { uiLocale } from '@/theme/locale-ms'

import { MENU_STORAGE_KEY, PENTADBIRAN_MENU, activeItem, groupOf } from './menu'
import { buildNavItems, buildSearchGroups } from './menu-nav'

const route = useRoute()
const { name } = useShellUser()
const { flash } = useFlash()
const theme = useThemeMode('staff')

const isLegacy = computed(() => route.meta.v2 !== true)
const current = computed(() => activeItem(route.path))
const activeId = computed(() => current.value?.id)
const activeGroupDef = computed(() => (current.value ? groupOf(current.value.id) : undefined))
const title = computed(() => {
  const header = route.meta.header
  if (header?.title) return header.title
  return current.value?.label ?? 'Pentadbiran'
})
const crumb = computed(() => {
  const g = activeGroupDef.value
  return g && g.label !== title.value ? g.label : ''
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

const SCOPE_CHIP = 'Admin Pusat · Seluruh Negara'

// Open state of the groups, persisted. The group of the active page opens on every navigation.
function readOpen(): Record<string, boolean> {
  try {
    const raw = window.localStorage.getItem(MENU_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}
const open = ref<Record<string, boolean>>(readOpen())
function save(): void {
  try {
    window.localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(open.value))
  } catch {
    /* storage unavailable: keep in memory */
  }
}
const isOpen = (key: string): boolean => open.value[key] === true
function toggle(key: string): void {
  open.value = { ...open.value, [key]: !isOpen(key) }
  save()
}
const sidebarOpen = ref(false)
watch(
  () => route.path,
  () => {
    sidebarOpen.value = false
    const key = activeGroupDef.value?.key
    if (key && !isOpen(key)) {
      open.value = { ...open.value, [key]: true }
      save()
    }
  },
  { immediate: true },
)

const navItems = computed(() =>
  buildNavItems(PENTADBIRAN_MENU, { activeId: activeId.value, isOpen, toggle }),
)
const searchGroups = buildSearchGroups(PENTADBIRAN_MENU)

const themeLabel = computed(() =>
  theme.scheme.value === 'dark' ? 'Tukar ke tema cerah' : 'Tukar ke tema gelap',
)

const accountItems = computed(() => [
  [{ label: name.value || 'Akaun', type: 'label' as const }],
  [
    { label: 'Tetapan Peribadi', icon: 'i-ph-gear', to: '/tetapan' },
    { label: themeLabel.value, icon: 'i-ph-circle-half', onSelect: () => theme.toggle() },
    { label: 'Masuk Mod Pelajar', icon: 'i-ph-student', to: '/dashboard' },
  ],
  [{ label: 'Log Keluar', icon: 'i-ph-sign-out', to: '/logout', color: 'error' as const }],
])
</script>

<template>
  <UApp :locale="uiLocale">
    <div
      class="font-body text-default"
      data-layout="pentadbiran"
      data-portal="pentadbiran"
      data-personality="staff"
    >
      <a
        href="#kandungan"
        class="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-chip focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-on"
        >Langkau ke kandungan</a
      >
      <UDashboardGroup
        storage="local"
        storage-key="pentadbiran-dashboard"
        class="overflow-clip bg-muted"
      >
        <UDashboardSidebar
          id="pentadbiran"
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
          data-testid="pentadbiran-sidebar"
        >
          <template #header="{ collapsed }">
            <RouterLink to="/admin" class="flex min-w-0 items-center gap-2" aria-label="Pentadbiran">
              <DsBrandLogo v-if="!collapsed" />
              <span
                v-else
                class="grid size-9 place-items-center rounded-md bg-gradient-primary font-display text-label font-extrabold text-primary-on"
                >P+</span
              >
              <span class="sr-only">Pentadbiran</span>
            </RouterLink>
          </template>

          <template #default="{ collapsed }">
            <UNavigationMenu
              :items="navItems"
              :collapsed="collapsed"
              orientation="vertical"
              popover
              tooltip
              aria-label="Menu utama"
              data-testid="pentadbiran-nav"
            />
          </template>

          <template #footer="{ collapsed }">
            <UDropdownMenu
              :items="accountItems"
              :content="{ align: 'start', side: 'top' }"
              :ui="{ content: 'min-w-56' }"
            >
              <button
                type="button"
                class="flex w-full min-w-0 items-center gap-3 rounded-md p-2 text-start hover:bg-elevated"
                aria-label="Menu akaun"
                data-testid="pentadbiran-account"
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
                  <span class="block truncate text-caption text-muted">{{ SCOPE_CHIP }}</span>
                </span>
                <DsIcon v-if="!collapsed" name="caret-up-down" class="size-4 shrink-0 text-muted" />
              </button>
            </UDropdownMenu>
          </template>
        </UDashboardSidebar>

        <UDashboardPanel
          id="pentadbiran-main"
          :ui="{ root: 'bg-muted', body: 'p-0 sm:p-0 gap-0', header: 'p-0' }"
        >
          <template #header>
            <UDashboardNavbar
              :ui="{ root: 'h-16 bg-default shadow-bar', title: 'min-w-0' }"
              data-testid="pentadbiran-header"
            >
              <template #leading>
                <UDashboardSidebarToggle
                  class="lg:hidden"
                  aria-label="Buka menu"
                  data-testid="pentadbiran-menu-button"
                />
                <div class="hidden lg:block">
                  <UDashboardSidebarCollapse
                    color="neutral"
                    variant="ghost"
                    aria-label="Tukar saiz menu"
                  />
                </div>
              </template>
              <template #title>
                <div class="flex min-w-0 flex-col leading-tight">
                  <span v-if="crumb" class="hidden truncate text-caption text-muted sm:block">{{
                    crumb
                  }}</span>
                  <h1 class="truncate text-subheading font-bold text-highlighted">{{ title }}</h1>
                </div>
              </template>
              <template #right>
                <UDashboardSearchButton
                  label="Cari menu"
                  color="neutral"
                  variant="soft"
                  class="hidden sm:inline-flex"
                />
                <UDashboardSearchButton
                  :collapsed="true"
                  color="neutral"
                  variant="soft"
                  class="sm:hidden"
                />
                <span
                  class="hidden max-w-64 truncate rounded-full bg-primary/15 px-3 py-1.5 text-label font-semibold text-primary lg:inline-flex"
                  data-testid="pentadbiran-scope-chip"
                  >{{ SCOPE_CHIP }}</span
                >
                <UButton
                  color="neutral"
                  variant="soft"
                  :icon="theme.scheme.value === 'dark' ? 'i-ph-sun' : 'i-ph-moon'"
                  :aria-label="themeLabel"
                  data-testid="pentadbiran-theme-toggle"
                  @click="theme.toggle()"
                />
              </template>
            </UDashboardNavbar>
          </template>

          <template #body>
            <main
              id="kandungan"
              :key="route.path"
              class="mx-auto flex w-full max-w-[1600px] min-w-0 flex-1 flex-col gap-4 p-3 sm:p-4 lg:p-6"
              data-testid="pentadbiran-main"
              tabindex="-1"
            >
              <FlashOutlet :flash="flash" />
              <div
                v-if="isLegacy"
                class="light overflow-x-auto rounded-card bg-default p-4 text-default"
                data-personality="staff"
                data-testid="pentadbiran-legacy-island"
              >
                <slot />
              </div>
              <slot v-else />
              <footer class="mt-4 text-center text-caption text-muted">
                <p>&copy; 2026 PRESTASIPLUS. Hakcipta Terpelihara.</p>
              </footer>
            </main>
          </template>
        </UDashboardPanel>

        <UDashboardSearch
          :groups="searchGroups"
          placeholder="Cari skrin pentadbiran..."
          :fuse="{ resultLimit: 30 }"
        />
      </UDashboardGroup>
      <DsConfirmHost />
    </div>
  </UApp>
</template>
