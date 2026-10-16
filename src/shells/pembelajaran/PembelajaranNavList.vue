<script setup lang="ts">
/**
 * One menu list for the Pembelajaran sidebar (>= lg) and the "Lagi" panel (< lg). It renders the
 * entries it is given (already role- and scope-filtered by `pembelajaran-nav.ts`); the active item
 * is the filled gradient pill (learner) or the tonal row (staff).
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { DsIcon } from '@/ds'
import type { NavEntry, NavItem } from '@/shells/nav/user-nav'

import { iconFor, itemActive } from './pembelajaran-nav'

const props = defineProps<{
  entries: readonly NavEntry[]
  currentPath: string
  learner: boolean
}>()

const emit = defineEmits<{ navigate: [] }>()

interface Row {
  key: string
  kind: 'heading' | 'item'
  label: string
  item?: NavItem
  child?: boolean
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []
  for (const entry of props.entries) {
    if (entry.kind === 'section' || entry.kind === 'subheading') {
      out.push({ key: entry.id, kind: 'heading', label: entry.label })
    } else if (entry.kind === 'item') {
      out.push({ key: entry.id, kind: 'item', label: entry.label, item: entry })
    } else {
      out.push({ key: entry.id, kind: 'heading', label: entry.label })
      for (const child of entry.children) {
        out.push({ key: child.id, kind: 'item', label: child.label, item: child, child: true })
      }
    }
  }
  return out
})
</script>

<template>
  <ul class="flex flex-col gap-1" data-testid="pembelajaran-nav">
    <template v-for="row in rows" :key="row.key">
      <li
        v-if="row.kind === 'heading'"
        class="px-3 pt-4 pb-1 text-overline text-muted"
        role="presentation"
      >
        {{ row.label }}
      </li>
      <li v-else-if="row.item">
        <RouterLink
          :to="row.item.to"
          :target="row.item.target"
          class="flex min-h-11 items-center gap-3 rounded-chip px-3 text-label"
          :class="[
            row.child ? 'ms-4' : '',
            itemActive(row.item, currentPath)
              ? learner
                ? 'bg-gradient-primary font-semibold text-primary-on'
                : 'bg-primary/10 font-semibold text-highlighted'
              : 'text-toned hover:bg-elevated',
          ]"
          :aria-current="itemActive(row.item, currentPath) ? 'page' : undefined"
          :data-nav-id="row.item.id"
          @click="emit('navigate')"
        >
          <DsIcon
            v-if="iconFor(row.item.id)"
            :name="iconFor(row.item.id)!"
            class="size-5 shrink-0"
          />
          <span class="min-w-0 truncate">{{ row.label }}</span>
          <span
            v-if="row.item.badge"
            class="ms-auto shrink-0 rounded-full bg-elevated px-2 text-caption text-muted"
            >{{ row.item.badge.text }}</span
          >
        </RouterLink>
      </li>
    </template>
  </ul>
</template>
