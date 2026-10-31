<script setup lang="ts">
/**
 * "Dilihat murid di" (design 9.2, AC-04.1): summary "Dilihat murid di {x} daripada 7 aktiviti" and the
 * seven-family list behind a disclosure. Each row = family name, state (icon + word, never colour only)
 * and, for a hidden family, the reason sentence (+ optional action). Presentational: the rows are
 * computed upstream (FE-P1 `servable()`); this component only counts and displays.
 */
import { computed, ref } from 'vue'

import { DsLoadError } from '@/ds'

import { qdCopy, visibleSummary } from './copy'
import type { VisibilityRowData } from './types'

const props = withDefaults(
  defineProps<{
    rows: VisibilityRowData[]
    loading?: boolean
    error?: boolean
    /** Start with the list open. */
    expanded?: boolean
    /** `false` = list only, no summary + disclosure (e.g. a dedicated panel). */
    collapsible?: boolean
  }>(),
  { loading: false, error: false, expanded: false, collapsible: true },
)
const emit = defineEmits<{ retry: []; action: [family: string] }>()

const open = ref(props.expanded)
const visibleCount = computed(() => props.rows.filter((r) => r.visible).length)
const summary = computed(() => visibleSummary(visibleCount.value, props.rows.length || 7))
const listId = `vis-${Math.random().toString(36).slice(2, 8)}`
const showList = computed(() => !props.collapsible || open.value)
</script>

<template>
  <section class="flex flex-col gap-2" :aria-label="qdCopy.visibleTitle" data-testid="visibility">
    <DsLoadError v-if="error" variant="inline" testid="visibility-error" @retry="emit('retry')" />
    <template v-else>
      <div v-if="collapsible" class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-body text-default" data-testid="visibility-summary">
          <template v-if="loading">{{ qdCopy.visibleTitle }}…</template>
          <template v-else>{{ summary }}</template>
        </p>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          :aria-expanded="open"
          :aria-controls="listId"
          :disabled="loading"
          data-testid="visibility-toggle"
          @click="open = !open"
          >{{ open ? qdCopy.hide : qdCopy.show }}</UButton
        >
      </div>

      <ul
        v-if="loading"
        class="flex flex-col gap-2"
        aria-busy="true"
        data-testid="visibility-skeleton"
      >
        <li v-for="i in 7" :key="i" class="h-11 animate-pulse rounded-xl bg-muted" />
      </ul>
      <ul
        v-else-if="showList"
        :id="listId"
        class="flex flex-col gap-2"
        data-testid="visibility-list"
      >
        <li
          v-for="r in rows"
          :key="r.family"
          class="flex flex-col gap-1 rounded-xl bg-muted p-3 sm:flex-row sm:items-start sm:gap-4"
          :data-testid="`vis-${r.family}`"
          :data-visible="r.visible"
        >
          <span class="text-label text-highlighted sm:w-1/3">{{ r.name }}</span>
          <span class="flex min-w-0 grow flex-col gap-1">
            <span
              class="flex items-center gap-1 text-label"
              :class="r.visible ? 'text-success' : 'text-warning'"
            >
              <UIcon
                :name="r.visible ? 'i-ph-check-circle' : 'i-ph-x-circle'"
                class="size-5 shrink-0"
                aria-hidden="true"
              />
              {{ r.visible ? qdCopy.canSee : qdCopy.cannotSee }}
            </span>
            <span
              v-if="!r.visible && r.reason"
              class="text-caption text-toned"
              data-testid="vis-reason"
            >
              {{ r.reason }}
            </span>
            <UButton
              v-if="!r.visible && r.actionLabel"
              type="button"
              color="neutral"
              variant="soft"
              class="min-h-11 self-start"
              data-testid="vis-action"
              @click="emit('action', r.family)"
              >{{ r.actionLabel }}</UButton
            >
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>
