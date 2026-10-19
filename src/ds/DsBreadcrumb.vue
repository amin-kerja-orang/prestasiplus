<script setup lang="ts">
/**
 * Breadcrumb: links, a separator and the current page as plain text (`aria-current="page"`, the
 * last item). Below `md` only the last two items stay inline; the earlier ones sit behind an
 * overflow menu. One `nav`, no `h1`.
 */
import { computed } from 'vue'
import type { DropdownMenuItem } from '@nuxt/ui'
import type { RouteLocationRaw } from 'vue-router'

import { dsCopy } from './copy'

export interface CrumbItem {
  label: string
  to?: RouteLocationRaw
}

const props = withDefaults(
  defineProps<{ items: readonly CrumbItem[]; ariaLabel?: string; moreLabel?: string }>(),
  { ariaLabel: dsCopy.breadcrumbAria, moreLabel: dsCopy.breadcrumbMore },
)

const hiddenCount = computed(() => Math.max(0, props.items.length - 2))
const overflow = computed<DropdownMenuItem[]>(() =>
  props.items.slice(0, hiddenCount.value).map((i) => ({ label: i.label, to: i.to })),
)
</script>

<template>
  <nav :aria-label="ariaLabel" class="min-w-0" data-ds="breadcrumb">
    <ol class="flex min-w-0 flex-wrap items-center gap-x-1 text-body">
      <li v-if="hiddenCount > 0" class="flex items-center gap-1 md:hidden">
        <UDropdownMenu :items="overflow">
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-ph-dots-three"
            :aria-label="moreLabel"
            class="min-h-11 min-w-11"
            data-ds="breadcrumb-more"
          />
        </UDropdownMenu>
        <UIcon name="i-ph-caret-right" class="size-4 text-dimmed" aria-hidden="true" />
      </li>
      <li
        v-for="(item, i) in items"
        :key="i"
        class="min-w-0 items-center gap-1"
        :class="i < hiddenCount ? 'hidden md:flex' : 'flex'"
        data-ds="breadcrumb-item"
      >
        <span
          v-if="i === items.length - 1 || !item.to"
          class="truncate text-label text-highlighted"
          :aria-current="i === items.length - 1 ? 'page' : undefined"
          >{{ item.label }}</span
        >
        <template v-else>
          <UButton
            :to="item.to"
            color="neutral"
            variant="link"
            :label="item.label"
            class="min-h-11 text-muted"
          />
          <UIcon name="i-ph-caret-right" class="size-4 shrink-0 text-dimmed" aria-hidden="true" />
        </template>
      </li>
    </ol>
  </nav>
</template>
