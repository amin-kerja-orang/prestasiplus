<script setup lang="ts">
/**
 * Portal Pentadbiran layout (design `docs/design/v2-admin-pages.md`, `v2-admin-page-templates.md`
 * 2.J), staff personality, light and dark. ONE panel for the three old admin surfaces (D30). The
 * chrome is `DsAdminShell`; this file only feeds it the menu, the title, the crumbs and the account.
 * Pages without `meta.v2` (legacy admin screens) render inside a light island.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFlash } from '@/composables/useFlash'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  DsAdminShell,
  DsPillNav,
  provideShellSubtitle,
  provideShellTitle,
  shellEntityTitle,
  shellPageSubtitle,
  type DsShellAccountItem,
} from '@/ds'
import { useShellUser } from '@/shells/pembelajaran/useShellUser'
import { enterModPelajar } from '@/shells/shared/mod-pelajar'
import { useShellTabTitle } from '@/shells/shared/useShellTabTitle'
import { useThemeMode } from '@/theme/color-mode'

import { PENTADBIRAN_FULL_MENU, activeItem, groupOf, onMount } from './menu'
import { redirectsFrom, renderMenu } from './menu/render'
import { buildNavGroups, buildSearchGroups, sectionTabs } from './menu-nav'

const route = useRoute()
// The navbar prints the page title (h1), so DsPageHeader leaves its own out.
provideShellTitle()
// ...and the page description goes under it (DsPageHeader hands its `subtitle` up).
provideShellSubtitle()

const { name } = useShellUser()
const flashApi = useFlash()
const theme = useThemeMode('staff')

const isLegacy = computed(() => route.meta.v2 !== true)
const router = useRouter()
// The rendered menu: a router redirect to a page an earlier entry shows is not listed twice.
const menu = renderMenu(PENTADBIRAN_FULL_MENU, redirectsFrom(router.getRoutes()))
const current = computed(() => activeItem(route.path))
const activeGroupDef = computed(() => (current.value ? groupOf(current.value.id) : undefined))
const pageMeta = usePageMeta()
const title = computed(() => {
  // a page with a data-driven header (usePageMeta) wins over the route's static one
  const header = pageMeta.state.header ?? route.meta.header
  if (header?.title) return header.title
  return current.value?.label ?? 'Pentadbiran'
})
// The page description: the route's static header subtitle (the V2 `@section('subtitle')`) wins;
// a page that sets none lifts its own (`DsPageHeader`, `shellPageSubtitle`).
const subtitle = computed(
  () => (pageMeta.state.header ?? route.meta.header)?.subtitle || shellPageSubtitle.value,
)
// A detail page may name its entity (useShellEntityTitle): last crumb, and part of the tab title.
const entity = shellEntityTitle
useShellTabTitle(computed(() => (entity.value ? `${entity.value} · ${title.value}` : title.value)))
// Crumbs = the sidebar group of the active screen, generated from menu.ts.
const crumbs = computed(() => {
  const g = activeGroupDef.value
  if (!g?.label || g.label === title.value) return []
  return [g.label]
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

const groups = computed(() =>
  buildNavGroups(menu, { activeId: current.value?.id, activeSub: current.value?.sub }),
)
// A folded section (Kirkpatrick) is one sidebar row; its pages are tabs above the content.
const tabs = computed(() => {
  const sub = current.value?.nested ? undefined : current.value?.sub
  return sub
    ? sectionTabs(menu, sub).map((t) => {
        const to = onMount(t.to, route.path)
        return { key: to, label: t.label, to }
      })
    : []
})
const activeTab = computed(() => (current.value ? onMount(current.value.to, route.path) : null))
const searchGroups = buildSearchGroups(menu)

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

const themeLabel = computed(() =>
  theme.scheme.value === 'dark' ? 'Tukar ke tema cerah' : 'Tukar ke tema gelap',
)

const accountItems = computed<DsShellAccountItem[][]>(() => [
  [
    { label: 'Tetapan Peribadi', icon: 'settings', to: '/tetapan' },
    { label: 'Masuk Mod Pelajar', icon: 'student', onSelect: () => void openModPelajar() },
  ],
  [{ label: 'Log Keluar', icon: 'logout', to: '/logout', tone: 'error' }],
])
</script>

<template>
  <DsAdminShell
    :groups="groups"
    :search-groups="searchGroups"
    :crumbs="crumbs"
    :title="title"
    :entity="entity"
    :subtitle="subtitle"
    brand-to="/admin"
    brand-label="Pentadbiran"
    :account-name="name"
    :account-caption="SCOPE_CHIP"
    :initials="initials"
    :account-items="accountItems"
    :dark="theme.scheme.value === 'dark'"
    :theme-label="themeLabel"
    :legacy="isLegacy"
    @toggle-theme="theme.toggle()"
  >
    <DsPillNav
      v-if="tabs.length > 0"
      :items="tabs"
      :active="activeTab"
      label="Bahagian Kirkpatrick"
      testid-prefix="section-tab"
      data-testid="pentadbiran-section-tabs"
    />
    <slot />
  </DsAdminShell>
</template>
