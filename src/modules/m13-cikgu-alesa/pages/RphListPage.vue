<script setup lang="ts">
/**
 * S2 `/cikgu/rph` RPH list (FR-M13-34..37; URS FT-M13-3.1; M13-T3). Staff table: scrolls inside its
 * card on wide screens and becomes a card list below `md`. Rows are PROPOSED.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsDataTable, DsPage, type CardField } from '@/ds'

import { fetchRphList } from '../api'
import { RPH_COPY as C } from '../components/teacher/copy'
import { dmy, pageOf } from '../components/teacher/lib'
import PageState from '../components/teacher/PageState.vue'

interface Row extends Record<string, unknown> {
  id: number
  date: string
  subject: string
  tajuk: string
  status: string
}

const route = useRoute()
const router = useRouter()
const page = computed(() => pageOf(route.query.page))

const { data, error, reload } = useApi((signal) => fetchRphList(page.value, { signal }), page)

const rows = computed<Row[]>(() =>
  (data.value?.data ?? []).map((r) => ({
    id: r.id,
    date: dmy(r.lessonDate),
    subject: `${r.subjectName} / ${r.level}`,
    tajuk: r.tajuk,
    status: C.statusGenerated,
  })),
)

const columns: TableColumn<Row>[] = [
  { accessorKey: 'date', header: C.headers[0] },
  { accessorKey: 'subject', header: C.headers[1] },
  { accessorKey: 'tajuk', header: C.headers[2] },
  { accessorKey: 'status', header: C.headers[3] },
  { id: 'actions', header: C.headers[4] },
]
const cardFields: CardField[] = [
  { key: 'date', label: C.headers[0] },
  { key: 'subject', label: C.headers[1] },
  { key: 'status', label: C.headers[3] },
]

function goToPage(next: number): void {
  void router.push({ path: '/cikgu/rph', query: { page: String(next) } })
}
</script>

<template>
  <DsPage :title="C.title" :subtitle="C.sub" data-testid="rph-list-page">
    <template #actions>
      <UButton
        to="/cikgu/rph/baharu"
        icon="i-ph-robot-duotone"
        class="min-h-11"
        data-testid="rph-create"
        >{{ C.create }}</UButton
      >
    </template>

    <PageState
      :loaded="data !== null"
      :error="error !== null"
      :message="C.loadFailed"
      :retry-label="C.retry"
      @retry="reload"
    >
      <DsDataTable
        v-if="data"
        :data="rows"
        :columns="columns"
        :page="data.meta.page"
        :total="data.meta.totalItems"
        :page-size="data.meta.pageSize"
        caption="Senarai RPH"
        card-title="tajuk"
        :card-fields="cardFields"
        data-testid="rph-table"
        @update:page="goToPage"
      >
        <template #empty>
          <span data-testid="rph-empty"
            >{{ C.emptyBefore }}<em>{{ C.emptyExample }}</em
            >.</span
          >
        </template>
        <template #actions-cell="{ row }">
          <UButton
            :to="`/cikgu/rph/${String(row.original.id)}`"
            color="neutral"
            variant="link"
            class="min-h-11"
            >{{ C.view }}</UButton
          >
        </template>
        <template #card-actions="{ row }">
          <UButton
            :to="`/cikgu/rph/${String(row.id)}`"
            color="neutral"
            variant="soft"
            class="min-h-11"
            >{{ C.view }}</UButton
          >
        </template>
      </DsDataTable>
    </PageState>
  </DsPage>
</template>
