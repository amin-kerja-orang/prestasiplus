<script setup lang="ts">
/**
 * Definition list (admin page templates G3): label/value pairs of a detail page or a help panel,
 * rendered as `dl/dt/dd`. `columns="1"` puts the label beside the value from `sm` (above it on a
 * phone); `columns="2"` lays the pairs in two columns from `md`, label above value. A missing value
 * prints `emptyValue` ("-"); a number is formatted ("1,271"). Override one value with the slot
 * `#value-{key}`; `to` turns the value into a link, `mono` sets it in the code face.
 */
import type { RouteLocationRaw } from 'vue-router'

import { dsCopy } from './copy'
import { formatStat } from './format'

export interface DefinitionItem {
  key: string
  label: string
  value?: string | number | null
  to?: RouteLocationRaw
  mono?: boolean
}

withDefaults(
  defineProps<{
    items: readonly DefinitionItem[]
    columns?: 1 | 2
    emptyValue?: string
  }>(),
  { columns: 1, emptyValue: dsCopy.emptyValue },
)
</script>

<template>
  <dl
    class="grid min-w-0 gap-x-8"
    :class="columns === 2 ? 'grid-cols-1 gap-y-4 md:grid-cols-2' : 'grid-cols-1 gap-y-3'"
    :data-columns="columns"
    data-ds="definition-list"
  >
    <div
      v-for="item in items"
      :key="item.key"
      class="grid min-w-0 gap-0.5"
      :class="columns === 1 ? 'sm:grid-cols-12 sm:gap-4' : ''"
      :data-testid="`def-${item.key}`"
    >
      <dt
        class="text-caption font-semibold text-muted sm:text-label sm:font-medium"
        :class="columns === 1 ? 'sm:col-span-4' : ''"
      >{{ item.label }}</dt>
      <dd
        class="min-w-0 text-body break-words text-default"
        :class="[item.mono ? 'font-mono' : '', columns === 1 ? 'sm:col-span-8' : '']"
      >
        <slot :name="`value-${item.key}`" :item="item">
          <template v-if="item.value === null || item.value === undefined || item.value === ''">
            <span class="text-dimmed">{{ emptyValue }}</span>
            <span class="sr-only">{{ dsCopy.emptyNoData }}</span>
          </template>
          <ULink v-else-if="item.to" :to="item.to" class="text-primary hover:underline">
            {{ formatStat(item.value, emptyValue) }}
          </ULink>
          <template v-else>{{ formatStat(item.value, emptyValue) }}</template>
        </slot>
      </dd>
    </div>
  </dl>
</template>
