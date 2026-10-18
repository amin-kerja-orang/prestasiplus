<script setup lang="ts">
/**
 * The nine Pentadbiran groups (design v2-shells 2.2) for the sidebar and the mobile drawer. A group
 * row is an coloured icon chip plus label; its items open below. The active item is an A1 gradient pill.
 */
import { RouterLink } from 'vue-router'

import { DsIcon } from '@/ds'

import { groupChipClass } from './group-accent'
import type { PentadbiranGroup, PentadbiranItem } from './menu'

defineProps<{
  groups: readonly PentadbiranGroup[]
  activeId: string | undefined
  activeGroup: string | undefined
  isOpen: (key: string) => boolean
}>()

const emit = defineEmits<{ toggle: [key: string]; navigate: [] }>()

/** Items of a group, with the second-level heading printed before its first item. */
function showSub(items: readonly PentadbiranItem[], index: number): boolean {
  const sub = items[index]?.sub
  return sub !== undefined && items[index - 1]?.sub !== sub
}
</script>

<template>
  <ul class="flex flex-col gap-1" data-testid="pentadbiran-nav">
    <li v-for="group in groups" :key="group.key">
      <button
        type="button"
        class="flex min-h-11 w-full items-center gap-3 rounded-chip px-2 text-start text-label hover:bg-soft"
        :class="activeGroup === group.key ? 'font-semibold text-highlighted' : 'text-default'"
        :aria-expanded="isOpen(group.key)"
        :data-group="group.key"
        @click="emit('toggle', group.key)"
      >
        <span
          class="grid size-8 shrink-0 place-items-center rounded-chip shadow-ds-xs"
          :class="groupChipClass(group.key)"
        >
          <DsIcon :name="group.icon" class="size-5" />
        </span>
        <span class="min-w-0 flex-1 truncate">{{ group.label }}</span>
        <DsIcon
          name="caret-down"
          class="size-4 shrink-0 text-muted transition-transform"
          :class="isOpen(group.key) ? 'rotate-180' : ''"
        />
      </button>
      <ul v-if="isOpen(group.key)" class="mt-1 mb-2 flex flex-col gap-0.5 ps-12">
        <template v-for="(item, i) in group.items" :key="item.id">
          <li
            v-if="showSub(group.items, i)"
            class="px-3 pt-2 pb-1 text-overline text-muted"
            role="presentation"
          >
            {{ item.sub }}
          </li>
          <li>
            <RouterLink
              :to="item.to"
              class="flex min-h-11 items-center rounded-chip px-3 text-label"
              :class="
                item.id === activeId
                  ? 'bg-gradient-primary font-semibold text-primary-on shadow-cta'
                  : 'text-toned hover:bg-soft hover:text-highlighted'
              "
              :aria-current="item.id === activeId ? 'page' : undefined"
              :data-nav-id="item.id"
              :title="item.label"
              @click="emit('navigate')"
            >
              <span class="truncate">{{ item.label }}</span>
            </RouterLink>
          </li>
        </template>
      </ul>
    </li>
  </ul>
</template>
