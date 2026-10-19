<script setup lang="ts">
/**
 * E2E harness for the S14 `ReportQuestionModal` (SRS SQ-2: E2E-M04-36..38 and 63 use a harness page
 * until the M05 / M06 hosts exist). Registered only in builds with the test hooks
 * (`VITE_TEST_HOOKS=true`: dev and the e2e build), never in the demo build.
 *
 * Query: `variant` (`mcq` default | `structured`), `questionId`, `source`, `failureText`, `session`.
 */
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

import type { ReportSource } from '../api/reports'
import ReportQuestionModal from '../components/report/ReportQuestionModal.vue'
import type { ReportVariant } from '../lib/report-reasons'
import { queryText } from '../lib/route-query'

const route = useRoute()
const open = ref(false)
const last = ref('')

const variant = computed<ReportVariant>(() =>
  queryText(route.query.variant) === 'structured' ? 'structured' : 'mcq',
)
const questionId = computed(() => Number(queryText(route.query.questionId)) || 564161)
const source = computed(
  () => (queryText(route.query.source) || undefined) as ReportSource | undefined,
)
const failureText = computed(() => queryText(route.query.failureText) || undefined)
const session = computed(() => queryText(route.query.session) || null)

function onReported(result: { ok: boolean; message: string }): void {
  last.value = `${result.ok ? 'ok' : 'gagal'}: ${result.message}`
}
</script>

<template>
  <div class="rounded-2xl bg-white p-5 shadow" data-testid="report-harness">
    <p class="mb-3 text-sm text-slate-500">Soalan #{{ questionId }} ({{ variant }})</p>
    <button
      v-if="variant === 'mcq'"
      type="button"
      class="min-h-11 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-bold text-white"
      data-testid="harness-open"
      @click="open = true"
    >
      Lapor Soalan
    </button>
    <button
      v-else
      type="button"
      title="Lapor soalan ini"
      class="min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600"
      data-testid="harness-open"
      @click="open = true"
    >
      Lapor
    </button>
    <p class="mt-3 text-xs text-slate-500" data-testid="harness-result">{{ last }}</p>
    <ReportQuestionModal
      v-model:open="open"
      :question-id="questionId"
      :variant="variant"
      :quiz-session-id="session"
      :source="source"
      :failure-text="failureText"
      @reported="onReported"
    />
  </div>
</template>
