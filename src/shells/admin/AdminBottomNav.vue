<script setup lang="ts">
/**
 * Bottom navigation (< lg, shells.md §2.4, §2.6): four link cells and the "Lagi" button, 45 px
 * high plus the safe-area inset. Every cell is the whole `flex-1` width, so the hit area is at
 * least 44 px at 320 px (5 cells of 64 px). Inactive `slate-400`, active `indigo-600`. "Lagi" is
 * active while the popover is open, or when the current page is reachable only through it.
 */
import { bottomNavActive, type AdminBottomNavEntry } from '@/shells/nav/admin-nav'
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'

defineProps<{
  entries: readonly AdminBottomNavEntry[]
  currentPath: string
  lagiOpen: boolean
  /** The current page is a "Lagi"-only page (and no link cell is active). */
  lagiActive: boolean
}>()

const emit = defineEmits<{ 'toggle-lagi': [] }>()

const CELL = 'flex min-w-0 flex-1 flex-col items-center justify-center px-1'
const ICON = 'text-lg leading-none sm:text-xl'
const LABEL = 'block max-w-full truncate text-[10px] font-semibold sm:text-[11px]'
</script>

<template>
  <nav
    class="bottom-nav fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] shadow-lg lg:hidden"
    data-testid="shell-admin-bottom-nav"
  >
    <div class="flex h-[45px] items-stretch justify-around">
      <template v-for="entry in entries" :key="entry.id">
        <ShellLink
          v-if="entry.kind === 'link'"
          :to="entry.to"
          :class="[
            CELL,
            bottomNavActive(entry, currentPath) ? 'active text-indigo-600' : 'text-slate-400',
          ]"
          :data-nav-id="`bottom-${entry.id}`"
        >
          <NavIcon :fa="entry.fa" :class="ICON" />
          <span :class="LABEL">{{ entry.label }}</span>
        </ShellLink>
        <button
          v-else
          type="button"
          :class="[CELL, lagiOpen || lagiActive ? 'active text-indigo-600' : 'text-slate-400']"
          :data-nav-id="`bottom-${entry.id}`"
          data-lagi-toggle
          @click="emit('toggle-lagi')"
        >
          <NavIcon :fa="entry.fa" :class="ICON" />
          <span :class="LABEL">{{ entry.label }}</span>
        </button>
      </template>
    </div>
  </nav>
</template>
