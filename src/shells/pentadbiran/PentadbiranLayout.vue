<script setup lang="ts">
/**
 * Portal Pentadbiran layout (V2-T13/T14 PoC; design v2-shells section 2), staff personality, light
 * and dark. ONE panel for the three old admin surfaces (D30).
 *
 *   >= lg: sidebar (272px, 9 groups) + top bar + main
 *   <  lg: top bar with a menu button (drawer from the left) + scope bar + main
 *
 * Pages without `meta.v2` (legacy admin screens) render inside a light island, as in Pembelajaran.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { FlashOutlet } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'
import { DsBrandLogo, DsConfirmHost, DsIcon } from '@/ds'
import { useShellUser } from '@/shells/pembelajaran/useShellUser'
import { useThemeMode } from '@/theme/color-mode'
import { uiLocale } from '@/theme/locale-ms'

import { groupChipClass } from './group-accent'
import { heroFor } from './heroes'
import { MENU_STORAGE_KEY, PENTADBIRAN_MENU, activeItem, groupOf } from './menu'
import PentadbiranHero from './PentadbiranHero.vue'
import PentadbiranNavList from './PentadbiranNavList.vue'

const route = useRoute()
const { name } = useShellUser()
const { flash } = useFlash()
const theme = useThemeMode('staff')

const drawerOpen = ref(false)
const isLegacy = computed(() => route.meta.v2 !== true)

const current = computed(() => activeItem(route.path))
const activeId = computed(() => current.value?.id)
const activeGroup = computed(() => (current.value ? groupOf(current.value.id)?.key : undefined))
const title = computed(() => {
  const header = route.meta.header
  if (header?.title) return header.title
  return current.value?.label ?? 'Pentadbiran'
})
const subtitle = computed(() => {
  const g = current.value ? groupOf(current.value.id) : undefined
  return g && g.label !== title.value ? g.label : ''
})

const hero = computed(() => heroFor(route.path))
const activeGroupIcon = computed(() => (current.value ? groupOf(current.value.id)?.icon : undefined))
const initials = computed(() =>
  name.value
    .split(/s+/)
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

watch(
  () => route.path,
  () => {
    drawerOpen.value = false
    const key = activeGroup.value
    if (key && !isOpen(key)) {
      open.value = { ...open.value, [key]: true }
      save()
    }
  },
  { immediate: true },
)

const themeLabel = computed(() =>
  theme.scheme.value === 'dark' ? 'Tukar ke tema cerah' : 'Tukar ke tema gelap',
)

const accountItems = computed(() => [
  [{ label: name.value || 'Akaun', type: 'label' as const }],
  [
    { label: 'Tetapan Peribadi', to: '/tetapan' },
    { label: themeLabel.value, onSelect: () => theme.toggle() },
    { label: 'Masuk Mod Pelajar', to: '/dashboard' },
  ],
  [{ label: 'Log Keluar', to: '/logout', color: 'error' as const }],
])

onBeforeUnmount(() => {
  drawerOpen.value = false
})
</script>

<template>
  <UApp :locale="uiLocale">
    <div
      class="min-h-dvh bg-muted font-body text-default"
      data-layout="pentadbiran"
      data-portal="pentadbiran"
      data-personality="staff"
    >
      <a
        href="#kandungan"
        class="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-chip focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-on"
        >Langkau ke kandungan</a
      >

      <!-- Sidebar (>= lg) -->
      <aside
        class="fixed inset-y-0 start-0 z-30 hidden w-72 flex-col gap-3 overflow-x-hidden overflow-y-auto bg-soft p-3 shadow-card lg:flex"
        data-testid="pentadbiran-sidebar"
      >
        <div
          class="relative flex min-w-0 items-center gap-2 overflow-hidden rounded-card bg-gradient-primary px-4 py-4 text-primary-on shadow-hero"
        >
          <span
            class="pointer-events-none absolute -end-6 -top-8 size-24 rounded-full bg-primary-on/10"
            aria-hidden="true"
          />
          <RouterLink to="/admin" class="relative inline-flex min-h-11 min-w-0 items-center">
            <DsBrandLogo backed />
          </RouterLink>
          <span
            class="relative shrink-0 rounded-full bg-primary-on/20 px-2 py-0.5 text-caption font-semibold whitespace-nowrap"
            >Pentadbiran</span
          >
        </div>
        <nav aria-label="Menu utama" class="flex-1 rounded-card bg-default p-2 shadow-ds-xs">
          <PentadbiranNavList
            :groups="PENTADBIRAN_MENU"
            :active-id="activeId"
            :active-group="activeGroup"
            :is-open="isOpen"
            @toggle="toggle"
          />
        </nav>
      </aside>

      <div class="flex min-h-dvh min-w-0 flex-col lg:ps-72">
        <header
          class="sticky top-0 z-20 bg-default pt-[env(safe-area-inset-top)] shadow-bar"
          data-testid="pentadbiran-header"
        >
          <div class="flex min-h-14 items-center gap-2 px-3 sm:px-4">
            <button
              type="button"
              class="grid size-11 shrink-0 place-items-center rounded-chip text-default hover:bg-elevated lg:hidden"
              aria-label="Buka menu"
              :aria-expanded="drawerOpen"
              data-testid="pentadbiran-menu-button"
              @click="drawerOpen = true"
            >
              <DsIcon name="list" class="size-6" />
            </button>
            <span
              class="hidden size-9 shrink-0 place-items-center rounded-chip shadow-ds-xs sm:grid"
              :class="groupChipClass(activeGroup)"
              aria-hidden="true"
            >
              <DsIcon :name="activeGroupIcon ?? 'squares-four'" class="size-5" />
            </span>
            <div class="min-w-0 flex-1">
              <h1 class="truncate text-heading font-semibold text-highlighted">{{ title }}</h1>
              <p v-if="subtitle" class="hidden truncate text-caption text-muted sm:block">
                {{ subtitle }}
              </p>
            </div>
            <span
              class="hidden max-w-64 truncate rounded-full bg-gradient-primary px-3 py-1.5 text-label font-semibold text-primary-on shadow-cta sm:inline-flex"
              data-testid="pentadbiran-scope-chip"
              >{{ SCOPE_CHIP }}</span
            >
            <button
              type="button"
              class="grid size-11 shrink-0 place-items-center rounded-chip bg-elevated text-default hover:bg-accented"
              :aria-label="themeLabel"
              data-testid="pentadbiran-theme-toggle"
              @click="theme.toggle()"
            >
              <DsIcon :name="theme.scheme.value === 'dark' ? 'sun' : 'moon'" class="size-6" />
            </button>
            <UDropdownMenu :items="accountItems" :content="{ align: 'end' }">
              <button
                type="button"
                class="grid size-11 shrink-0 place-items-center rounded-full hover:bg-elevated"
                aria-label="Menu akaun"
                data-testid="pentadbiran-account"
              >
                <span
                  class="grid size-9 place-items-center rounded-full bg-gradient-primary text-label font-bold text-primary-on shadow-cta"
                  aria-hidden="true"
                  >{{ initials }}</span
                >
              </button>
            </UDropdownMenu>
          </div>
          <!-- Scope bar (< sm) -->
          <div class="flex min-h-11 items-center bg-gradient-primary px-3 sm:hidden">
            <span class="truncate text-label font-semibold text-primary-on">{{ SCOPE_CHIP }}</span>
          </div>
        </header>

        <main
          id="kandungan"
          :key="route.path"
          class="mx-auto w-full max-w-7xl min-w-0 flex-1 px-4 py-4 sm:py-6"
          data-testid="pentadbiran-main"
          tabindex="-1"
        >
          <FlashOutlet :flash="flash" class="mb-4" />
          <PentadbiranHero v-if="hero" :hero="hero" />
          <div
            v-if="isLegacy"
            class="light overflow-x-auto rounded-sheet bg-default p-4 text-default"
            data-personality="staff"
            data-testid="pentadbiran-legacy-island"
          >
            <slot />
          </div>
          <slot v-else />
          <footer class="mt-8 text-center text-caption text-muted">
            <p>&copy; 2026 PRESTASIPLUS. Hakcipta Terpelihara.</p>
          </footer>
        </main>
      </div>

      <USlideover
        v-model:open="drawerOpen"
        side="left"
        title="Menu"
        description="Semua menu Portal Pentadbiran"
        :ui="{ content: 'max-w-[min(88vw,320px)]' }"
      >
        <template #body>
          <nav aria-label="Menu penuh">
            <PentadbiranNavList
              :groups="PENTADBIRAN_MENU"
              :active-id="activeId"
              :active-group="activeGroup"
              :is-open="isOpen"
              @toggle="toggle"
              @navigate="drawerOpen = false"
            />
          </nav>
        </template>
      </USlideover>
      <DsConfirmHost />
    </div>
  </UApp>
</template>
