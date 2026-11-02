<script setup lang="ts">
/**
 * Result of "Luluskan Hasil Tapisan" / "Arkib Semua" (S3.2, AC-03.3): the success banner, the notes
 * (skipped / remaining) and, when the gate refused rows, a warning panel with up to 10 rows
 * "Soalan #{id} — {sebab}" and a "Lihat {m - 10} lagi" expander; each row links to the Studio editor.
 */
import { computed, ref } from 'vue'

import type { QuestionFilterAction, QuestionFilterBulkResult } from '../api/questions'
import {
  BULK_FILTER_FAILED_SHOWN,
  bulkFilterFailedHeading,
  bulkFilterNotes,
  bulkFilterSuccess,
} from '../lib/bulk-filter'

const props = defineProps<{ action: QuestionFilterAction; result: QuestionFilterBulkResult }>()

const showAll = ref(false)
const failed = computed(() => props.result.failed)
const hidden = computed(() => Math.max(0, failed.value.length - BULK_FILTER_FAILED_SHOWN))
const shown = computed(() => (showAll.value ? failed.value : failed.value.slice(0, BULK_FILTER_FAILED_SHOWN)))
const notes = computed(() => bulkFilterNotes(props.result))
const studioPath = (id: string): string => `/admin/studio/questions/${id}/sunting`
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="bulk-filter-result">
    <UAlert color="success" variant="subtle" icon="i-ph-check-circle" role="status" data-testid="bulk-filter-success">
      <template #description>
        <p>{{ bulkFilterSuccess(action, result.affected) }}</p>
        <p v-for="(n, i) in notes" :key="i" data-testid="bulk-filter-note">{{ n }}</p>
      </template>
    </UAlert>

    <UAlert
      v-if="failed.length > 0"
      color="warning"
      variant="subtle"
      icon="i-ph-warning"
      role="status"
      data-testid="bulk-filter-failed"
    >
      <template #description>
        <p class="font-medium">{{ bulkFilterFailedHeading(action, failed.length) }}</p>
        <ul class="mt-2 flex flex-col gap-1">
          <li v-for="f in shown" :key="f.id" class="break-words" data-testid="bulk-filter-failed-row">
            <RouterLink
              :to="studioPath(f.id)"
              class="inline-flex min-h-11 items-center underline"
            >
              Soalan #{{ f.id }}
            </RouterLink>
            — {{ f.message }}
          </li>
        </ul>
        <UButton
          v-if="hidden > 0 && !showAll"
          variant="link"
          class="min-h-11"
          data-testid="bulk-filter-failed-more"
          @click="showAll = true"
        >
          Lihat {{ hidden }} lagi
        </UButton>
      </template>
    </UAlert>
  </div>
</template>
