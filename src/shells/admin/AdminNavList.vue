<script setup lang="ts">
/**
 * Sidebar menu (≥ lg) of the admin shell, rendered from the nav data (`adminMenuFor`, shells.md
 * §2.2, §2.6): pinned items, section headers, collapsible groups and items. Admin item style for
 * every entry, also for the teacher variant (the Pusat AI block and "Audio KBAT" are not drawn
 * smaller here; nav tooltips are not rendered). Exactly one item is active (`activeId`, §2.8).
 */
import type { AdminNavEntry, AdminNavItem } from '@/shells/nav/admin-nav'
import NavIcon from '@/shells/shared/NavIcon.vue'
import ShellLink from '@/shells/shared/ShellLink.vue'
import { useShellStore } from '@/stores/shell'

defineProps<{
  entries: readonly AdminNavEntry[]
  activeId: string | null
}>()

const shell = useShellStore()

const PUSAT_AI_TITLE_STYLE =
  'background: linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899); -webkit-background-clip: text; background-clip: text; color: transparent;'

const ITEM = 'nav-item flex items-center gap-3 px-4 py-2.5 text-sm'

/** Label classes: pinned items carry their own colour and `font-semibold`. */
function labelClass(entry: AdminNavItem, active: boolean): string {
  if (active) return 'font-semibold'
  return entry.textClass ? `font-semibold ${entry.textClass}` : 'font-medium text-slate-500'
}
</script>

<template>
  <template v-for="entry in entries" :key="entry.id">
    <!-- Pusat AI header of the teacher menu (gradient title, one shared partial) -->
    <div
      v-if="entry.kind === 'section' && entry.variant === 'gradient'"
      class="pt-4 pb-2"
      :data-nav-id="entry.id"
    >
      <div class="flex items-center gap-2 px-4">
        <span class="text-xs font-extrabold tracking-wider uppercase" :style="PUSAT_AI_TITLE_STYLE">
          {{ entry.label }}
        </span>
        <div :class="`h-[2px] flex-1 bg-gradient-to-r ${entry.rule} rounded-full to-transparent`" />
        <span v-if="entry.badge" :class="entry.badge.cls">{{ entry.badge.text }}</span>
      </div>
    </div>

    <!-- Section header: label, gradient rule, optional pill (the DEV pill sits after the rule) -->
    <div v-else-if="entry.kind === 'section'" class="pt-4 pb-2" :data-nav-id="entry.id">
      <div class="flex items-center gap-2 px-4">
        <span :class="`text-xs font-extrabold ${entry.text} tracking-wider uppercase`">
          {{ entry.label }}
        </span>
        <div :class="`h-[2px] flex-1 bg-gradient-to-r ${entry.rule} rounded-full to-transparent`" />
        <span v-if="entry.badge" :class="entry.badge.cls">{{ entry.badge.text }}</span>
      </div>
    </div>

    <!-- Sub-heading (teacher Pusat AI blocks) -->
    <div v-else-if="entry.kind === 'subheading'" class="px-4 pt-3 pb-1" :data-nav-id="entry.id">
      <span :class="entry.cls">{{ entry.label }}</span>
    </div>

    <!-- Collapsible group -->
    <div v-else-if="entry.kind === 'group'" :data-nav-id="entry.id" :data-group-key="entry.key">
      <button
        type="button"
        class="flex w-full items-center gap-3 px-4 py-2.5"
        @click="shell.toggleGroup(entry.key)"
      >
        <NavIcon :fa="entry.fa" :class="`w-5 text-center ${entry.color}`" />
        <span class="flex-1 text-left text-xs font-bold tracking-wider text-slate-500 uppercase">
          {{ entry.label }}
        </span>
        <NavIcon
          fa="fa-chevron-down"
          class="text-xs text-slate-400 transition-transform"
          :class="shell.isGroupOpen(entry.key) && 'rotate-180'"
        />
      </button>
      <div v-show="shell.isGroupOpen(entry.key)" class="space-y-0.5 pl-11">
        <ShellLink
          v-for="child in entry.children"
          :key="child.id"
          :to="child.to"
          class="nav-item flex items-center gap-3 px-4 py-2.5 text-xs"
          :class="child.id === activeId ? 'active font-semibold' : 'font-medium text-slate-500'"
          :data-nav-id="child.id"
        >
          <NavIcon :fa="child.fa" class="w-4 text-center text-slate-400" />
          <span>{{ child.label }}</span>
        </ShellLink>
      </div>
    </div>

    <!-- Command Center card (never active: it opens in a new tab) -->
    <ShellLink
      v-else-if="entry.kind === 'item' && entry.variant === 'command'"
      :to="entry.to"
      :target="entry.target"
      class="mx-0 mb-1 flex items-center gap-3 rounded-xl px-4 py-3 shadow-[0_4px_15px_rgba(99,102,241,0.3)] bg-command-gradient"
      :data-nav-id="entry.id"
    >
      <NavIcon :fa="entry.fa" :class="`w-5 text-center ${entry.color}`" />
      <span class="text-sm font-bold text-white">{{ entry.label }}</span>
      <span v-if="entry.badge" :class="entry.badge.cls">{{ entry.badge.text }}</span>
    </ShellLink>

    <!-- Item -->
    <ShellLink
      v-else-if="entry.kind === 'item'"
      :to="entry.to"
      :target="entry.target"
      :class="[ITEM, { active: entry.id === activeId }]"
      :data-nav-id="entry.id"
    >
      <NavIcon :fa="entry.fa" :class="`w-5 text-center ${entry.color}`" />
      <span :class="labelClass(entry, entry.id === activeId)">{{ entry.label }}</span>
      <span v-if="entry.badge" :class="entry.badge.cls">{{ entry.badge.text }}</span>
    </ShellLink>
  </template>
</template>
