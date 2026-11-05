<script setup lang="ts">
/**
 * The tab `Perlu dikumpulkan semula` of `Senarai Soalan` (R1-ADM-QE-08, PRD45 6.6.2): the frame of the work-list over API-Q-13,
 * with the header counts, the `Subjek`, `Tingkatan` and `Sebab` filters in the URL and the pager. The row actions and the
 * `Kertas sumber` filter come with S1-T07 part 2 (answer 3 on #431).
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsCluster, DsEmptyState, DsFormField, DsLoadError, DsNativeSelect, DsPage, DsStack, DsText } from '@/ds'

import { fetchEducationLevels, fetchSubjects } from '../api/lookups'
import { fetchRegroupWorklist } from '../api/questions'
import QuestionAreaTabs from '../components/QuestionAreaTabs.vue'
import RegroupRow from '../components/RegroupRow.vue'
import { listLoadMessage } from '../lib/list-load'
import { QUESTIONS_LIST_PATH, REGROUP_COPY, REGROUP_FLAGS, REGROUP_TAB, regroupHeader } from '../lib/question-list'

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
const pageCount = computed(() => (meta.value ? Math.max(1, Math.ceil(meta.value.totalItems / meta.value.pageSize)) : 1))

function go(next: { subject_id?: string; education_level_id?: string; flag?: string; page?: number }): void {
  const f = filters.value
  const query: Record<string, string> = { tab: REGROUP_TAB }
  const subject = next.subject_id ?? f.subjectId
  const level = next.education_level_id ?? f.educationLevelId
  const flag = next.flag ?? f.flag
  if (subject !== '') query.subject_id = subject
  if (level !== '') query.education_level_id = level
  if (flag !== '') query.flag = flag
  if (next.page !== undefined && next.page > 1) query.page = String(next.page)
  void router.push({ path: QUESTIONS_LIST_PATH, query })
}
</script>

<template>
  <DsPage layout="list" subtitle="Urus bank soalan untuk platform PRESTASIPLUS" data-testid="regroup-page">
    <QuestionAreaTabs />
    <DsText v-if="meta" variant="label" tabular data-testid="regroup-header">{{ regroupHeader(meta.totalItems, meta.done ?? 0) }}</DsText>
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
          <option v-for="f in REGROUP_FLAGS" :key="f" :value="f">{{ f }}</option>
        </DsNativeSelect>
      </DsFormField>
    </DsCluster>

    <DsLoadError v-if="list.error.value" :message="listLoadMessage(list.error.value)" testid="regroup-error" retry-testid="regroup-retry" @retry="list.reload()" />
    <DsText v-else-if="!list.data.value" variant="body" tone="muted" data-testid="regroup-loading">Memuatkan…</DsText>
    <DsEmptyState v-else-if="rows.length === 0" size="sm" :title="REGROUP_COPY.empty" data-testid="regroup-empty" />
    <DsStack v-else as="ul" gap="xs" data-testid="regroup-rows">
      <RegroupRow v-for="r in rows" :key="r.questionId" :row="r" />
    </DsStack>
    <DsCluster v-if="pageCount > 1" gap="sm" data-testid="regroup-pager">
      <UButton type="button" color="neutral" variant="soft" :disabled="page <= 1" data-testid="regroup-prev" @click="go({ page: page - 1 })">Sebelumnya</UButton>
      <DsText variant="caption" tone="muted">Halaman {{ page }} / {{ pageCount }}</DsText>
      <UButton type="button" color="neutral" variant="soft" :disabled="page >= pageCount" data-testid="regroup-next" @click="go({ page: page + 1 })">Seterusnya</UButton>
    </DsCluster>
  </DsPage>
</template>
