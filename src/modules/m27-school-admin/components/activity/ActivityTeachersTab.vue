<script setup lang="ts">
/**
 * S3 Guru tab (FR-M27-71; restyle spec AS-48): heading "Senarai Guru ({n})", pills "Semua", "Pernah Login
 * ({n})", "Belum Login ({n})", the search "Cari guru...", the tiles "Jumlah Guru", "Pernah Login", "Jumlah
 * Soalan", "Jumlah Syiling" and a `DsDataTable` "#", "Nama" (with the e-mail line), "Login", "MCQ",
 * "Struktur", "Syiling", "Headcount", "Login Terakhir" (cards below `md`). No "Sekolah" column and no
 * school select; a search with no match shows no rows.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'

import {
  DsDataTable,
  DsPillNav,
  DsStatRow,
  DsStatusBadge,
  type CardField,
  type PillItem,
  type StatItem,
  DsStack,
  DsHeading,
  DsText,
} from '@/ds'

import type { SchoolActivityReport } from '../../api/school-admin'
import { count, lastLogin, matches } from './activity-format'

const props = defineProps<{ report: SchoolActivityReport }>()

type Filter = 'semua' | 'pernah' | 'belum'
const filter = ref<Filter>('semua')
const query = ref('')

const t = computed(() => props.report.tiles.teachers)

const pills = computed<PillItem<Filter>[]>(() => [
  { key: 'semua', label: 'Semua' },
  { key: 'pernah', label: `Pernah Login (${count(t.value.logged)})` },
  { key: 'belum', label: `Belum Login (${count(t.value.total - t.value.logged)})` },
])

interface Row extends Record<string, unknown> {
  userId: number
  index: string
  name: string
  email: string
  loggedIn: boolean
  login: string
  mcq: string
  structured: string
  coins: string
  hasHeadcount: boolean
  headcount: string
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
      login: r.loggedIn ? 'Ya' : 'Belum',
      mcq: count(r.mcq),
      structured: count(r.structured),
      coins: count(r.coins),
      hasHeadcount: r.hasHeadcount,
      headcount: r.hasHeadcount ? 'Ya' : '-',
      last: lastLogin(r.lastLoginAt),
    })),
)

const columns: TableColumn<Row>[] = [
  { id: 'index', accessorKey: 'index', header: '#' },
  { id: 'name', accessorKey: 'name', header: 'Nama' },
  { id: 'login', accessorKey: 'login', header: 'Login' },
  { id: 'mcq', accessorKey: 'mcq', header: 'MCQ' },
  { id: 'structured', accessorKey: 'structured', header: 'Struktur' },
  { id: 'coins', accessorKey: 'coins', header: 'Syiling' },
  { id: 'headcount', accessorKey: 'headcount', header: 'Headcount' },
  { id: 'last', accessorKey: 'last', header: 'Login Terakhir' },
]
const cardFields: CardField[] = [
  { key: 'login', label: 'Login' },
  { key: 'mcq', label: 'MCQ' },
  { key: 'structured', label: 'Struktur' },
  { key: 'coins', label: 'Syiling' },
  { key: 'headcount', label: 'Headcount' },
  { key: 'last', label: 'Login Terakhir' },
]

const tiles = computed<StatItem[]>(() => [
  {
    key: 'total',
    label: 'Jumlah Guru',
    value: count(t.value.total),
    icon: 'chalkboard-teacher',
    accent: 'action',
  },
  {
    key: 'logged',
    label: 'Pernah Login',
    value: count(t.value.logged),
    icon: 'sign-in',
    accent: 'win',
  },
  {
    key: 'questions',
    label: 'Jumlah Soalan',
    value: count(t.value.questions),
    icon: 'question',
    accent: 'heat',
  },
  {
    key: 'coins',
    label: 'Jumlah Syiling',
    value: count(t.value.coins),
    icon: 'coins',
    accent: 'friend',
  },
])
</script>

<template>
  <DsStack as="section" data-testid="la-guru">
    <DsHeading :level="2" variant="title" data-testid="la-guru-title">
      Senarai Guru ({{ count(t.total) }})
    </DsHeading>

    <DsStatRow
      :items="tiles"
      prefix="la-guru-tile"
      part-prefix="la-tile"
      data-testid="la-guru-tiles"
      :cols="4"
    />

    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <DsPillNav
        :items="pills"
        :active="filter"
        testid-prefix="la-guru-pill"
        data-testid="la-guru-pills"
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
      empty-label="Tiada guru"
      card-title="name"
      :card-fields="cardFields"
      :page-size="Math.max(1, rows.length)"
      data-testid="la-guru-table"
    >
      <template #name-cell="{ row }">
        <DsText variant="label" as="p" tone="highlighted" data-testid="la-guru-name">{{
          row.original.name
        }}</DsText>
        <DsText variant="caption" data-testid="la-guru-email">{{ row.original.email }}</DsText>
      </template>
      <template #login-cell="{ row }">
        <DsStatusBadge
          :status="row.original.loggedIn ? 'active' : 'inactive'"
          :label="row.original.login"
          data-testid="la-guru-login"
        />
      </template>
      <template #mcq-cell="{ row }">
        <span data-testid="la-guru-mcq">{{ row.original.mcq }}</span>
      </template>
      <template #structured-cell="{ row }">
        <span data-testid="la-guru-struktur">{{ row.original.structured }}</span>
      </template>
      <template #coins-cell="{ row }">
        <span data-testid="la-guru-syiling">{{ row.original.coins }}</span>
      </template>
      <template #headcount-cell="{ row }">
        <span data-testid="la-guru-headcount">
          <UIcon
            v-if="row.original.hasHeadcount"
            name="i-ph-check"
            class="size-5 text-success"
            aria-label="Ya"
          />
          <span v-else class="text-dimmed">-</span>
        </span>
      </template>
      <template #last-cell="{ row }">
        <span class="whitespace-nowrap" data-testid="la-guru-last">{{ row.original.last }}</span>
      </template>
    </DsDataTable>
  </DsStack>
</template>
