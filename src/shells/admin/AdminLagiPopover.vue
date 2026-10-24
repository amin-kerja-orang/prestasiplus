<script setup lang="ts">
/**
 * "Lagi" popover (< lg, shells.md §2.4): one panel above the bottom nav, right-anchored, `w-56`,
 * scrolling inside `max-h-[70vh]`, generated from the nav data (`lagiFor`). Small headings, coloured
 * icon rows (>= 44 px high, DV-SH-11), a `border-t` and the tail rows ("Paparan Pelajar" for the
 * admin, "Log Keluar"). Closes by a second tap on "Lagi", a tap outside, or following a link
 * (the router closes the overlays). Escape and focus trapping are not added (D10).
 */
import { ref } from 'vue'

import { useClickOutside } from '@/composables/useClickOutside'
import type { LagiMenu, LagiRow } from '@/shells/nav/admin-nav'
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'

const props = defineProps<{
  open: boolean
  menu: LagiMenu
  /** Row ids that are active (item id, or the group row of the active group). */
  isActive: (row: LagiRow) => boolean
}>()

const emit = defineEmits<{ close: [] }>()

const panel = ref<HTMLElement | null>(null)

useClickOutside(
  panel,
  (event) => {
    // The "Lagi" cell toggles the popover itself.
    if (event.target instanceof Element && event.target.closest('[data-lagi-toggle]')) return
    emit('close')
  },
  { enabled: () => props.open },
)

const ROW = 'flex min-h-11 items-center gap-3 px-4 py-3 text-sm'
</script>

<template>
  <div
    v-show="open"
    ref="panel"
    class="fixed right-4 bottom-[calc(45px+env(safe-area-inset-bottom)+8px)] z-50 max-h-[70vh] w-56 overflow-y-auto overscroll-contain rounded-2xl border border-slate-100 bg-white shadow-xl lg:hidden"
    data-testid="shell-admin-lagi"
  >
    <template v-for="entry in menu.entries" :key="entry.id">
      <p
        v-if="entry.kind === 'heading'"
        class="px-4 pt-3 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase"
        :data-lagi-heading="entry.label"
      >
        {{ entry.label }}
      </p>
      <ShellLink
        v-else
        :to="entry.to"
        :class="[
          ROW,
          isActive(entry) ? 'active bg-indigo-50 font-semibold text-indigo-600' : 'text-slate-700',
        ]"
        :data-lagi-id="entry.id"
      >
        <NavIcon :fa="entry.fa" :class="`w-4 text-center ${entry.colour}`" />
        <span class="min-w-0">{{ entry.label }}</span>
      </ShellLink>
    </template>

    <div class="mt-1 border-t border-slate-100" data-testid="shell-admin-lagi-tail">
      <ShellLink
        v-for="row in menu.tail"
        :key="row.id"
        :to="row.to"
        :class="[ROW, 'text-slate-700']"
        :data-lagi-id="row.id"
      >
        <NavIcon :fa="row.fa" :class="`w-4 text-center ${row.colour}`" />
        <span :class="row.colour">{{ row.label }}</span>
      </ShellLink>
    </div>
  </div>
</template>
