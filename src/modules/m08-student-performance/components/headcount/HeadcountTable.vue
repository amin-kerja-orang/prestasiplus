<script setup lang="ts">
/**
 * The S23 table (FR-M08-139, BR-M08-08 rule 2 / DV-29): select-all box · # · Nama (→ S15) · TOV ·
 * OTR1 · AR1 … OTR{n} · AR{n} · ETR, each value column with "%" and "Gred" sub-headers, and the last row
 * "Purata Kelas". The table scrolls inside its card; below `md` every pupil is a card. A dropped pupil
 * stays listed, dimmed (INFERRED, so "Kembalikan" can restore it); it is left out of every count and
 * average.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { DsDataTable, type CardField } from '@/ds'

import type { CellTone, HeadcountDetail } from '../../api/headcount-types'
import { DASH, gradeOfPercent, num1 } from '../../lib/headcount/format'

const props = defineProps<{ detail: HeadcountDetail }>()
const selected = defineModel<number[]>('selected', { required: true })

const otrs = computed(() => Array.from({ length: props.detail.config.activeOtrs }, (_, i) => i))
/** A pupil row without a user id (a masked name) can be neither opened nor selected. */
const hasId = (id: unknown): boolean => id !== null && id !== undefined
const selectable = computed(() => props.detail.rows.filter((r) => hasId(r.userId)))
const allSelected = computed(
  () => selectable.value.length > 0 && selected.value.length === selectable.value.length,
)

function toggleAll(checked: boolean | 'indeterminate') {
  selected.value = checked === true ? selectable.value.map((r) => r.userId) : []
}
function toggleOne(id: number, checked: boolean | 'indeterminate') {
  const rest = selected.value.filter((v) => v !== id)
  selected.value = checked === true ? [...rest, id] : rest
}

const TONE: Record<CellTone, string> = {
  above: 'text-success',
  on: 'text-success',
  below: 'text-error',
  na: 'text-dimmed',
}

const num = (v: number | null | undefined): string => (v == null ? DASH : num1(v))
const grade = (v: number | null | undefined): string => (v == null ? '' : gradeOfPercent(v))
const withGrade = (v: number | null | undefined, g: string | null | undefined): string =>
  v == null ? DASH : `${num1(v)}${g ? ` (${g})` : ''}`

interface Row extends Record<string, unknown> {
  userId: number
  index: string
  name: string
  dropped: boolean
  average: boolean
}

/** One flat row per pupil, the class average last; the OTR cells live under `otr{i}` / `ar{i}` keys. */
const rows = computed<Row[]>(() => {
  const d = props.detail
  const pupils = d.rows.map((r, index): Row => {
    const row: Row = {
      userId: r.userId,
      index: String(index + 1),
      name: r.name,
      dropped: r.dropped,
      average: false,
      tov: num(r.tov),
      tovGrade: r.tovGrade ?? '',
      tovText: withGrade(r.tov, r.tovGrade),
      etr: num(r.etr),
      etrGrade: r.etrGrade ?? '',
      etrText: withGrade(r.etr, r.etrGrade),
    }
    otrs.value.forEach((i) => {
      const c = r.cells[i]
      row[`otr${String(i)}`] = num(c?.target)
      row[`otr${String(i)}g`] = c?.targetGrade ?? ''
      row[`otr${String(i)}Text`] = withGrade(c?.target, c?.targetGrade)
      row[`ar${String(i)}`] = num(c?.ar)
      row[`ar${String(i)}g`] = c?.arGrade ?? ''
      row[`ar${String(i)}Text`] = withGrade(c?.ar, c?.arGrade)
      row[`tone${String(i)}`] = c?.tone ?? 'na'
    })
    return row
  })
  const a = d.averages
  const avg: Row = {
    userId: 0,
    index: '',
    name: 'Purata Kelas',
    dropped: false,
    average: true,
    tov: num(a.tov),
    tovGrade: grade(a.tov),
    tovText: withGrade(a.tov, grade(a.tov)),
    etr: num(a.etr),
    etrGrade: grade(a.etr),
    etrText: withGrade(a.etr, grade(a.etr)),
  }
  otrs.value.forEach((i) => {
    avg[`otr${String(i)}`] = num(a.otrs[i])
    avg[`otr${String(i)}g`] = grade(a.otrs[i])
    avg[`otr${String(i)}Text`] = withGrade(a.otrs[i], grade(a.otrs[i]))
    avg[`ar${String(i)}`] = num(a.ars[i])
    avg[`ar${String(i)}g`] = grade(a.ars[i])
    avg[`ar${String(i)}Text`] = withGrade(a.ars[i], grade(a.ars[i]))
    avg[`tone${String(i)}`] = 'na'
  })
  return [...pupils, avg]
})

const pair = (id: string, header: string, key: string): TableColumn<Row> => ({
  id,
  header,
  columns: [
    { accessorKey: key, header: '%' },
    { accessorKey: `${key}${key === 'tov' || key === 'etr' ? 'Grade' : 'g'}`, header: 'Gred' },
  ],
})

const columns = computed<TableColumn<Row>[]>(() => [
  { id: 'select', header: ' ' },
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Nama' },
  pair('g-tov', 'TOV', 'tov'),
  ...otrs.value.flatMap((i) => [
    pair(`g-otr${String(i)}`, `OTR${String(i + 1)}`, `otr${String(i)}`),
    pair(`g-ar${String(i)}`, `AR${String(i + 1)}`, `ar${String(i)}`),
  ]),
  pair('g-etr', 'ETR', 'etr'),
])

const cardFields = computed<CardField[]>(() => [
  { key: 'tovText', label: 'TOV' },
  ...otrs.value.flatMap((i) => [
    { key: `otr${String(i)}Text`, label: `OTR${String(i + 1)}` },
    { key: `ar${String(i)}Text`, label: `AR${String(i + 1)}` },
  ]),
  { key: 'etrText', label: 'ETR' },
])

const toneOf = (row: Row, i: number): CellTone => row[`tone${String(i)}`] as CellTone
</script>

<template>
  <DsDataTable
    :data="rows"
    :columns="columns"
    caption="Jadual headcount"
    card-title="name"
    :card-fields="cardFields"
    :page-size="rows.length"
    data-testid="headcount-table"
  >
    <template #select-header>
      <UCheckbox
        :model-value="allSelected"
        aria-label="Pilih semua murid"
        data-testid="select-all"
        @update:model-value="toggleAll"
      />
    </template>
    <template #select-cell="{ row }">
      <UCheckbox
        v-if="!row.original.average && hasId(row.original.userId)"
        :model-value="selected.includes(row.original.userId)"
        :aria-label="`Pilih ${row.original.name}`"
        :data-testid="`select-${String(row.original.userId)}`"
        @update:model-value="toggleOne(row.original.userId, $event)"
      />
    </template>
    <template #name-cell="{ row }">
      <span v-if="row.original.average" class="text-label text-highlighted" data-testid="average-row">{{
        row.original.name
      }}</span>
      <span v-else-if="!hasId(row.original.userId)" data-testid="row-masked">{{
        row.original.name
      }}</span>
      <RouterLink
        v-else
        :to="`/headcount/student/${String(row.original.userId)}`"
        class="inline-flex min-h-11 items-center text-label"
        :class="row.original.dropped ? 'text-dimmed' : 'text-highlighted'"
        :data-testid="`row-${String(row.original.userId)}`"
        :data-dropped="row.original.dropped ? 'true' : 'false'"
        >{{ row.original.name }}</RouterLink
      >
    </template>
    <template v-for="i in otrs" :key="i" #[`ar${String(i)}-cell`]="{ row }">
      <span
:class="TONE[toneOf(row.original, i)]"
        :data-testid="`ar-${String(row.original.userId)}-${String(i + 1)}`"
        :data-tone="toneOf(row.original, i)"
        >{{ row.original[`ar${String(i)}`] }}</span>
    </template>
    <template #card-actions="{ row }">
      <div class="flex items-center gap-2">
        <UCheckbox
          v-if="!row.average && hasId(row.userId)"
          :model-value="selected.includes(row.userId)"
          :aria-label="`Pilih ${row.name}`"
          @update:model-value="toggleOne(row.userId, $event)"
        />
        <UButton
          v-if="!row.average && hasId(row.userId)"
          :to="`/headcount/student/${String(row.userId)}`"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-arrow-right"
          :aria-label="`Buka ${row.name}`"
        />
      </div>
    </template>
  </DsDataTable>
</template>
