<script setup lang="ts">
/**
 * S3 Guru tab (R1-AS-48 field table; FR-M27-71): heading "Senarai Guru ({n})", pills "Semua", "Pernah Akses
 * ({n})", "Belum Akses ({n})", the search "Cari guru...", the tiles "Jumlah Guru", "Pernah Akses", "Jumlah
 * Soalan", "Jumlah Syiling" and a `DsDataTable` "#", "Nama", "Emel", "Status" ("Pernah Akses" or "Belum
 * Akses"), "Login Terakhir" (`dd/mm/yyyy HH:mm` or "Belum login"; the server sorts by login descending,
 * never-logged last; cards below `md`). No "Sekolah" column; an empty result shows "Tiada rekod sepadan.".
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import { DsDataTable, DsPillNav, DsStatRow, DsStatusBadge, type CardField, type PillItem, type StatItem } from '@/ds'

import type { SchoolActivityReport } from '../../api/school-admin'
import { count, lastLogin, matches } from './activity-format'

const props = defineProps<{ report: SchoolActivityReport }>()

type Filter = 'semua' | 'pernah' | 'belum'
const filter = ref<Filter>('semua')
const query = ref('')

const t = computed(() => props.report.tiles.teachers)

const pills = computed<PillItem<Filter>[]>(() => [
  { key: 'semua', label: 'Semua' },
  { key: 'pernah', label: `Pernah Akses (${count(t.value.logged)})` },
  { key: 'belum', label: `Belum Akses (${count(t.value.total - t.value.logged)})` },
])

interface Row extends Record<string, unknown> {
  userId: number
  index: string
  name: string
  email: string
  loggedIn: boolean
  status: string
  last: string
}

const rows = computed<Row[]>(() =>
  props.report.teachers
    .filter(
      (r) =>
        (filter.value === 'semua' || (filter.value === 'pernah') === r.loggedIn) &&
        matches(query.value, r.name, r.email),
    )
    .map((r, i) => ({
      userId: r.userId,
      index: String(i + 1),
      name: r.name,
      email: r.email,
      loggedIn: r.loggedIn,
      status: r.loggedIn ? 'Pernah Akses' : 'Belum Akses',
      last: lastLogin(r.lastLoginAt),
    })),
)

const columns: TableColumn<Row>[] = [
  { id: 'index', accessorKey: 'index', header: '#' },
  { id: 'name', accessorKey: 'name', header: 'Nama' },
  { id: 'email', accessorKey: 'email', header: 'Emel' },
  { id: 'status', accessorKey: 'status', header: 'Status' },
  { id: 'last', accessorKey: 'last', header: 'Login Terakhir' },
]
const cardFields: CardField[] = [
  { key: 'email', label: 'Emel' },
  { key: 'status', label: 'Status' },
  { key: 'last', label: 'Login Terakhir' },
]

const tiles = computed<StatItem[]>(() => [
  {
    key: 'total',
    label: 'Jumlah Guru',
    value: count(t.value.total),
    icon: 'chalkboard-teacher', accent: 'action',
  },
  { key: 'logged', label: 'Pernah Akses', value: count(t.value.logged), icon: 'sign-in', accent: 'win' },
  {
    key: 'questions',
    label: 'Jumlah Soalan',
    value: count(t.value.questions),
    icon: 'question', accent: 'heat',
  },
  { key: 'coins', label: 'Jumlah Syiling', value: count(t.value.coins), icon: 'coins', accent: 'friend' },
])
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4" data-testid="la-guru">
    <h2 class="text-title text-highlighted" data-testid="la-guru-title">
      Senarai Guru ({{ count(t.total) }})
    </h2>

    <DsStatRow :items="tiles" prefix="la-guru-tile" part-prefix="la-tile" data-testid="la-guru-tiles" :cols="4" />

    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <DsPillNav
        :items="pills"
        :active="filter"
        testid-prefix="la-guru-pill" data-testid="la-guru-pills"
        label="Tapis guru"
        @select="filter = $event"
      />
      <UInput
        v-model="query"
        type="search"
        placeholder="Cari guru..."
        icon="i-ph-magnifying-glass"
        size="lg"
        aria-label="Cari guru"
        class="w-full sm:w-64"
        data-testid="la-guru-search"
      />
    </div>

    <DsDataTable
      :data="rows"
      :columns="columns"
      caption="Senarai guru"
      empty-title="Tiada rekod sepadan."
      card-title="name"
      :card-fields="cardFields"
      :page-size="Math.max(1, rows.length)"
      data-testid="la-guru-table"
    >
      <template #name-cell="{ row }">
        <span class="text-label text-highlighted" data-testid="la-guru-name">{{ row.original.name }}</span>
      </template>
      <template #email-cell="{ row }">
        <span class="break-all text-muted" data-testid="la-guru-email">{{ row.original.email }}</span>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge
          :status="row.original.loggedIn ? 'active' : 'inactive'"
          :label="row.original.status"
          data-testid="la-guru-login"
        />
      </template>
      <template #last-cell="{ row }">
        <span class="whitespace-nowrap" data-testid="la-guru-last">{{ row.original.last }}</span>
      </template>
    </DsDataTable>
  </section>
</template>
