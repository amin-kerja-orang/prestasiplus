<script setup lang="ts">
/**
 * One S15 section: the card of one config that holds an entry of the pupil (FR-M08-93…96, FR-M08-127,
 * BR-M08-08 rule 1, BR-M08-23/24/33). Status pill, RS badge, summary chips, 200px line chart, the
 * Checkpoint table (scrolls inside the card) and the "Ketepatan Ramalan ETR vs RS" box.
 */
import {
  ArrowDown,
  ArrowUp,
  CircleAlert,
  CircleCheck,
  CircleX,
  Layers,
  Minus,
  School,
  Star,
  TrendingUp,
  Users,
} from '@lucide/vue'
import { computed } from 'vue'

import { ChartCanvas } from '@/components/chart'
import { TABLE_CLASSES as T } from '@/components/data'
import { formatMyt } from '@/lib/time'

import type {
  ConfidenceLabel,
  HeadcountSection,
  PredictionVerdict,
  ProjectionVariant,
  RowTone,
  TrendLabel,
} from '../../api/headcount-types'
import { studentChartData, studentChartOptions } from '../../lib/headcount/charts'
import { DASH, fixed1, gradeOfPercent, num1, selisihText } from '../../lib/headcount/format'

const props = defineProps<{ section: HeadcountSection }>()

const STATUS: Record<HeadcountSection['status'], { text: string; cls: string }> = {
  on: { text: 'On Track', cls: 'bg-green-100 text-green-700' },
  below: { text: 'Below Target', cls: 'bg-red-100 text-red-700' },
  none: { text: 'Belum Ada Data', cls: 'bg-slate-100 text-slate-500' },
}

const PROJECTION: Record<ProjectionVariant, string> = {
  green: 'border-green-200 bg-green-50 text-green-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  red: 'border-red-200 bg-red-50 text-red-700',
}
const TREND = {
  Meningkat: { icon: ArrowUp, cls: 'border-green-200 bg-green-50 text-green-700' },
  Stabil: { icon: Minus, cls: 'border-amber-200 bg-amber-50 text-amber-700' },
  Menurun: { icon: ArrowDown, cls: 'border-red-200 bg-red-50 text-red-700' },
} satisfies Record<TrendLabel, { icon: unknown; cls: string }>
const CONFIDENCE: Record<ConfidenceLabel, string> = {
  Tinggi: 'text-green-600',
  Sederhana: 'text-amber-600',
  Rendah: 'text-slate-400',
}

const ROW: Record<RowTone, { row: string; ar: string; grade: string }> = {
  on: { row: 'bg-green-50', ar: 'text-green-700', grade: 'bg-green-100 text-green-700' },
  below: {
    row: 'border-l-4 border-l-red-400 bg-red-100',
    ar: 'text-red-700',
    grade: 'bg-red-100 text-red-700',
  },
  noAr: { row: '', ar: 'text-slate-400', grade: 'bg-slate-100 text-slate-500' },
  noTarget: { row: '', ar: 'text-slate-400', grade: 'bg-slate-100 text-slate-500' },
}

const VERDICT: Record<
  PredictionVerdict,
  { box: string; icon: unknown; iconCls: string; text: string; note: string }
> = {
  'Ramalan Tepat': {
    box: 'border-green-200 bg-green-50',
    icon: CircleCheck,
    iconCls: 'text-green-500',
    text: 'text-green-700',
    note: 'Ramalan ETR sangat tepat — selisih dalam lingkungan ±5 markah.',
  },
  'Hampir Tepat': {
    box: 'border-amber-200 bg-amber-50',
    icon: CircleAlert,
    iconCls: 'text-amber-500',
    text: 'text-amber-700',
    note: 'Ramalan ETR agak tepat — selisih dalam lingkungan ±10 markah. Boleh diperbaiki lagi.',
  },
  'Selisih Besar': {
    box: 'border-red-200 bg-red-50',
    icon: CircleX,
    iconCls: 'text-red-500',
    text: 'text-red-700',
    note: 'Selisih melebihi 10 markah. Semak semula kaedah penetapan ETR.',
  },
}

const CHIP = 'inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold'
const PILL = 'rounded-full px-2 py-0.5 text-xs font-semibold'

const chartData = computed(() => studentChartData(props.section))
const recorded = computed(() => {
  const at = props.section.rs?.recordedAt
  return at ? formatMyt(`${at.slice(0, 10)}T00:00:00+08:00`, 'd MMM yyyy') : ''
})
const verdict = computed(() =>
  props.section.prediction ? VERDICT[props.section.prediction.verdict] : null,
)
</script>

<template>
  <section
    class="min-w-0 space-y-4 rounded-2xl bg-white p-4 shadow sm:p-5"
    :data-testid="`section-${section.configId}`"
  >
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h2 class="min-w-0 text-lg font-bold break-words text-slate-800">{{ section.subject }}</h2>
      <span :class="[PILL, STATUS[section.status].cls]" data-testid="status-pill">{{
        STATUS[section.status].text
      }}</span>
      <span
        v-if="section.rs"
        class="inline-flex items-center gap-1 rounded-full bg-indigo-700 px-2.5 py-0.5 text-xs font-semibold text-white"
        data-testid="rs-badge"
      >
        <Star class="h-3.5 w-3.5 text-yellow-300" />RS: {{ fixed1(section.rs.value) }}% ({{
          gradeOfPercent(section.rs.value)
        }})
      </span>
    </div>

    <div class="flex flex-wrap gap-2 text-xs">
      <span v-if="section.school" :class="[CHIP, 'border-blue-100 bg-blue-50 text-blue-700']"
        ><School class="h-3.5 w-3.5" />{{ section.school }}</span
      >
      <span :class="[CHIP, 'border-slate-200 bg-slate-50 text-slate-600']"
        ><Layers class="h-3.5 w-3.5" />{{ section.levelName }}</span
      >
      <span :class="[CHIP, 'border-slate-200 bg-slate-50 text-slate-600']"
        ><Users class="h-3.5 w-3.5" />{{ section.className }}</span
      >
      <span :class="[CHIP, 'border-slate-200 bg-slate-50 text-slate-600']">{{ section.year }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2" data-testid="summary-chips">
      <span :class="[CHIP, 'border-amber-200 bg-amber-50 text-amber-700']" data-testid="chip-tov">
        TOV:
        {{
          section.tov === null ? DASH : `${fixed1(section.tov)}% (${gradeOfPercent(section.tov)})`
        }}
      </span>
      <span
        :class="[CHIP, 'border-purple-200 bg-purple-50 text-purple-700']"
        data-testid="chip-etr"
      >
        ETR:
        {{
          section.etr === null ? DASH : `${fixed1(section.etr)}% (${gradeOfPercent(section.etr)})`
        }}
      </span>
      <span
        v-if="section.rs"
        :class="[CHIP, 'border-indigo-200 bg-indigo-50']"
        data-testid="chip-rs"
      >
        <span class="text-indigo-600">RS:</span>
        <span class="text-indigo-700"
          >{{ fixed1(section.rs.value) }}% ({{ gradeOfPercent(section.rs.value) }})</span
        >
      </span>
      <template v-if="section.projection">
        <span :class="[CHIP, PROJECTION[section.projection.variant]]" data-testid="chip-projection">
          <TrendingUp class="h-3.5 w-3.5" />Unjuran: {{ num1(section.projection.value) }}% ({{
            gradeOfPercent(section.projection.value)
          }})
        </span>
        <span :class="[CHIP, TREND[section.projection.trend].cls]" data-testid="chip-trend">
          <component :is="TREND[section.projection.trend].icon" class="h-3.5 w-3.5" />{{
            section.projection.trend
          }}
        </span>
        <span class="text-xs text-slate-500" data-testid="chip-confidence"
          >Keyakinan:
          <strong :class="CONFIDENCE[section.projection.confidence]">{{
            section.projection.confidence
          }}</strong></span
        >
      </template>
    </div>

    <ChartCanvas
      type="line"
      :data="chartData"
      :options="studentChartOptions"
      height="200px"
      :test-id="`student-chart-${section.configId}`"
    />

    <div :class="[T.card, 'rounded-xl']">
      <div :class="T.scroller">
        <table :class="[T.table, 'min-w-[34rem]']" :data-testid="`table-${section.configId}`">
          <thead>
            <tr class="bg-slate-50">
              <th :class="T.th">Checkpoint</th>
              <th :class="T.th">Target (%)</th>
              <th :class="T.th">Gred Target</th>
              <th :class="T.th">AR (%)</th>
              <th :class="T.th">Gred AR</th>
              <th :class="[T.th, 'text-center']">Status</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="r in section.rows"
              :key="r.checkpoint"
              :class="[T.row, ROW[r.tone].row]"
              :data-testid="`row-otr-${r.checkpoint}`"
              :data-tone="r.tone"
            >
              <td :class="[T.td, 'font-semibold whitespace-nowrap']">OTR{{ r.checkpoint }}</td>
              <td
                :class="[
                  T.td,
                  r.target === null ? 'text-slate-400' : 'font-semibold text-blue-700',
                ]"
              >
                {{ r.target === null ? DASH : fixed1(r.target) }}
              </td>
              <td :class="T.td">
                <span
                  v-if="r.targetGrade && r.target !== null"
                  :class="[PILL, 'bg-blue-100 text-blue-600']"
                  >{{ r.targetGrade }}</span
                >
                <span v-else class="text-slate-400">-</span>
              </td>
              <td :class="[T.td, 'font-semibold', ROW[r.tone].ar]">
                {{ r.ar === null ? DASH : fixed1(r.ar) }}
              </td>
              <td :class="T.td">
                <span v-if="r.arGrade && r.ar !== null" :class="[PILL, ROW[r.tone].grade]">{{
                  r.arGrade
                }}</span>
                <span v-else class="text-slate-400">-</span>
              </td>
              <td :class="[T.td, 'text-center']">
                <CircleCheck v-if="r.tone === 'on'" class="mx-auto h-4 w-4 text-green-500" />
                <ArrowDown v-else-if="r.tone === 'below'" class="mx-auto h-4 w-4 text-red-500" />
                <span v-else class="text-slate-300">{{ DASH }}</span>
              </td>
            </tr>
            <tr :class="[T.row, 'bg-purple-50']" data-testid="row-etr">
              <td :class="[T.td, 'font-semibold whitespace-nowrap text-purple-700']">
                ETR (Sasaran Akhir)
              </td>
              <td :class="[T.td, 'font-semibold text-purple-700']">
                {{ section.etr === null ? DASH : fixed1(section.etr) }}
              </td>
              <td :class="T.td">
                <span
                  v-if="section.etr !== null"
                  :class="[PILL, 'bg-purple-100 text-purple-700']"
                  >{{ gradeOfPercent(section.etr) }}</span
                >
                <span v-else class="text-slate-400">-</span>
              </td>
              <td :class="[T.td, 'text-xs text-purple-500']" colspan="3">Sasaran akhir</td>
            </tr>
            <tr
              v-if="section.rs"
              :class="[T.row, 'border-l-4 border-l-indigo-400 bg-indigo-50']"
              data-testid="row-rs"
            >
              <td :class="[T.td, 'font-semibold whitespace-nowrap text-indigo-700']">
                <span class="inline-flex items-center gap-1"
                  ><Star class="h-4 w-4 text-yellow-500" />RS (SPM Sebenar)</span
                >
              </td>
              <td :class="[T.td, 'text-base font-bold text-indigo-700']">
                {{ fixed1(section.rs.value) }}
              </td>
              <td :class="T.td">
                <span :class="[PILL, 'bg-indigo-200 text-indigo-800']">{{
                  gradeOfPercent(section.rs.value)
                }}</span>
              </td>
              <td :class="[T.td, 'text-xs text-indigo-500']" colspan="3">
                <template v-if="recorded">Direkod: {{ recorded }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div
      v-if="section.prediction && verdict"
      :class="['space-y-2 rounded-xl border p-4', verdict.box]"
      data-testid="prediction-box"
    >
      <div class="flex items-center gap-2">
        <component :is="verdict.icon" :class="['h-5 w-5 shrink-0', verdict.iconCls]" />
        <h3 class="text-sm font-bold text-slate-700">Ketepatan Ramalan ETR vs RS</h3>
      </div>
      <p class="text-sm text-purple-700">
        ETR (Ramalan): {{ fixed1(section.prediction.etr) }}% ({{
          gradeOfPercent(section.prediction.etr)
        }})
      </p>
      <p class="text-sm text-indigo-700">
        RS (Sebenar): {{ fixed1(section.prediction.rs) }}% ({{
          gradeOfPercent(section.prediction.rs)
        }})
      </p>
      <p :class="['text-sm font-semibold', verdict.text]" data-testid="selisih">
        Selisih: {{ selisihText(section.prediction.diff) }} markah
      </p>
      <p :class="['text-sm font-bold', verdict.text]" data-testid="verdict">
        {{ section.prediction.verdict }}
      </p>
      <p class="text-xs text-slate-400">{{ verdict.note }}</p>
    </div>
  </section>
</template>
