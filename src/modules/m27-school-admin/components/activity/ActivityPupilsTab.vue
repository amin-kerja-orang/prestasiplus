<script setup lang="ts">
/**
 * S3 Murid tab (FR-M27-72; restyle spec AS-48): heading "Senarai Murid ({n}) — Top 200", pills "Semua",
 * "Aktif", "Login Sahaja", "Belum Login" (each lists its own pupils, up to 200), the search "Cari
 * murid...", the tiles "Jumlah Murid", "Pernah Latihan", "Jumlah Sesi", "Purata Ketepatan" and a
 * `DsDataTable` "#", "Nama", "Kelas", "Sesi", "Ketepatan", "Masa", "Syiling", "Login Terakhir" (cards below
 * `md`). No "Sekolah" column and no school select; a search with no match shows no rows.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import {
  DsDataTable,
  DsPillNav,
  DsStatRow,
  type CardField,
  type PillItem,
  type StatItem,
  DsStack,
  DsHeading,
  DsText,
} from '@/ds'

import type { SchoolActivityReport } from '../../api/school-admin'
import { accuracy, count, duration, lastLogin, matches, NO_DATA } from './activity-format'

const props = defineProps<{ report: SchoolActivityReport }>()

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
  accuracy: string
  time: string
  coins: string
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
      accuracy: accuracy(r.accuracy),
      time: duration(r.seconds),
      coins: count(r.coins),
      last: lastLogin(r.lastLoginAt),
    })),
)

const columns: TableColumn<Row>[] = [
  { id: 'index', accessorKey: 'index', header: '#' },
  { id: 'name', accessorKey: 'name', header: 'Nama' },
  { id: 'kelas', accessorKey: 'kelas', header: 'Kelas' },
  { id: 'sessions', accessorKey: 'sessions', header: 'Sesi' },
  { id: 'accuracy', accessorKey: 'accuracy', header: 'Ketepatan' },
  { id: 'time', accessorKey: 'time', header: 'Masa' },
  { id: 'coins', accessorKey: 'coins', header: 'Syiling' },
  { id: 'last', accessorKey: 'last', header: 'Login Terakhir' },
]
const cardFields: CardField[] = [
  { key: 'kelas', label: 'Kelas' },
  { key: 'sessions', label: 'Sesi' },
  { key: 'accuracy', label: 'Ketepatan' },
  { key: 'time', label: 'Masa' },
  { key: 'coins', label: 'Syiling' },
  { key: 'last', label: 'Login Terakhir' },
]

const tiles = computed<StatItem[]>(() => [
  {
    key: 'total',
    label: 'Jumlah Murid',
    value: count(t.value.total),
    icon: 'graduation-cap',
    accent: 'action',
  },
  {
    key: 'practised',
    label: 'Pernah Latihan',
    value: count(t.value.practised),
    icon: 'clipboard-text',
    accent: 'win',
  },
  {
    key: 'sessions',
    label: 'Jumlah Sesi',
    value: count(t.value.sessions),
    icon: 'list-numbers',
    accent: 'heat',
  },
  // "no attempts" is not "averaging zero" (S1 rule): the dash without a session (INFERRED)
  {
    key: 'accuracy',
    label: 'Purata Ketepatan',
    value: t.value.sessions > 0 ? accuracy(t.value.accuracy) : NO_DATA,
    icon: 'target',
    accent: 'friend',
  },
])
</script>

<template>
  <DsStack as="section" data-testid="la-murid">
    <DsHeading :level="2" variant="title" data-testid="la-murid-title">
      Senarai Murid ({{ count(t.total) }}) — Top 200
    </DsHeading>

    <DsStatRow
      :items="tiles"
      prefix="la-murid-tile"
      part-prefix="la-tile"
      data-testid="la-murid-tiles"
      :cols="4"
    />

    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <DsPillNav
        :items="PILLS"
        :active="filter"
        testid-prefix="la-murid-pill"
        data-testid="la-murid-pills"
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
      empty-label="Tiada murid"
      card-title="name"
      :card-fields="cardFields"
      :page-size="Math.max(1, rows.length)"
      data-testid="la-murid-table"
    >
      <template #name-cell="{ row }">
        <DsText variant="label" tone="highlighted" data-testid="la-murid-name">{{
          row.original.name
        }}</DsText>
      </template>
      <template #kelas-cell="{ row }">
        <span data-testid="la-murid-kelas">{{ row.original.kelas }}</span>
      </template>
      <template #sessions-cell="{ row }">
        <span data-testid="la-murid-sesi">{{ row.original.sessions }}</span>
      </template>
      <template #accuracy-cell="{ row }">
        <span data-testid="la-murid-ketepatan">{{ row.original.accuracy }}</span>
      </template>
      <template #time-cell="{ row }">
        <span class="whitespace-nowrap" data-testid="la-murid-masa">{{ row.original.time }}</span>
      </template>
      <template #coins-cell="{ row }">
        <span data-testid="la-murid-syiling">{{ row.original.coins }}</span>
      </template>
      <template #last-cell="{ row }">
        <span class="whitespace-nowrap" data-testid="la-murid-last">{{ row.original.last }}</span>
      </template>
    </DsDataTable>
  </DsStack>
</template>
