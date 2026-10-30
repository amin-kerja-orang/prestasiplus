<script setup lang="ts">
/**
 * Chrome of the Portal Pentadbiran (staff personality), built on the Nuxt UI dashboard kit:
 * a resizable sidebar (icon rail when collapsed, slide-over below `lg`) and a panel whose navbar
 * prints the page's one `h1` (the menu label) after its crumbs (sidebar group, sub-group) and an
 * optional entity name (`useShellEntityTitle`). Header rhythm (design page-templates 2.J): the
 * sidebar header and the navbar share one height and one bottom divider; "Cari menu" sits under
 * the divider with the same inset, width and height as a nav row.
 *
 * Slots: default = page content. `legacy` wraps it in a light island for unmigrated screens.
 */
import type { NavigationMenuItem } from '@nuxt/ui'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useFlash } from '@/composables/useFlash'
import {
  adminAccountMenuUi,
  adminContentColumn,
  adminNavNestedLink,
  adminNavSubLabel,
  adminNavUi,
  adminSearchKbds,
  adminSearchUi,
  adminSidebarUi,
} from '@/theme/admin-shell-ui'
import { uiLocale } from '@/theme/locale-ms'

import DsBrandLogo from './DsBrandLogo.vue'
import DsCallout from './DsCallout.vue'
import DsConfirmHost from './DsConfirmHost.vue'
import DsIcon from './DsIcon.vue'
import DsThemeScope from './DsThemeScope.vue'
import type {
  DsShellAccountIcon,
  DsShellAccountItem,
  DsShellNavGroup,
  DsShellSearchGroup,
} from './adminShell'
import { groupTintClass } from './shellAccent'

const props = defineProps<{
  groups: readonly DsShellNavGroup[]
  searchGroups: readonly DsShellSearchGroup[]
  /** Sidebar group (and sub-group) of the active screen, outermost first. */
  crumbs: readonly string[]
  title: string
  /** Detail-page entity, the last crumb. */
  entity?: string | null
  brandTo: string
  brandLabel: string
  accountName: string
  accountCaption: string
  initials: string
  accountItems: readonly (readonly DsShellAccountItem[])[]
  dark: boolean
  themeLabel: string
  /** Unmigrated screen: rendered inside a light island. */
  legacy?: boolean
}>()

defineEmits<{ toggleTheme: [] }>()

const route = useRoute()
const { flash } = useFlash()

const open = ref(false)
watch(
  () => route.path,
  () => {
    open.value = false
  },
  { immediate: true },
)

const flashText = computed(() => {
  const m = flash.value?.message
  return Array.isArray(m) ? m.join(' ') : (m as string | undefined)
})

/** Menu items; the sub-group indent applies to the expanded sidebar only (the rail keeps one column). */
const navItemsFor = (collapsed: boolean): NavigationMenuItem[][] =>
  props.groups.map((g) => [
    { label: g.label, type: 'label' as const, value: g.key },
    ...g.rows.map((r) =>
      r.kind === 'sub'
        ? { label: r.label, type: 'label' as const, value: `sub:${r.label}`, class: adminNavSubLabel }
        : {
            label: r.label,
            icon: r.icon,
            to: r.to,
            active: r.active,
            value: `${g.key}:${r.id}`,
            ...(r.nested && !collapsed ? { class: adminNavNestedLink } : {}),
          },
    ),
  ])
/** Chip tint by group key (the part of the value before the colon). */
const chipOf = (value: unknown): string => groupTintClass(String(value).split(':')[0])

const ACCOUNT_ICON: Record<DsShellAccountIcon, string> = {
  settings: 'i-ph-gear',
  theme: 'i-ph-circle-half',
  student: 'i-ph-student',
  logout: 'i-ph-sign-out',
}
const accountMenu = computed(() =>
  props.accountItems.map((section) =>
    section.map((i) => ({
      label: i.label,
      ...(i.heading ? { type: 'label' as const } : {}),
      ...(i.icon ? { icon: ACCOUNT_ICON[i.icon] } : {}),
      ...(i.to ? { to: i.to } : {}),
      ...(i.tone ? { color: i.tone } : {}),
      ...(i.onSelect ? { onSelect: i.onSelect } : {}),
    })),
  ),
)
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
          v-model:open="open"
          collapsible
          resizable
          :min-size="14"
          :default-size="16"
          :max-size="20"
          :collapsed-size="4.5"
          :ui="adminSidebarUi"
          data-testid="pentadbiran-sidebar"
        >
          <template #header="{ collapsed }">
            <RouterLink
              :to="brandTo"
              class="flex min-w-0 items-center gap-2"
              :class="collapsed ? '' : 'w-full justify-center'"
              :aria-label="brandLabel"
            >
              <DsBrandLogo :variant="collapsed ? 'icon' : 'full'" />
              <span class="sr-only">{{ brandLabel }}</span>
            </RouterLink>
          </template>

          <template #default="{ collapsed }">
            <UDashboardSearchButton
              :collapsed="collapsed"
              label="Cari menu…"
              color="neutral"
              variant="outline"
              size="md"
              :kbds="adminSearchKbds"
              class="h-10 w-full"
              :class="collapsed ? 'justify-center' : 'justify-start px-2.5 font-normal text-muted'"
              :ui="adminSearchUi"
              data-testid="pentadbiran-search"
            />
            <UNavigationMenu
              :items="navItemsFor(collapsed)"
              :collapsed="collapsed"
              orientation="vertical"
              popover
              tooltip
              aria-label="Menu utama"
              data-testid="pentadbiran-nav"
              :ui="adminNavUi"
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
              :items="accountMenu"
              :content="{ align: 'start', side: 'top' }"
              :ui="adminAccountMenuUi"
            >
              <UButton
                color="neutral"
                variant="ghost"
                block
                class="h-auto justify-start gap-2.5 p-1.5 text-start"
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
                    :title="accountName || 'Akaun'"
                    >{{ accountName || 'Akaun' }}</span
                  >
                  <span class="block truncate text-caption text-muted" :title="accountCaption">{{
                    accountCaption
                  }}</span>
                </span>
                <DsIcon v-if="!collapsed" name="caret-up-down" class="size-4 shrink-0 text-muted" />
              </UButton>
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
                  <nav v-if="crumbs.length > 0" aria-label="Jejak" class="hidden xl:block">
                    <ol class="flex items-baseline gap-2 text-body text-muted">
                      <li v-for="c in crumbs" :key="c" class="truncate">
                        {{ c }} <span aria-hidden="true">/</span>
                      </li>
                    </ol>
                  </nav>
                  <h1 class="truncate text-body font-semibold text-highlighted">
                    {{ title }}
                  </h1>
                  <span
                    v-if="entity"
                    class="hidden truncate text-body text-muted md:block"
                    data-testid="pentadbiran-entity"
                    ><span aria-hidden="true">/</span> {{ entity }}</span
                  >
                </div>
              </template>
              <template #right>
                <!-- Search lives in the sidebar (>= lg and in the drawer); this icon is the only way to open it while the drawer is closed (< lg). -->
                <UDashboardSearchButton
                  :collapsed="true"
                  label="Cari menu"
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  class="lg:hidden"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  :icon="dark ? 'i-ph-sun' : 'i-ph-moon'"
                  :aria-label="themeLabel"
                  data-testid="pentadbiran-theme-toggle"
                  @click="$emit('toggleTheme')"
                />
              </template>
            </UDashboardNavbar>
          </template>

          <template #body>
            <main
              id="kandungan"
              :key="route.path"
              :class="adminContentColumn"
              data-testid="pentadbiran-main"
              tabindex="-1"
            >
              <DsCallout
                v-if="flash"
                :tone="flash.type"
                :description="flashText"
                data-testid="cmp-flash"
              />
              <DsThemeScope
                v-if="legacy"
                personality="staff"
                scheme="light"
                class="overflow-x-auto"
                data-testid="pentadbiran-legacy-island"
              >
                <slot />
              </DsThemeScope>
              <slot v-else />
              <footer class="mt-4 text-center text-caption text-muted">
                <p>&copy; 2026 PRESTASIPLUS. Hakcipta Terpelihara.</p>
              </footer>
            </main>
          </template>
        </UDashboardPanel>

        <UDashboardSearch
          :groups="searchGroups as never"
          placeholder="Cari skrin pentadbiran..."
          :fuse="{ resultLimit: 30 }"
        />
      </UDashboardGroup>
      <DsConfirmHost />
    </div>
  </UApp>
</template>
