<script setup lang="ts">
/**
 * S8 table (FR-M27-112, 113, 115; PROPOSED, D23): columns "#", "Kelas" (name, a link to M08 S5
 * `/prestasi/kelas/{id}`; an inactive class carries the badge "Tidak Aktif"), "Subjek" ("Tiada Subjek"),
 * "Tingkatan", "Guru", "Murid", "Kod Kelas". Empty: "Tiada kelas dijumpai" and "Sila cipta kelas
 * terlebih dahulu". Staff table from `md`, a card list below; paging is server side (25 per page).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { DsDataTable, DsEmptyState, DsPanel, DsStatusBadge, type CardField, DsCluster } from '@/ds'
import { formatCount } from '@/lib/number'

import type { SchoolClassRow } from '../../api/school-admin'

const props = defineProps<{
  rows: SchoolClassRow[]
  from: number
  page: number
  total: number
  pageSize: number
}>()
const emit = defineEmits<{ page: [page: number] }>()

const router = useRouter()

interface Item extends Record<string, unknown> {
  key: string
  no: number
  name: string
  subject: string
  level: string
  teacher: string
  members: string
  code: string
  isActive: boolean
  link: string
}

const items = computed<Item[]>(() =>
  props.rows.map((c, i) => ({
    key: c.key,
    no: props.from + i,
    name: c.name,
    subject: c.subject?.name ?? 'Tiada Subjek',
    level: c.levelLabel,
    teacher: c.teacherName ?? '-',
    members: formatCount(c.members),
    code: c.joinCode ?? '-',
    isActive: c.isActive,
    link: c.link,
  })),
)

const columns: TableColumn<Item>[] = [
  { accessorKey: 'no', header: '#' },
  { accessorKey: 'name', header: 'Kelas' },
  { accessorKey: 'subject', header: 'Subjek' },
  { accessorKey: 'level', header: 'Tingkatan' },
  { accessorKey: 'teacher', header: 'Guru' },
  { accessorKey: 'members', header: 'Murid' },
  { accessorKey: 'code', header: 'Kod Kelas' },
]
const cardFields: CardField[] = [
  { key: 'subject', label: 'Subjek' },
  { key: 'level', label: 'Tingkatan' },
  { key: 'teacher', label: 'Guru' },
  { key: 'members', label: 'Murid' },
  { key: 'code', label: 'Kod Kelas' },
]

function open(row: Item): void {
  void router.push(row.link)
}
</script>

<template>
  <DsPanel v-if="rows.length === 0" data-testid="kl-empty">
    <DsEmptyState
      title="Tiada kelas dijumpai"
      description="Sila cipta kelas terlebih dahulu"
      icon="i-ph-chalkboard"
    />
  </DsPanel>
  <DsDataTable
    v-else
    :data="items"
    :columns="columns"
    :total="total"
    :page-size="pageSize"
    :page="page"
    caption="Kelas Sekolah"
    card-title="name"
    :card-fields="cardFields"
    data-testid="kl-table"
    @update:page="emit('page', $event)"
    @row-click="open"
  >
    <template #no-cell="{ row }">
      <span data-testid="kl-no">{{ row.original.no }}</span>
    </template>
    <template #name-cell="{ row }">
      <DsCluster gap="xs" data-testid="kl-row">
        <RouterLink
          :to="row.original.link"
          class="inline-flex min-h-11 items-center text-label text-highlighted"
          data-testid="kl-name"
          >{{ row.original.name }}</RouterLink
        >
        <DsStatusBadge
          v-if="!row.original.isActive"
          status="inactive"
          label="Tidak Aktif"
          data-testid="kl-inactive"
        />
      </DsCluster>
    </template>
    <template #subject-cell="{ row }">
      <span data-testid="kl-subject">{{ row.original.subject }}</span>
    </template>
    <template #level-cell="{ row }">
      <span class="whitespace-nowrap" data-testid="kl-level-cell">{{ row.original.level }}</span>
    </template>
    <template #teacher-cell="{ row }">
      <span data-testid="kl-teacher">{{ row.original.teacher }}</span>
    </template>
    <template #members-cell="{ row }">
      <span data-testid="kl-members">{{ row.original.members }}</span>
    </template>
    <template #code-cell="{ row }">
      <span class="whitespace-nowrap" data-testid="kl-code">{{ row.original.code }}</span>
    </template>
  </DsDataTable>
</template>
