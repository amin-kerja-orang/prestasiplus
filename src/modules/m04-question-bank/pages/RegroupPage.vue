<script setup lang="ts">
/**
 * The tab `Perlu dikumpulkan semula` of `Senarai Soalan` (R1-ADM-QE-08, PRD45 6.6.2): the frame of the work-list over API-Q-13,
 * with the header counts (API-Q-13 `meta.counts`), the counts per `Subjek` and `Tingkatan`, the `Subjek`, `Tingkatan` and `Sebab`
 * filters in the URL, the pager and the row actions: `Bukan masalah` (API-Q-12, confirm), `Kumpulkan` / `Lampirkan rangsangan`
 * (API-Q-24) and `Buat asal` (API-Q-36). Not built, no contract: the `Kertas sumber` filter, `Cadangan`, `Gabungkan kumpulan`.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useApi } from '@/composables'
import { DsCluster, DsEmptyState, DsFormField, DsLoadError, DsNativeSelect, DsPage, DsStack, DsText, useConfirm } from '@/ds'

import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import { dismissQuestionFlag, fetchRegroupWorklist, regroupQuestions, undoRegroup } from '../api/questions'
import RegroupRow from '../components/RegroupRow.vue'
import { listLoadMessage } from '../lib/list-load'
import { isConsecutiveRun, REGROUP_COPY, REGROUP_FLAGS, REGROUP_PATH, regroupFlagLabel, regroupHeader, type RegroupWorkRow } from '../lib/question-list'
import { errorLines } from '../lib/ui-errors'

const route = useRoute()
const router = useRouter()

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const filters = computed(() => ({
  subjectId: text(route.query.subject_id),
  educationLevelId: text(route.query.education_level_id),
  flag: text(route.query.flag),
}))
const page = computed(() => {
  const n = Number.parseInt(text(route.query.page), 10)
  return Number.isFinite(n) && n > 0 ? n : 1
})

const list = useApi((signal) => fetchRegroupWorklist({ ...filters.value, page: page.value }, { signal }), [filters, page])
const subjects = useApi((signal) => fetchSubjects({ signal }))
const levels = useApi((signal) => fetchEducationLevels({ signal }))

const rows = computed(() => list.data.value?.data ?? [])
const meta = computed(() => list.data.value?.meta)
const counts = computed(() => meta.value?.counts)
const pageCount = computed(() => (meta.value ? Math.max(1, meta.value.totalPages) : 1))

/** `Subjek` and `Tingkatan` counts of the whole filter, named from the lookups (API-Q-13 keys them by id). */
const nameOf = (options: { id: number | string; name: string }[] | undefined, id: string): string => options?.find((o) => String(o.id) === id)?.name ?? `#${id}`
const subjectCounts = computed(() => Object.entries(counts.value?.bySubject ?? {}).map(([id, n]) => ({ id, name: nameOf(subjects.data.value?.data, id), n })))
const levelCounts = computed(() => Object.entries(counts.value?.byLevel ?? {}).map(([id, n]) => ({ id, name: nameOf(levels.data.value?.data, id), n })))

const confirm = useConfirm()
const busy = ref(false)
const errors = ref<string[]>([])
const selected = ref<string[]>([])
const figureId = ref('')
/** The last regroup of this session: the audit id is only known from the response, so `Buat asal` lives here. */
const undoable = ref<{ auditId: string; groupId: string } | null>(null)

const selectedRows = computed(() => rows.value.filter((r) => selected.value.includes(r.questionId)))
const figureRows = computed(() => selectedRows.value.filter((r) => r.flag === 'figure_only'))
/** The select always shows the row that is sent: when the chosen figure row is no longer selected, the first figure row takes over. */
watch(figureRows, (list) => {
  if (!list.some((r) => r.questionId === figureId.value)) figureId.value = list[0]?.questionId ?? ''
})
const figure = computed(() => figureRows.value.find((r) => r.questionId === figureId.value) ?? figureRows.value[0])
const runNotConsecutive = computed(() => selectedRows.value.length > 1 && !isConsecutiveRun(selectedRows.value))
const canGroup = computed(() => figure.value !== undefined && selectedRows.value.length >= 2 && !runNotConsecutive.value)

/** A new filter or page is a new list: the selection and the last action error no longer apply. */
watch([filters, page], () => {
  selected.value = []
  figureId.value = ''
  errors.value = []
})

function toggle(id: string): void {
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}

async function mutate(action: () => Promise<void>): Promise<boolean> {
  if (busy.value) return false
  busy.value = true
  errors.value = []
  try {
    await action()
    selected.value = []
    figureId.value = ''
    await list.reload()
    if (rows.value.length === 0 && page.value > 1) go({ page: page.value - 1 })
    return true
  } catch (err) {
    errors.value = errorLines(err)
    return false
  } finally {
    busy.value = false
  }
}

async function dismiss(row: RegroupWorkRow): Promise<void> {
  const yes = await confirm({ message: REGROUP_COPY.dismissConfirm, confirmLabel: REGROUP_COPY.dismissYes, cancelLabel: REGROUP_COPY.cancel })
  if (yes) await mutate(async () => void (await dismissQuestionFlag(row.questionId, row.flag)))
}

async function group(): Promise<void> {
  const fig = figure.value
  if (!fig || !canGroup.value) return
  await mutate(async () => {
    const out = await regroupQuestions({ figureQuestionId: fig.questionId, memberQuestionIds: selectedRows.value.filter((r) => r !== fig).map((r) => r.questionId) })
    undoable.value = { auditId: out.meta.auditId, groupId: out.data.id }
  })
}

async function attach(row: RegroupWorkRow, stimulusId: string): Promise<void> {
  await mutate(async () => {
    const out = await regroupQuestions({ stimulusId, memberQuestionIds: [row.questionId] })
    undoable.value = { auditId: out.meta.auditId, groupId: out.data.id }
  })
}

async function undo(): Promise<void> {
  const u = undoable.value
  if (!u) return
  const ok = await mutate(async () => {
    try {
      await undoRegroup(u.auditId)
    } catch (err) {
      // 409: the group changed after the regroup, so this audit can never be undone; the server message stays on screen.
      if (isApiError(err) && err.status === 409) undoable.value = null
      throw err
    }
  })
  if (ok) undoable.value = null
}

function go(next: { subject_id?: string; education_level_id?: string; flag?: string; page?: number }): void {
  const f = filters.value
  const query: Record<string, string> = {}
  const subject = next.subject_id ?? f.subjectId
  const level = next.education_level_id ?? f.educationLevelId
  const flag = next.flag ?? f.flag
  if (subject !== '') query.subject_id = subject
  if (level !== '') query.education_level_id = level
  if (flag !== '') query.flag = flag
  if (next.page !== undefined && next.page > 1) query.page = String(next.page)
  void router.push({ path: REGROUP_PATH, query })
}
</script>

<template>
  <DsPage layout="list" subtitle="Urus bank soalan untuk platform PRESTASIPLUS" data-testid="regroup-page">
    <DsText v-if="counts" variant="label" tabular data-testid="regroup-header">{{ regroupHeader(counts.open, counts.done) }}</DsText>
    <DsCluster v-if="counts" gap="sm" data-testid="regroup-counts">
      <DsText v-for="c in subjectCounts" :key="`s${c.id}`" variant="caption" tone="muted" tabular :data-testid="`regroup-count-subject-${c.id}`">{{ c.name }}: {{ c.n }}</DsText>
      <DsText v-for="c in levelCounts" :key="`l${c.id}`" variant="caption" tone="muted" tabular :data-testid="`regroup-count-level-${c.id}`">{{ c.name }}: {{ c.n }}</DsText>
    </DsCluster>
    <DsCluster gap="md">
      <DsFormField v-slot="{ id }" native :label="REGROUP_COPY.subject" for="regroup-subject">
        <DsNativeSelect :id="id" :model-value="filters.subjectId" data-testid="regroup-subject" @update:model-value="go({ subject_id: String($event), page: 1 })">
          <option value="">Semua</option>
          <option v-for="o in subjects.data.value?.data ?? []" :key="o.id" :value="String(o.id)">{{ o.name }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-slot="{ id }" native :label="REGROUP_COPY.level" for="regroup-level">
        <DsNativeSelect :id="id" :model-value="filters.educationLevelId" data-testid="regroup-level" @update:model-value="go({ education_level_id: String($event), page: 1 })">
          <option value="">Semua</option>
          <option v-for="o in levels.data.value?.data ?? []" :key="o.id" :value="String(o.id)">{{ o.name }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-slot="{ id }" native :label="REGROUP_COPY.flag" for="regroup-flag">
        <DsNativeSelect :id="id" :model-value="filters.flag" data-testid="regroup-flag-filter" @update:model-value="go({ flag: String($event), page: 1 })">
          <option value="">Semua</option>
          <option v-for="f in REGROUP_FLAGS" :key="f" :value="f">{{ regroupFlagLabel(f) }}</option>
        </DsNativeSelect>
      </DsFormField>
    </DsCluster>

    <DsStack v-if="errors.length > 0" gap="2xs" role="alert" data-testid="regroup-action-error">
      <DsText v-for="e in errors" :key="e" variant="body" tone="error">{{ e }}</DsText>
    </DsStack>
    <DsCluster v-if="undoable" gap="sm" data-testid="regroup-undo-bar">
      <DsText variant="body" role="status">Kumpulan #{{ undoable.groupId }} dicipta.</DsText>
      <UButton type="button" color="neutral" variant="soft" :disabled="busy" data-testid="regroup-undo" @click="undo">Buat asal</UButton>
    </DsCluster>
    <DsCluster v-if="selectedRows.length > 0" gap="sm" data-testid="regroup-group-bar">
      <template v-if="figureRows.length > 1">
        <DsNativeSelect id="regroup-figure" v-model="figureId" aria-label="Baris rajah" data-testid="regroup-figure">
          <option v-for="f in figureRows" :key="f.questionId" :value="f.questionId">#{{ f.questionId }}</option>
        </DsNativeSelect>
      </template>
      <UButton type="button" :disabled="busy || !canGroup" data-testid="regroup-group" @click="group">Kumpulkan</UButton>
      <DsText v-if="runNotConsecutive" variant="caption" tone="warning" data-testid="regroup-not-consecutive">{{ REGROUP_COPY.notConsecutive }}</DsText>
    </DsCluster>

    <DsLoadError v-if="list.error.value" :message="listLoadMessage(list.error.value)" testid="regroup-error" retry-testid="regroup-retry" @retry="list.reload()" />
    <DsText v-else-if="!list.data.value" variant="body" tone="muted" data-testid="regroup-loading">Memuatkan…</DsText>
    <DsEmptyState v-else-if="rows.length === 0" size="sm" :title="REGROUP_COPY.empty" data-testid="regroup-empty" />
    <DsStack v-else as="ul" gap="xs" data-testid="regroup-rows">
      <RegroupRow
        v-for="r in rows"
        :key="r.questionId"
        :row="r"
        :selected="selected.includes(r.questionId)"
        :busy="busy"
        @toggle="toggle"
        @dismiss="dismiss"
        @attach="attach"
      />
    </DsStack>
    <DsCluster v-if="pageCount > 1" gap="sm" data-testid="regroup-pager">
      <UButton type="button" color="neutral" variant="soft" :disabled="page <= 1" data-testid="regroup-prev" @click="go({ page: page - 1 })">Sebelumnya</UButton>
      <DsText variant="caption" tone="muted">Halaman {{ page }} / {{ pageCount }}</DsText>
      <UButton type="button" color="neutral" variant="soft" :disabled="page >= pageCount" data-testid="regroup-next" @click="go({ page: page + 1 })">Seterusnya</UButton>
    </DsCluster>
  </DsPage>
</template>
