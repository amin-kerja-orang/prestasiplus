<script setup lang="ts">
/**
 * S8 table (FR-M27-112, 113, 115; PROPOSED, D23): columns "#", "Kelas" (name, a link to M08 S5
 * `/prestasi/kelas/{id}` for a classroom, plain text for a school_class; an inactive class carries the badge "Tidak Aktif"), "Subjek" ("Tiada Subjek"),
 * "Tingkatan", "Guru", "Murid" (R1-AS-53: the number links to Senarai Pelajar filtered by the class, FR-AS-53-3;
 * the class code column is gone, FR-AS-53-5). Empty: "Tiada kelas dijumpai" and "Sila cipta kelas
 * terlebih dahulu". Staff table from `md`, a card list below; paging is server side (25 per page).
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import {
  DsCluster,
  DsDataTable,
  DsEmptyState,
  DsLink,
  DsPanel,
  DsStatusBadge,
  DsText,
  type CardField,
  type DefinitionItem,
} from '@/ds'
import { formatCount } from '@/lib/number'

import type { SchoolClassRow } from '../../api/school-admin'
import { PUPIL_LIST_PATH } from '../users/users-format'

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
  /** Senarai Pelajar filtered by this class. */
  membersLink: string
  isActive: boolean
  link: string | null
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
    membersLink: `${PUPIL_LIST_PATH}?classroomId=${String(c.id)}`,
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
]
const cardFields: CardField[] = [
  { key: 'subject', label: 'Subjek' },
  { key: 'level', label: 'Tingkatan' },
  { key: 'teacher', label: 'Guru' },
  { key: 'members', label: 'Murid' },
]

const cardItems = (row: Item): DefinitionItem[] =>
  cardFields.map((f) => ({ key: f.key, label: f.label, value: String(row[f.key]) }))

function open(row: Item): void {
  if (row.link !== null) void router.push(row.link)
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
      <DsCluster gap="sm" data-testid="kl-row">
        <DsLink v-if="row.original.link !== null" :to="row.original.link" data-testid="kl-name">{{
          row.original.name
        }}</DsLink>
        <DsText v-else as="span" variant="label" data-testid="kl-name">{{ row.original.name }}</DsText>
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
      <DsLink :to="row.original.membersLink" data-testid="kl-members" @click.stop>{{
        row.original.members
      }}</DsLink>
    </template>
    <!-- Below `md`: the default card, with "Murid" as the same link. -->
    <template #card="{ row }">
      <DsLink v-if="row.link !== null" :to="row.link">{{ row.name }}</DsLink>
      <DsText v-else as="span" variant="label">{{ row.name }}</DsText>
      <dl class="grid grid-cols-2 gap-x-3 gap-y-2">
        <div v-for="item in cardItems(row)" :key="item.key" class="min-w-0">
          <dt class="text-caption text-muted">{{ item.label }}</dt>
          <dd class="tabular text-body break-words">
            <DsLink v-if="item.key === 'members'" :to="row.membersLink" data-testid="kl-members" @click.stop>{{
              item.value
            }}</DsLink>
            <template v-else>{{ item.value }}</template>
          </dd>
        </div>
      </dl>
    </template>
  </DsDataTable>
</template>
