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
import { DsDrillTable, DsStack, DsCluster, DsText } from '@/ds'

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
</script>

<template>
  <CcDialog
    title="Smart Remedial — Scan Pelajar Lemah"
    testid="cc-remedial-modal"
    wide
    @close="$emit('close')"
  >
    <DsText v-if="error" variant="body" tone="error" data-testid="cc-remedial-error">
      Ralat: {{ error.message }}
    </DsText>
    <DsText v-else-if="!data" variant="body" tone="muted" data-testid="cc-modal-loading">
      Mengimbas topik lemah pelajar...
    </DsText>
    <DsText
      v-else-if="weak.length === 0"
      variant="body"
      tone="highlighted"
      data-testid="cc-remedial-empty"
    >
      Tiada pelajar dengan topik lemah (&lt;50% accuracy). Tahniah!
    </DsText>
    <template v-else>
      <DsText variant="body" tone="toned" data-testid="cc-remedial-count">
        {{ weak.length }} pelajar dikesan lemah dalam topik tertentu (accuracy &lt;50%)
      </DsText>
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
            <DsStack data-testid="cc-remedial-actions" gap="xs">
              <template v-if="activeTestOf(row.original.studentId)">
                <DsCluster gap="xs">
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
                </DsCluster>
                <DsText
                  v-if="state(row.original.studentId).cancelText"
                  variant="body"
                  tone="warning"
                  data-testid="cc-remedial-cancel-text"
                >
                  {{ state(row.original.studentId).cancelText }}
                </DsText>
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
                <DsText
                  v-if="state(row.original.studentId).cancelText"
                  variant="body"
                  tone="success"
                  data-testid="cc-remedial-cancel-text"
                >
                  {{ state(row.original.studentId).cancelText }}
                </DsText>
                <DsCluster gap="xs" align="start">
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
                    <DsText
                      v-if="state(row.original.studentId).failed[subject]"
                      variant="body"
                      tone="warning"
                      data-testid="cc-remedial-gen-error"
                    >
                      {{ state(row.original.studentId).failed[subject] }}
                    </DsText>
                  </div>
                </DsCluster>
              </template>
            </DsStack>
          </template>
        </DsDrillTable>
      </div>
    </template>
  </CcDialog>
</template>
