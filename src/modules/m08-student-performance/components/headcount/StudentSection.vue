<script setup lang="ts">
/**
 * One S15 section: the card of one config that holds an entry of the pupil (FR-M08-93…96, FR-M08-127,
 * BR-M08-08 rule 1, BR-M08-23/24/33). Status badge, RS badge, summary chips, line chart, the Checkpoint
 * table (cards below `md`) and the "Ketepatan Ramalan ETR vs RS" box.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { type CardField, type ChartSeries, DsChart, DsDataTable, DsPanel } from '@/ds'
import { formatMyt } from '@/lib/time'

import type {
  ConfidenceLabel,
  HeadcountSection,
  PredictionVerdict,
  ProjectionVariant,
  RowTone,
  TrendLabel,
} from '../../api/headcount-types'
import { DASH, fixed1, gradeOfPercent, num1, selisihText } from '../../lib/headcount/format'

const props = defineProps<{ section: HeadcountSection }>()

type BadgeColor = 'success' | 'error' | 'warning' | 'neutral' | 'info'

const STATUS: Record<HeadcountSection['status'], { text: string; color: BadgeColor }> = {
  on: { text: 'On Track', color: 'success' },
  below: { text: 'Below Target', color: 'error' },
  none: { text: 'Belum Ada Data', color: 'neutral' },
}
const PROJECTION: Record<ProjectionVariant, BadgeColor> = {
  green: 'success',
  amber: 'warning',
  red: 'error',
}
const TREND: Record<TrendLabel, { icon: string; color: BadgeColor }> = {
  Meningkat: { icon: 'i-ph-arrow-up', color: 'success' },
  Stabil: { icon: 'i-ph-minus', color: 'warning' },
  Menurun: { icon: 'i-ph-arrow-down', color: 'error' },
}
const CONFIDENCE: Record<ConfidenceLabel, string> = {
  Tinggi: 'text-success',
  Sederhana: 'text-warning',
  Rendah: 'text-dimmed',
}
const ROW_AR: Record<RowTone, string> = {
  on: 'text-success',
  below: 'text-error',
  noAr: 'text-dimmed',
  noTarget: 'text-dimmed',
}
const VERDICT: Record<
  PredictionVerdict,
  { icon: string; iconTone: string; text: string; note: string }
> = {
  'Ramalan Tepat': {
    icon: 'i-ph-check-circle',
    iconTone: 'text-success',
    text: 'text-success',
    note: 'Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah.',
  },
  'Hampir Tepat': {
    icon: 'i-ph-warning-circle',
    iconTone: 'text-warning',
    text: 'text-warning',
    note: 'Ramalan ETR agak tepat — selisih dalam lingkungan ±10 markah. Boleh diperbaiki lagi.',
  },
  'Selisih Besar': {
    icon: 'i-ph-x-circle',
    iconTone: 'text-error',
    text: 'text-error',
    note: 'Selisih melebihi 10 markah. Semak semula kaedah penetapan ETR.',
  },
}

const recorded = computed(() => {
  const at = props.section.rs?.recordedAt
  return at ? formatMyt(`${at.slice(0, 10)}T00:00:00+08:00`, 'd MMM yyyy') : ''
})
const verdict = computed(() =>
  props.section.prediction ? VERDICT[props.section.prediction.verdict] : null,
)

/** The chart lines over TOV, OTR1…OTRn, ETR (+ RS); a missing point is a gap. */
const series = computed<ChartSeries[]>(() => {
  const { target, actual, projection, rs } = props.section.chart
  const gaps = (v: (number | null)[]): number[] => v as number[]
  const out: ChartSeries[] = [
    { label: 'Target (OTR)', data: gaps(target), slot: 1 },
    { label: 'Markah Sebenar (AR)', data: gaps(actual), slot: 2 },
  ]
  if (props.section.projection !== null)
    out.push({ label: 'Unjuran (Trend)', data: gaps(projection), slot: 3 })
  if (rs !== null)
    out.push({
      label: 'RS (SPM Sebenar)',
      data: gaps(props.section.chart.labels.map((l) => (l === 'RS' ? rs : null))),
      slot: 4,
    })
  return out
})

interface Row extends Record<string, unknown> {
  kind: 'otr' | 'etr' | 'rs'
  checkpoint: string
  tone: RowTone
  target: string
  targetGrade: string
  ar: string
  arGrade: string
  arText: string
  note: string
}

const rows = computed<Row[]>(() => {
  const s = props.section
  const out: Row[] = s.rows.map((r) => ({
    kind: 'otr',
    checkpoint: `OTR${String(r.checkpoint)}`,
    tone: r.tone,
    target: r.target === null ? DASH : fixed1(r.target),
    targetGrade: r.targetGrade && r.target !== null ? r.targetGrade : '-',
    ar: r.ar === null ? DASH : fixed1(r.ar),
    arGrade: r.arGrade && r.ar !== null ? r.arGrade : '-',
    arText: r.ar === null ? DASH : `${fixed1(r.ar)} (${r.arGrade ?? '-'})`,
    note: '',
  }))
  out.push({
    kind: 'etr',
    checkpoint: 'ETR (Sasaran Akhir)',
    tone: 'noAr',
    target: s.etr === null ? DASH : fixed1(s.etr),
    targetGrade: s.etr === null ? '-' : gradeOfPercent(s.etr),
    ar: '',
    arGrade: '',
    arText: '',
    note: 'Sasaran akhir',
  })
  if (s.rs)
    out.push({
      kind: 'rs',
      checkpoint: 'RS (SPM Sebenar)',
      tone: 'noAr',
      target: fixed1(s.rs.value),
      targetGrade: gradeOfPercent(s.rs.value),
      ar: '',
      arGrade: '',
      arText: '',
      note: recorded.value ? `Direkod: ${recorded.value}` : '',
    })
  return out
})
const columns: TableColumn<Row>[] = [
  { accessorKey: 'checkpoint', header: 'Checkpoint' },
  { accessorKey: 'target', header: 'Target (%)' },
  { accessorKey: 'targetGrade', header: 'Gred Target' },
  { accessorKey: 'ar', header: 'AR (%)' },
  { accessorKey: 'arGrade', header: 'Gred AR' },
  { id: 'status', header: 'Status' },
]
const cardFields: CardField[] = [
  { key: 'target', label: 'Target (%)' },
  { key: 'targetGrade', label: 'Gred Target' },
  { key: 'arText', label: 'AR (%)' },
  { key: 'note', label: 'Catatan' },
]
const rowTone = (r: Row): string => ROW_AR[r.tone]
const rowTestId =(r: Row, i: number): string =>
  r.kind === 'otr' ? `row-otr-${String(i + 1)}` : `row-${r.kind}`
</script>

<template>
  <section class="flex min-w-0 flex-col gap-4" :data-testid="`section-${section.configId}`">
    <DsPanel>
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h2 class="min-w-0 text-heading break-words text-highlighted">{{ section.subject }}</h2>
          <UBadge
            :color="STATUS[section.status].color"
            variant="subtle"
            :label="STATUS[section.status].text"
            data-testid="status-pill"
          />
          <UBadge
            v-if="section.rs"
            color="primary"
            variant="subtle"
            icon="i-ph-star"
            :label="`RS: ${fixed1(section.rs.value)}% (${gradeOfPercent(section.rs.value)})`"
            data-testid="rs-badge"
          />
        </div>

        <div class="flex flex-wrap gap-2">
          <UBadge
            v-if="section.school"
            color="neutral"
            variant="soft"
            icon="i-ph-buildings"
            :label="section.school"
          />
          <UBadge color="neutral" variant="soft" icon="i-ph-stack" :label="section.levelName" />
          <UBadge color="neutral" variant="soft" icon="i-ph-users" :label="section.className" />
          <UBadge color="neutral" variant="soft" :label="String(section.year)" />
        </div>

        <div class="flex flex-wrap items-center gap-2" data-testid="summary-chips">
          <UBadge
            color="neutral"
            variant="soft"
            data-testid="chip-tov"
            :label="`TOV: ${section.tov === null ? DASH : `${fixed1(section.tov)}% (${gradeOfPercent(section.tov)})`}`"
          />
          <UBadge
            color="neutral"
            variant="soft"
            data-testid="chip-etr"
            :label="`ETR: ${section.etr === null ? DASH : `${fixed1(section.etr)}% (${gradeOfPercent(section.etr)})`}`"
          />
          <UBadge
            v-if="section.rs"
            color="neutral"
            variant="soft"
            data-testid="chip-rs"
            :label="`RS: ${fixed1(section.rs.value)}% (${gradeOfPercent(section.rs.value)})`"
          />
          <template v-if="section.projection">
            <UBadge
              :color="PROJECTION[section.projection.variant]"
              variant="subtle"
              icon="i-ph-trend-up"
              data-testid="chip-projection"
              :data-variant="section.projection.variant"
              :label="`Unjuran: ${num1(section.projection.value)}% (${gradeOfPercent(section.projection.value)})`"
            />
            <UBadge
              :color="TREND[section.projection.trend].color"
              variant="subtle"
              :icon="TREND[section.projection.trend].icon"
              data-testid="chip-trend"
              :label="section.projection.trend"
            />
            <span class="text-caption text-muted" data-testid="chip-confidence"
              >Keyakinan:
              <span :class="[CONFIDENCE[section.projection.confidence], 'text-label']">{{
                section.projection.confidence
              }}</span></span
            >
          </template>
        </div>

        <DsChart
          type="line"
          :title="`Prestasi ${section.subject}`"
          :labels="section.chart.labels"
          :series="series"
          unit="%"
          :heading-level="3"
          :data-testid="`student-chart-${section.configId}`"
        />
      </div>
    </DsPanel>

    <DsDataTable
      :data="rows"
      :columns="columns"
      caption="Checkpoint"
      card-title="checkpoint"
      :card-fields="cardFields"
      :page-size="rows.length"
      :data-testid="`table-${section.configId}`"
    >
      <template #checkpoint-cell="{ row }">
        <span
          class="text-label whitespace-nowrap text-highlighted"
          :data-testid="rowTestId(row.original, row.index)"
          :data-tone="row.original.tone"
          >{{ row.original.checkpoint }}</span
        >
      </template>
      <template #ar-cell="{ row }">
        <span v-if="row.original.kind === 'otr'" :class="rowTone(row.original)">{{
          row.original.ar
        }}</span>
        <span v-else class="text-caption text-muted">{{ row.original.note }}</span>
      </template>
      <template #status-cell="{ row }">
        <UIcon
          v-if="row.original.kind === 'otr' && row.original.tone === 'on'"
          name="i-ph-check-circle"
          class="size-5 text-success"
        />
        <UIcon
          v-else-if="row.original.kind === 'otr' && row.original.tone === 'below'"
          name="i-ph-arrow-down"
          class="size-5 text-error"
        />
        <span v-else class="text-dimmed">{{ DASH }}</span>
      </template>
    </DsDataTable>

    <DsPanel v-if="section.prediction && verdict" data-testid="prediction-box">
      <div class="flex flex-col gap-2">
        <div class="flex items-center gap-2">
          <span :class="[verdict.iconTone, 'flex shrink-0']"
            ><UIcon :name="verdict.icon" class="size-6"
          /></span>
          <h3 class="text-subheading text-highlighted">Ketepatan Ramalan ETR vs RS</h3>
        </div>
        <p class="text-body text-default">
          ETR (Ramalan): {{ fixed1(section.prediction.etr) }}% ({{
            gradeOfPercent(section.prediction.etr)
          }})
        </p>
        <p class="text-body text-default">
          RS (Sebenar): {{ fixed1(section.prediction.rs) }}% ({{
            gradeOfPercent(section.prediction.rs)
          }})
        </p>
        <p class="text-label" data-testid="selisih">
          <span :class="verdict.text"
            >Selisih: {{ selisihText(section.prediction.diff) }} markah</span>
        </p>
        <p class="text-label" data-testid="verdict">
          <span :class="verdict.text">{{ section.prediction.verdict }}</span>
        </p>
        <p class="text-caption text-muted">{{ verdict.note }}</p>
      </div>
    </DsPanel>
  </section>
</template>
