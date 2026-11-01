<script setup lang="ts">
/**
 * Paper level of "Dilihat murid di" (REQ-A-018, AC-04.3 / AC-04.4): every published paper that carries the question, a chip
 * "Boleh dilihat" / "Tidak boleh dilihat" and, when the paper cannot be opened, the reason sentences from the API (the placed
 * question that stops it, `question_missing` included). Self-loading; the activity list stays where it was. Responsive: each
 * paper is a stacked block (title, chip, reasons), nothing scrolls sideways.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsBadge, DsLoadError, DsText } from '@/ds'

import { fetchPaperServability } from '../../api/paper-servability'
import { PAPER_SERVED_COPY, paperServedRows, paperServedSummary } from '../../lib/paper-servability'

const props = defineProps<{ questionId: string | number }>()

const { data, error, loading, reload } = useApi(
  (signal) => fetchPaperServability(props.questionId, signal),
  () => props.questionId,
)
const rows = computed(() => (data.value ? paperServedRows(data.value, String(props.questionId)) : []))
</script>

<template>
  <section class="flex min-w-0 flex-col gap-2" :aria-label="PAPER_SERVED_COPY.heading" data-testid="paper-served">
    <h3 class="m-0 text-label text-highlighted">{{ PAPER_SERVED_COPY.heading }}</h3>
    <DsLoadError
      v-if="error"
      variant="inline"
      :message="PAPER_SERVED_COPY.loadError"
      :retry-label="PAPER_SERVED_COPY.retry"
      testid="paper-served-error"
      @retry="reload()"
    />
    <div v-else-if="loading || !data" class="flex flex-col gap-2" aria-busy="true" data-testid="paper-served-loading">
      <span class="sr-only">{{ PAPER_SERVED_COPY.loading }}</span>
      <USkeleton class="h-11 w-full" />
    </div>
    <DsText v-else-if="rows.length === 0" variant="body" tone="muted" data-testid="paper-served-empty">{{ PAPER_SERVED_COPY.empty }}</DsText>
    <template v-else>
      <DsText variant="caption" tone="muted" data-testid="paper-served-summary">{{ paperServedSummary(rows) }}</DsText>
      <ul class="m-0 flex list-none flex-col gap-2 p-0" data-testid="paper-served-list">
        <li
          v-for="r in rows"
          :key="r.paperId"
          class="flex min-w-0 flex-col gap-1 rounded-xl bg-muted p-3"
          :data-testid="`paper-served-${r.paperId}`"
          :data-served="r.served"
        >
          <div class="flex min-w-0 flex-wrap items-center justify-between gap-2">
            <span class="min-w-0 break-words text-label text-highlighted" data-testid="paper-served-title">{{ r.title }}</span>
            <DsBadge :label="r.chip" :tone="r.served ? 'success' : 'warning'" data-testid="paper-served-chip" />
          </div>
          <ul v-if="r.reasons.length > 0" class="m-0 flex list-none flex-col gap-1 p-0" data-testid="paper-served-reasons">
            <li v-for="x in r.reasons" :key="x.key" class="break-words text-body text-muted">{{ x.text }}</li>
          </ul>
        </li>
      </ul>
    </template>
  </section>
</template>
