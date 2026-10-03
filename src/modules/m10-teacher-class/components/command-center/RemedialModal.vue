<script setup lang="ts">
/**
 * "🔬 Remedial" -> "Smart Remedial — Scan Pelajar Lemah" (FR-M10-22, FR-M10-23, FN-M10-2.2.10, 2.2.11,
 * BR-M10-11/12): the scan works (DV-M10-03); per weak student either the open test ("Lihat Quiz ({n} soalan)"
 * + "Batal & Jana Semula") or one "Jana {Subjek}" button per weak subject. A failed scan shows "Ralat: {message}".
 */
import { computed, reactive, watch } from 'vue'

import { isApiError } from '@/api'
import { confirmNative, useApi } from '@/composables'

import {
  cancelRemedialTest,
  fetchRemedialScan,
  generateRemedialTest,
} from '../../api/command-center'
import type { CcExistingRemedial, CcWeakStudent } from '../../api/command-center-types'
import { useOpenTab } from './composables'
import { plain, remedialPath, studentPath, TBL } from './copy'
import DarkModal from './DarkModal.vue'

defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchRemedialScan({ signal }))
const openTab = useOpenTab()

interface RowState {
  /** Subjects whose "Jana" request is running. */
  busy: Record<string, boolean>
  /** Generated tests by subject. */
  made: Record<string, { quizId: number; total: number }>
  /** Error text under the buttons, by subject. */
  failed: Record<string, string>
  cancelling: boolean
  cancelled: boolean
  cancelText: string
}
const rows = reactive<Record<number, RowState>>({})
function state(studentId: number): RowState {
  rows[studentId] ??= {
    busy: {},
    made: {},
    failed: {},
    cancelling: false,
    cancelled: false,
    cancelText: '',
  }
  return rows[studentId]
}

// The row states exist before the first render of the table (no write while rendering).
watch(
  data,
  (d) => {
    for (const s of d?.weakStudents ?? []) state(s.studentId)
  },
  { immediate: true },
)

const HEADERS = ['Pelajar', 'Topik Lemah', 'Accuracy Terendah', 'Tindakan']
const weak = computed(() => data.value?.weakStudents ?? [])
const subjectsOf = (s: CcWeakStudent) => [...new Set(s.weakTopics.map((t) => t.subject))]
/** The open (active) test of a student, unless cancelled here (FN-M10-2.2.11). */
const activeTestOf = (studentId: number) =>
  data.value?.existingRemedials.find(
    (r) => r.studentId === studentId && r.status === 'active' && !state(studentId).cancelled,
  )
/** The latest completed test: "Selesai ({x}%)"; the teacher can still generate a new one. */
const doneTestOf = (studentId: number) =>
  data.value?.existingRemedials
    .filter((r) => r.studentId === studentId && r.status === 'completed')
    .reduce<CcExistingRemedial | undefined>((a, r) => (a && a.id > r.id ? a : r), undefined)

async function generate(s: CcWeakStudent, subject: string) {
  const st = state(s.studentId)
  st.busy[subject] = true
  st.failed[subject] = ''
  try {
    const res = await generateRemedialTest({ studentId: s.studentId, subject })
    // a body without a test id is "Gagal"
    if (res.quizId) st.made[subject] = { quizId: res.quizId, total: res.totalQuestions }
    else st.failed[subject] = 'Gagal'
  } catch (err) {
    st.failed[subject] = isApiError(err) ? err.message || 'Gagal' : 'Ralat'
  } finally {
    st.busy[subject] = false
  }
}

async function cancel(s: CcWeakStudent, quizId: number) {
  if (
    !confirmNative(`Batal set soalan remedial untuk ${s.name}? Anda boleh jana semula selepas ini.`)
  )
    return
  const st = state(s.studentId)
  st.cancelling = true
  try {
    await cancelRemedialTest(quizId)
    st.cancelled = true
    st.cancelText = 'Dibatalkan — boleh jana semula'
  } catch (err) {
    st.cancelText = isApiError(err) ? 'Gagal — cuba lagi' : 'Ralat — cuba lagi'
  } finally {
    st.cancelling = false
  }
}

const BTN =
  'inline-flex min-h-11 items-center rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-3 py-2 text-sm font-semibold whitespace-nowrap text-indigo-200 hover:bg-indigo-500/25 disabled:opacity-60'
const LINK = 'text-sm font-semibold text-emerald-300 underline hover:text-emerald-200'
</script>

<template>
  <DarkModal
    title="Smart Remedial — Scan Pelajar Lemah"
    testid="cc-remedial-modal"
    wide
    @close="$emit('close')"
  >
    <p v-if="error" class="text-sm text-rose-400" data-testid="cc-remedial-error">
      Ralat: {{ error.message }}
    </p>
    <p v-else-if="!data" class="text-sm text-slate-300" data-testid="cc-modal-loading">
      Mengimbas topik lemah pelajar...
    </p>
    <p
      v-else-if="weak.length === 0"
      class="text-base text-slate-50"
      data-testid="cc-remedial-empty"
    >
      Tiada pelajar dengan topik lemah (&lt;50% accuracy). Tahniah!
    </p>
    <template v-else>
      <p class="mb-3 text-sm text-slate-300" data-testid="cc-remedial-count">
        {{ weak.length }} pelajar dikesan lemah dalam topik tertentu (accuracy &lt;50%)
      </p>
      <div :class="TBL.wrap">
        <table :class="TBL.table" data-testid="cc-remedial-table">
          <thead>
            <tr>
              <th v-for="h in HEADERS" :key="h" :class="TBL.th">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in weak" :key="s.studentId" :class="TBL.row" data-testid="cc-remedial-row">
              <td :class="TBL.td">
                <button
                  type="button"
                  class="min-h-11 text-left font-semibold text-slate-50 hover:underline"
                  data-testid="cc-remedial-student"
                  @click="openTab(studentPath(s.studentId))"
                >
                  {{ s.name }}
                </button>
              </td>
              <td :class="TBL.td">
                <div v-for="(t, i) in s.weakTopics" :key="i">
                  {{ t.topicName }} ({{ plain(t.accuracy) }}%)
                </div>
              </td>
              <td :class="[TBL.td, 'font-mono text-rose-400']">{{ plain(s.weakestAccuracy) }}%</td>
              <td :class="TBL.td" data-testid="cc-remedial-actions">
                <template v-if="activeTestOf(s.studentId)">
                  <div class="flex flex-wrap items-center gap-2">
                    <a
                      :href="remedialPath(activeTestOf(s.studentId)!.id)"
                      target="_blank"
                      rel="noopener"
                      :class="LINK"
                      data-testid="cc-remedial-view"
                      >Lihat Quiz ({{ activeTestOf(s.studentId)!.totalQuestions }} soalan)</a
                    >
                    <button
                      type="button"
                      :class="BTN"
                      :disabled="state(s.studentId).cancelling"
                      data-testid="cc-remedial-cancel"
                      @click="cancel(s, activeTestOf(s.studentId)!.id)"
                    >
                      {{ state(s.studentId).cancelling ? 'Membatal...' : 'Batal & Jana Semula' }}
                    </button>
                  </div>
                  <p
                    v-if="state(s.studentId).cancelText"
                    class="mt-1 text-sm text-amber-300"
                    data-testid="cc-remedial-cancel-text"
                  >
                    {{ state(s.studentId).cancelText }}
                  </p>
                </template>
                <template v-else>
                  <a
                    v-if="doneTestOf(s.studentId)"
                    :href="remedialPath(doneTestOf(s.studentId)!.id)"
                    target="_blank"
                    rel="noopener"
                    :class="[LINK, 'mb-1 inline-block']"
                    data-testid="cc-remedial-done"
                    >Selesai ({{ plain(doneTestOf(s.studentId)!.afterAccuracy ?? 0) }}%)</a
                  >
                  <p
                    v-if="state(s.studentId).cancelText"
                    class="mb-1 text-sm text-emerald-300"
                    data-testid="cc-remedial-cancel-text"
                  >
                    {{ state(s.studentId).cancelText }}
                  </p>
                  <div class="flex flex-wrap items-start gap-2">
                    <div v-for="subject in subjectsOf(s)" :key="subject">
                      <a
                        v-if="state(s.studentId).made[subject]"
                        :href="remedialPath(state(s.studentId).made[subject]!.quizId)"
                        target="_blank"
                        rel="noopener"
                        :class="LINK"
                        data-testid="cc-remedial-made"
                        >{{ subject }} ({{ state(s.studentId).made[subject]!.total }})</a
                      >
                      <button
                        v-else
                        type="button"
                        :class="BTN"
                        :disabled="state(s.studentId).busy[subject]"
                        data-testid="cc-remedial-generate"
                        @click="generate(s, subject)"
                      >
                        {{ state(s.studentId).busy[subject] ? 'Menjana...' : `Jana ${subject}` }}
                      </button>
                      <p
                        v-if="state(s.studentId).failed[subject]"
                        class="mt-1 text-sm text-amber-300"
                        data-testid="cc-remedial-gen-error"
                      >
                        {{ state(s.studentId).failed[subject] }}
                      </p>
                    </div>
                  </div>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </DarkModal>
</template>
