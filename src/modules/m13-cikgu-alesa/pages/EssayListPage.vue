<script setup lang="ts">
/**
 * S4 `/cikgu/essay` essay list (FR-M13-49, 50, 37; URS FT-M13-4.1; M13-T4). Same frame as S2; rows
 * are PROPOSED.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsDataTable, DsPage, type CardField, DsLoadError } from '@/ds'

import { fetchEssayList } from '../api'
import { ESSAY_COPY as C } from '../components/teacher/copy'
import { orDash, pageOf, rubricShort } from '../components/teacher/lib'

interface Row extends Record<string, unknown> {
  id: number
  student: string
  subject: string
  tajuk: string
  marks: string
}

const route = useRoute()
const router = useRouter()
const page = computed(() => pageOf(route.query.page))

const { data, error, reload } = useApi((signal) => fetchEssayList(page.value, { signal }), page)

const rows = computed<Row[]>(() =>
  (data.value?.data ?? []).map((r) => ({
    id: r.id,
    student: orDash(r.studentName),
    subject: `${orDash(r.subjectName)} / ${rubricShort(r.rubricKey)}`,
    tajuk: orDash(r.essayTitle),
    marks: `${String(r.marks)}/${String(r.maxMarks)}`,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'student', header: C.headers[0] },
  { accessorKey: 'subject', header: C.headers[1] },
  { accessorKey: 'tajuk', header: C.headers[2] },
  { accessorKey: 'marks', header: C.headers[3] },
  { id: 'actions', header: C.headers[4] },
]
const cardFields: CardField[] = [
  { key: 'student', label: C.headers[0] },
  { key: 'subject', label: C.headers[1] },
  { key: 'marks', label: C.headers[3] },
]

function goToPage(next: number): void {
  void router.push({ path: '/cikgu/essay', query: { page: String(next) } })
}
</script>

<template>
  <DsPage :title="C.title" :subtitle="C.sub" data-testid="essay-list-page">
    <template #actions>
      <UButton
        to="/cikgu/essay/baharu"
        icon="i-ph-plus-circle-duotone"
        class="min-h-11"
        data-testid="essay-create"
        >{{ C.create }}</UButton
      >
    </template>

    <DsLoadError
      v-if="error !== null"
      :message="C.loadFailed"
      :retry-label="C.retry"
      testid="page-error"
      retry-testid="page-retry"
      @retry="reload"
    />
    <div
      v-else-if="!(data !== null)"
      class="flex flex-col gap-3"
      aria-busy="true"
      data-testid="page-loading"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
    </div>
    <template v-else>
      <DsDataTable
        v-if="data"
        :data="rows"
        :columns="columns"
        :page="data.meta.page"
        :total="data.meta.totalItems"
        :page-size="data.meta.pageSize"
        caption="Senarai karangan"
        card-title="tajuk"
        :card-fields="cardFields"
        data-testid="essay-table"
        @update:page="goToPage"
      >
        <template #empty>
          <span data-testid="essay-empty">{{ C.empty }}</span>
        </template>
        <template #actions-cell="{ row }">
          <UButton
            :to="`/cikgu/essay/${String(row.original.id)}`"
            color="neutral"
            variant="link"
            class="min-h-11"
            >{{ C.view }}</UButton
          >
        </template>
        <template #card-actions="{ row }">
          <UButton
            :to="`/cikgu/essay/${String(row.id)}`"
            color="neutral"
            variant="soft"
            class="min-h-11"
            >{{ C.view }}</UButton
          >
        </template>
      </DsDataTable>
    </template>
  </DsPage>
</template>
