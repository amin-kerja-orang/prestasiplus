<script setup lang="ts">
/**
 * "Remedial" -> "Smart Remedial — Scan Pelajar Lemah" (FR-M10-22, FR-M10-23, FN-M10-2.2.10, 2.2.11,
 * BR-M10-11/12): the scan works (DV-M10-03); per weak student either the open test ("Lihat Quiz ({n} soalan)"
 * + "Batal & Jana Semula") or one "Jana {Subjek}" button per weak subject. A failed scan shows "Ralat: {message}".
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, reactive, watch } from 'vue'

import { isApiError } from '@/api'
import { confirmNative, useApi } from '@/composables'
import { DsDrillTable } from '@/ds'

import {
  cancelRemedialTest,
  fetchRemedialScan,
  generateRemedialTest,
} from '../../api/command-center'
import type { CcExistingRemedial, CcWeakStudent } from '../../api/command-center-types'
import CcDialog from './CcDialog.vue'
import { useOpenTab } from './composables'
import { plain, remedialPath, studentPath } from './copy'

/** The DS table wants an index signature, which a mapped alias gives an interface. */
type Row = { [K in keyof CcWeakStudent]: CcWeakStudent[K] }

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

const columns: TableColumn<Row>[] = [
  { id: 'name', header: 'Pelajar' },
  { id: 'topics', header: 'Topik Lemah' },
  { id: 'low', header: 'Accuracy Terendah' },
  { id: 'act', header: 'Tindakan' },
]
const weak = computed(() => data.value?.weakStudents ?? [])
const subjectsOf = (s: Row) => [...new Set(s.weakTopics.map((t) => t.subject))]
/** The open (active) test of a student, unless cancelled here (FN-M10-2.2.11). */
const activeTestOf = (studentId: number) =>
  data.value?.existingRemedials.find(
    (r) => r.studentId === studentId && r.status === 'active' && !state(studentId).cancelled,
  )
/**
 * Whether test id `a` is later than `b`. Ids are numbers in mock mode and digit strings in http mode
 * (a plain `>` on strings would put "9" after "10"); the scan has no date, so the id orders them.
 * Opaque non-digit ids fall back to a text comparison.
 */
function isLaterId(a: number | string, b: number | string): boolean {
  const x = String(a)
  const y = String(b)
  if (/^\d+$/.test(x) && /^\d+$/.test(y)) return BigInt(x) > BigInt(y)
  return x > y
}
/** The latest completed test: "Selesai ({x}%)"; the teacher can still generate a new one. */
const doneTestOf = (studentId: number) =>
  data.value?.existingRemedials
    .filter((r) => r.studentId === studentId && r.status === 'completed')
    .reduce<CcExistingRemedial | undefined>(
      (a, r) => (a && isLaterId(a.id, r.id) ? a : r),
      undefined,
    )

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
</script>

<template>
  <CcDialog
    title="Smart Remedial — Scan Pelajar Lemah"
    testid="cc-remedial-modal"
    wide
    @close="$emit('close')"
  >
    <p v-if="error" class="text-body text-error" data-testid="cc-remedial-error">
      Ralat: {{ error.message }}
    </p>
    <p v-else-if="!data" class="text-body text-muted" data-testid="cc-modal-loading">
      Mengimbas topik lemah pelajar...
    </p>
    <p
      v-else-if="weak.length === 0"
      class="text-body text-highlighted"
      data-testid="cc-remedial-empty"
    >
      Tiada pelajar dengan topik lemah (&lt;50% accuracy). Tahniah!
    </p>
    <template v-else>
      <p class="text-body text-toned" data-testid="cc-remedial-count">
        {{ weak.length }} pelajar dikesan lemah dalam topik tertentu (accuracy &lt;50%)
      </p>
      <div data-testid="cc-remedial-table">
        <DsDrillTable :data="weak" :columns="columns" caption="Smart Remedial — Scan Pelajar Lemah">
          <template #name-cell="{ row }">
            <UButton
              variant="link"
              color="neutral"
              class="h-auto p-0 text-start"
              :label="row.original.name"
              data-testid="cc-remedial-student"
              @click.stop="openTab(studentPath(row.original.studentId))"
            />
            <span class="sr-only" data-testid="cc-remedial-row" />
          </template>
          <template #topics-cell="{ row }">
            <div v-for="(t, i) in row.original.weakTopics" :key="i" class="text-body">
              {{ t.topicName }} ({{ plain(t.accuracy) }}%)
            </div>
          </template>
          <template #low-cell="{ row }">
            <span class="tabular text-error">{{ plain(row.original.weakestAccuracy) }}%</span>
          </template>
          <template #act-cell="{ row }">
            <div data-testid="cc-remedial-actions" class="flex min-w-0 flex-col gap-2">
              <template v-if="activeTestOf(row.original.studentId)">
                <div class="flex flex-wrap items-center gap-2">
                  <UButton
                    :to="remedialPath(activeTestOf(row.original.studentId)!.id)"
                    target="_blank"
                    rel="noopener"
                    variant="link"
                    color="success"
                    :label="`Lihat Quiz (${activeTestOf(row.original.studentId)!.totalQuestions} soalan)`"
                    data-testid="cc-remedial-view"
                  />
                  <UButton
                    color="primary"
                    variant="soft"
                    :loading="state(row.original.studentId).cancelling"
                    :label="
                      state(row.original.studentId).cancelling
                        ? 'Membatal...'
                        : 'Batal & Jana Semula'
                    "
                    data-testid="cc-remedial-cancel"
                    @click="cancel(row.original, activeTestOf(row.original.studentId)!.id)"
                  />
                </div>
                <p
                  v-if="state(row.original.studentId).cancelText"
                  class="text-body text-warning"
                  data-testid="cc-remedial-cancel-text"
                >
                  {{ state(row.original.studentId).cancelText }}
                </p>
              </template>
              <template v-else>
                <UButton
                  v-if="doneTestOf(row.original.studentId)"
                  :to="remedialPath(doneTestOf(row.original.studentId)!.id)"
                  target="_blank"
                  rel="noopener"
                  variant="link"
                  color="success"
                  class="w-fit"
                  :label="`Selesai (${plain(doneTestOf(row.original.studentId)!.afterAccuracy ?? 0)}%)`"
                  data-testid="cc-remedial-done"
                />
                <p
                  v-if="state(row.original.studentId).cancelText"
                  class="text-body text-success"
                  data-testid="cc-remedial-cancel-text"
                >
                  {{ state(row.original.studentId).cancelText }}
                </p>
                <div class="flex flex-wrap items-start gap-2">
                  <div v-for="subject in subjectsOf(row.original)" :key="subject">
                    <UButton
                      v-if="state(row.original.studentId).made[subject]"
                      :to="remedialPath(state(row.original.studentId).made[subject]!.quizId)"
                      target="_blank"
                      rel="noopener"
                      variant="link"
                      color="success"
                      :label="`${subject} (${state(row.original.studentId).made[subject]!.total})`"
                      data-testid="cc-remedial-made"
                    />
                    <UButton
                      v-else
                      color="primary"
                      variant="soft"
                      :loading="state(row.original.studentId).busy[subject]"
                      :label="
                        state(row.original.studentId).busy[subject]
                          ? 'Menjana...'
                          : `Jana ${subject}`
                      "
                      data-testid="cc-remedial-generate"
                      @click="generate(row.original, subject)"
                    />
                    <p
                      v-if="state(row.original.studentId).failed[subject]"
                      class="text-body text-warning"
                      data-testid="cc-remedial-gen-error"
                    >
                      {{ state(row.original.studentId).failed[subject] }}
                    </p>
                  </div>
                </div>
              </template>
            </div>
          </template>
        </DsDrillTable>
      </div>
    </template>
  </CcDialog>
</template>
