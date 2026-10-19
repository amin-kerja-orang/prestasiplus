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
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { FlashOutlet } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsBrandLogo, DsConfirmHost, DsIcon, DsPillNav, provideShellTitle } from '@/ds'
import { useShellUser } from '@/shells/pembelajaran/useShellUser'
import { useThemeMode } from '@/theme/color-mode'
import { uiLocale } from '@/theme/locale-ms'

import { PENTADBIRAN_MENU, activeItem, groupOf } from './menu'
import { groupTintClass } from './group-accent'
import { buildNavItems, buildSearchGroups, sectionTabs } from './menu-nav'
import { enterModPelajar } from '@/shells/shared/mod-pelajar'

const route = useRoute()
// The navbar prints the page title (h1), so DsPageHeader leaves its own out.
provideShellTitle()
const { name } = useShellUser()
const flashApi = useFlash()
const { flash } = flashApi
const theme = useThemeMode('staff')

const isLegacy = computed(() => route.meta.v2 !== true)
const current = computed(() => activeItem(route.path))
const activeId = computed(() => current.value?.id)
const activeGroupDef = computed(() => (current.value ? groupOf(current.value.id) : undefined))
const pageMeta = usePageMeta()
const title = computed(() => {
  // a page with a data-driven header (usePageMeta) wins over the route's static one
  const header = pageMeta.state.header ?? route.meta.header
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

const NAV_UI = {
  root: 'gap-0',
  label: 'px-2.5 pt-5 pb-1.5 text-overline font-semibold text-muted uppercase',
  link: 'h-10 gap-2.5 px-2.5 rounded-md hover:before:bg-elevated aria-[current=page]:before:bg-primary-soft aria-[current=page]:text-primary-t aria-[current=page]:font-semibold',
  linkLabel: 'truncate',
  linkTrailing: 'shrink-0',
}

const SCOPE_CHIP = 'Admin Pusat · Seluruh Negara'

const sidebarOpen = ref(false)
watch(
  () => route.path,
  () => {
    sidebarOpen.value = false
  },
  { immediate: true },
)

const navItems = computed(() =>
  buildNavItems(PENTADBIRAN_MENU, { activeId: activeId.value, activeSub: current.value?.sub }),
)
const tabs = computed(() => {
  const sub = current.value?.sub
  return sub
    ? sectionTabs(PENTADBIRAN_MENU, sub).map((t) => ({ key: t.to, label: t.label, to: t.to }))
    : []
})
const chipOf = (id: unknown): string => groupTintClass(groupOf(String(id))?.key)

const router = useRouter()
const switching = ref(false)
async function openModPelajar(): Promise<void> {
  if (switching.value) return
  switching.value = true
  try {
    await router.push(await enterModPelajar())
  } catch {
    flashApi.show({ type: 'error', message: 'Mod Pelajar tidak dapat dibuka. Sila cuba lagi.' })
  } finally {
    switching.value = false
  }
}
const searchGroups = buildSearchGroups(PENTADBIRAN_MENU)

const themeLabel = computed(() =>
  theme.scheme.value === 'dark' ? 'Tukar ke tema cerah' : 'Tukar ke tema gelap',
)

const accountItems = computed(() => [
  [{ label: name.value || 'Akaun', type: 'label' as const }],
  [
    { label: 'Tetapan Peribadi', icon: 'i-ph-gear', to: '/tetapan' },
    { label: themeLabel.value, icon: 'i-ph-circle-half', onSelect: () => theme.toggle() },
    {
      label: 'Masuk Mod Pelajar',
      icon: 'i-ph-student',
      onSelect: () => void openModPelajar(),
    },
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
        storage-key="pentadbiran-dashboard-v3"
        unit="rem"
        class="overflow-clip bg-muted"
      >
        <UDashboardSidebar
          id="pentadbiran"
          v-model:open="sidebarOpen"
          collapsible
          resizable
          :min-size="14"
          :default-size="16"
          :max-size="20"
          :collapsed-size="4.5"
          :ui="{
            header: 'h-16 shrink-0 px-4',
            body: 'px-3 pt-1 pb-3',
            footer: 'p-2 border-t border-default',
          }"
          data-testid="pentadbiran-sidebar"
        >
          <template #header="{ collapsed }">
            <RouterLink
              to="/admin"
              class="flex min-w-0 items-center gap-2"
              aria-label="Pentadbiran"
            >
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
              :ui="NAV_UI"
            >
              <template #item-leading="{ item }">
                <span
                  v-if="item.icon"
                  class="grid size-7 shrink-0 place-items-center rounded-md"
                  :class="chipOf(item.value)"
                  ><UIcon :name="item.icon" class="size-4"
                /></span>
              </template>
              <template #item-label="{ item }"
                ><span class="truncate" :title="item.label">{{ item.label }}</span></template
              >
            </UNavigationMenu>
          </template>

          <template #footer="{ collapsed }">
            <UDropdownMenu
              :items="accountItems"
              :content="{ align: 'start', side: 'top' }"
              :ui="{ content: 'min-w-56' }"
            >
              <button
                type="button"
                class="flex w-full min-w-0 items-center gap-2.5 rounded-md p-1.5 text-start hover:bg-elevated"
                aria-label="Menu akaun"
                data-testid="pentadbiran-account"
              >
                <span
                  class="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-primary text-caption font-bold text-primary-on"
                  aria-hidden="true"
                  >{{ initials }}</span
                >
                <span v-if="!collapsed" class="min-w-0 flex-1 leading-tight">
                  <span
                    class="block truncate text-label text-highlighted"
                    :title="name || 'Akaun'"
                    >{{ name || 'Akaun' }}</span
                  >
                  <span class="block truncate text-caption text-muted" :title="SCOPE_CHIP">{{
                    SCOPE_CHIP
                  }}</span>
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
              :toggle="false"
              :as="{ title: 'div' }"
              :ui="{ title: 'min-w-0', right: 'gap-2' }"
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
                <div class="flex min-w-0 items-baseline gap-2">
                  <span v-if="crumb" class="hidden truncate text-body text-muted xl:block"
                    >{{ crumb }} <span aria-hidden="true">/</span></span
                  >
                  <h1 class="truncate text-subheading text-highlighted">{{ title }}</h1>
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
                  class="lg:hidden"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
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
              class="mx-auto flex w-full max-w-[1600px] min-w-0 flex-1 flex-col gap-4 p-4 md:p-6"
              data-testid="pentadbiran-main"
              tabindex="-1"
            >
              <FlashOutlet :flash="flash" />
              <DsPillNav
                v-if="tabs.length > 0"
                :items="tabs"
                :active="current?.to ?? null"
                label="Bahagian Kirkpatrick"
                testid-prefix="section-tab"
                data-testid="pentadbiran-section-tabs"
              />
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
