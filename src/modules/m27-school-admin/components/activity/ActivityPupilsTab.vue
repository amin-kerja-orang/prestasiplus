<script setup lang="ts">
/**
 * S3 Murid tab (FR-M27-72; restyle spec AS-48): heading "Senarai Murid ({n}) — Top 200", pills "Semua",
 * "Aktif", "Login Sahaja", "Belum Login" (each lists its own pupils, up to 200), the search "Cari
 * murid...", the tiles "Jumlah Murid", "Pernah Latihan", "Jumlah Sesi", "Purata Ketepatan" and a
 * `DsDataTable` "#", "Nama", "Kelas", "Sesi", "Soalan", "Status" ("Pernah Akses" or "Belum Akses"), "Login
 * Terakhir" (R1-AS-48 field table; the server sorts by Soalan descending; cards below
 * `md`), 25 per page. No "Sekolah" column and no school select; a search with no match shows "Tiada rekod sepadan.".
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import { DsDataTable, DsPillNav, DsStatRow, type CardField, type PillItem, type StatItem } from '@/ds'

import type { SchoolActivityReport } from '../../api/school-admin'
import { accuracy, count, lastLogin, matches, NO_DATA } from './activity-format'

const props = defineProps<{ report: SchoolActivityReport }>()

/** FR-AS-48-5: the Top 200 list is paginated 25 per page. */
const PAGE_SIZE = 25

type Filter = 'semua' | 'aktif' | 'loginSahaja' | 'belumLogin'
const filter = ref<Filter>('semua')
const query = ref('')

const PILLS: PillItem<Filter>[] = [
  { key: 'semua', label: 'Semua', testid: 'semua' },
  { key: 'aktif', label: 'Aktif', testid: 'aktif' },
  { key: 'loginSahaja', label: 'Login Sahaja', testid: 'login-sahaja' },
  { key: 'belumLogin', label: 'Belum Login', testid: 'belum-login' },
]

const t = computed(() => props.report.tiles.pupils)

interface Row extends Record<string, unknown> {
  userId: number
  index: string
  name: string
  kelas: string
  sessions: string
  answers: string
  status: string
  last: string
}

const rows = computed<Row[]>(() =>
  props.report.pupils[filter.value]
    .filter((r) => matches(query.value, r.name, r.className))
    .map((r, i) => ({
      userId: r.userId,
      index: String(i + 1),
      name: r.name,
      kelas: r.className ?? '-',
      sessions: count(r.sessions),
      answers: count(r.answers),
      status: r.lastLoginAt === null ? 'Belum Akses' : 'Pernah Akses',
      last: lastLogin(r.lastLoginAt),
    })),
)

const columns: TableColumn<Row>[] = [
  { id: 'index', accessorKey: 'index', header: '#' },
  { id: 'name', accessorKey: 'name', header: 'Nama' },
  { id: 'kelas', accessorKey: 'kelas', header: 'Kelas' },
  { id: 'sessions', accessorKey: 'sessions', header: 'Sesi' },
  { id: 'answers', accessorKey: 'answers', header: 'Soalan' },
  { id: 'status', accessorKey: 'status', header: 'Status' },
  { id: 'last', accessorKey: 'last', header: 'Login Terakhir' },
]
const cardFields: CardField[] = [
  { key: 'kelas', label: 'Kelas' },
  { key: 'sessions', label: 'Sesi' },
  { key: 'answers', label: 'Soalan' },
  { key: 'status', label: 'Status' },
  { key: 'last', label: 'Login Terakhir' },
]

const tiles = computed<StatItem[]>(() => [
  { key: 'total', label: 'Jumlah Murid', value: count(t.value.total), icon: 'graduation-cap', accent: 'action' },
  {
    key: 'practised',
    label: 'Pernah Latihan',
    value: count(t.value.practised),
    icon: 'clipboard-text', accent: 'win',
  },
  { key: 'sessions', label: 'Jumlah Sesi', value: count(t.value.sessions), icon: 'list-numbers', accent: 'heat' },
  // "no attempts" is not "averaging zero" (S1 rule): the dash without a session (INFERRED)
  {
    key: 'accuracy',
    label: 'Purata Ketepatan',
    value: t.value.sessions > 0 ? accuracy(t.value.accuracy) : NO_DATA,
    icon: 'target', accent: 'friend',
  },
])
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4" data-testid="la-murid">
    <h2 class="text-title text-highlighted" data-testid="la-murid-title">
      Senarai Murid ({{ count(t.total) }}) — Top 200
    </h2>

    <DsStatRow :items="tiles" prefix="la-murid-tile" part-prefix="la-tile" data-testid="la-murid-tiles" :cols="4" />

    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <DsPillNav
        :items="PILLS"
        :active="filter"
        testid-prefix="la-murid-pill" data-testid="la-murid-pills"
        label="Tapis murid"
        @select="filter = $event"
      />
      <UInput
        v-model="query"
        type="search"
        placeholder="Cari murid..."
        icon="i-ph-magnifying-glass"
        size="lg"
        aria-label="Cari murid"
        class="w-full sm:w-64"
        data-testid="la-murid-search"
      />
    </div>

    <DsDataTable
      :data="rows"
      :columns="columns"
      caption="Senarai murid"
      empty-title="Tiada rekod sepadan."
      card-title="name"
      :card-fields="cardFields"
      :page-size="PAGE_SIZE"
      data-testid="la-murid-table"
    >
      <template #name-cell="{ row }">
        <span class="text-label text-highlighted" data-testid="la-murid-name">{{
          row.original.name
        }}</span>
      </template>
      <template #kelas-cell="{ row }">
        <span data-testid="la-murid-kelas">{{ row.original.kelas }}</span>
      </template>
      <template #sessions-cell="{ row }">
        <span data-testid="la-murid-sesi">{{ row.original.sessions }}</span>
      </template>
      <template #answers-cell="{ row }">
        <span data-testid="la-murid-soalan">{{ row.original.answers }}</span>
      </template>
      <template #status-cell="{ row }">
        <span data-testid="la-murid-status">{{ row.original.status }}</span>
      </template>
      <template #last-cell="{ row }">
        <span class="whitespace-nowrap" data-testid="la-murid-last">{{ row.original.last }}</span>
      </template>
    </DsDataTable>
  </section>
</template>
