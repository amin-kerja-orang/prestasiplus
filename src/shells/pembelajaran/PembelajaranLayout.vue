<script setup lang="ts">
/**
 * Portal Pembelajaran layout (V2-T15 subset; design v2-shells 5.1 and 5.5), for the student
 * (learner personality, dark by default) and the teacher (staff personality, calm look).
 *
 *   >= lg: sidebar (272px) + header + main
 *   <  lg: header + main + 5-tab bottom bar (active tab = filled gradient pill for the learner,
 *          tonal pill for staff) + "Lagi" slide-over with the complete menu
 *
 * Menus come from `pembelajaran-nav.ts` (derived from the existing user-nav data, filtered by the
 * prototype scope). Role and name come from `useShellUser()`. Legacy pages (routes without
 * `meta.v2`) render unchanged inside a light "island", so their hard-coded light colours stay
 * readable while the surrounding chrome is dark.
 */
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { FlashOutlet } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'
import { usePrototypeScope } from '@/composables/usePrototypeScope'
import { DsArt3D, DsConfirmHost, DsFriendAvatar, DsFriendPicker, DsIcon, DsRewardChip } from '@/ds'
import { useGamificationSummary } from '@/shells/user/useGamificationSummary'
import { useToast } from '@nuxt/ui/composables'
import { uiLocale } from '@/theme/locale-ms'
import { useThemeMode, type Personality } from '@/theme/color-mode'

import PembelajaranNavList from './PembelajaranNavList.vue'
import {
  accountItems,
  drawerEntries,
  pembelajaranTabs,
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

const { friend, friendName, pickerOpen, choose, openPicker } = useFriend()
const { summary, refresh: refreshSummary } = useGamificationSummary()

const lagiOpen = ref(false)
useExclusiveSheets(lagiOpen, pickerOpen, useMediaQuery(LG_QUERY))
const tabs = computed(() => pembelajaranTabs(role.value))
const sidebar = computed(() => sidebarEntries(role.value))
const drawer = computed(() => drawerEntries(role.value))
const account = computed(() => accountItems(role.value))
const showAlesa = computed(() => allows('/cikgu'))
const isLegacy = computed(() => route.meta.v2 !== true)

watch(
  () => route.fullPath,
  () => {
    lagiOpen.value = false
    if (learner.value || role.value === 'teacher') void refreshSummary()
  },
  { immediate: true },
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
</script>

<template>
  <UApp :locale="uiLocale">
    <div
      class="min-h-dvh bg-muted font-body text-default"
      data-layout="pembelajaran"
      :data-role="role ?? undefined"
    >
      <a
        href="#kandungan"
        class="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-50 focus:rounded-chip focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-on"
        >Langkau ke kandungan</a
      >

      <!-- Sidebar (>= lg) -->
      <aside
        class="fixed inset-y-0 start-0 z-30 hidden w-72 flex-col gap-4 overflow-y-auto bg-default p-4 shadow-ds-xs lg:flex"
        data-testid="pembelajaran-sidebar"
      >
        <RouterLink
          to="/dashboard"
          class="px-2 pt-2 font-display text-title font-extrabold text-highlighted"
        >
          Prestasi<span class="text-primary-t">Plus</span>
        </RouterLink>
        <div class="flex items-center gap-3 rounded-sheet bg-muted p-3">
          <DsFriendAvatar
            v-if="learner"
            :friend="friend"
            size="md"
            interactive
            :label="ariaFriend"
            @press="openPicker"
          />
          <div class="min-w-0">
            <p class="truncate text-label font-semibold text-highlighted">{{ name }}</p>
            <p v-if="schoolName" class="truncate text-caption text-muted">{{ schoolName }}</p>
          </div>
        </div>
        <nav aria-label="Menu utama" class="flex-1">
          <PembelajaranNavList :entries="sidebar" :current-path="route.path" :learner="learner" />
        </nav>
      </aside>

      <div class="flex min-h-dvh min-w-0 flex-col lg:ps-72">
        <!-- Header -->
        <header
          class="sticky top-0 z-20 flex min-h-16 items-center gap-2 bg-default px-3 pt-[env(safe-area-inset-top)] shadow-bar sm:px-4"
          data-testid="pembelajaran-header"
        >
          <RouterLink
            to="/dashboard"
            class="font-display text-subheading font-extrabold text-highlighted lg:hidden"
            >Prestasi<span class="text-primary-t">Plus</span></RouterLink
          >
          <div class="ms-auto flex min-w-0 items-center gap-1 sm:gap-2">
            <template v-if="learner">
              <DsRewardChip art="fire" :value="summary.streakDays" label="hari" />
              <DsRewardChip art="coin" :value="summary.coins" label="Koin" />
              <DsFriendAvatar
                :friend="friend"
                size="sm"
                interactive
                :label="ariaFriend"
                class="lg:hidden"
                @press="openPicker"
              />
            </template>
            <button
              type="button"
              class="grid size-11 place-items-center rounded-chip bg-elevated text-default hover:bg-accented"
              :aria-label="themeLabel"
              data-testid="pembelajaran-theme-toggle"
              @click="theme.toggle()"
            >
              <DsIcon :name="theme.scheme.value === 'dark' ? 'sun' : 'moon'" class="size-6" />
            </button>
          </div>
        </header>

        <main
          id="kandungan"
          :key="route.path"
          class="mx-auto w-full max-w-6xl min-w-0 flex-1 px-4 py-4 pb-32 sm:py-6 lg:pb-12"
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
      </div>

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
        <ul class="mx-auto flex max-w-xl items-stretch justify-around gap-1 p-2">
          <li v-for="tab in tabs" :key="tab.id" class="min-w-0 flex-1">
            <RouterLink
              :to="tab.to"
              class="relative flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-chip px-1 text-caption"
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
              <span class="max-w-full truncate" :title="tab.label">{{ tab.label }}</span>
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
          <nav aria-label="Menu penuh">
            <PembelajaranNavList
              :entries="drawer"
              :current-path="route.path"
              :learner="learner"
              @navigate="lagiOpen = false"
            />
            <ul class="mt-4 flex flex-col gap-1">
              <li v-for="item in account" :key="item.id">
                <RouterLink
                  :to="item.to"
                  class="flex min-h-11 items-center rounded-chip px-3 text-label text-toned hover:bg-elevated"
                  @click="lagiOpen = false"
                  >{{ item.label }}</RouterLink
                >
              </li>
              <li>
                <RouterLink
                  to="/logout"
                  class="flex min-h-11 items-center rounded-chip px-3 text-label text-error hover:bg-elevated"
                  data-testid="pembelajaran-logout"
                  @click="lagiOpen = false"
                  >Log Keluar</RouterLink
                >
              </li>
            </ul>
          </nav>
        </template>
      </USlideover>

      <DsFriendPicker
        v-if="learner"
        v-model:open="pickerOpen"
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
