<script setup lang="ts">
/**
 * S3 Overview tab (FR-M27-68, 69, 70; M17 FN-M17-8.2.1 to 8.2.6 in the school scope; restyle spec AS-48).
 * Four stat cards ("Murid Pernah Login", "Cikgu Pernah Login", "Murid Buat Latihan", "Jumlah Aktiviti"; no
 * "Skor Purata" and no "Struktur"), "Trend Aktiviti" (`DsChart` line), "Pecahan Aktiviti" (`DsChart` bar),
 * "Pelajar Paling Aktif" (at most 10) and "Cikgu Belum Login" (at most 20, name A to Z with the e-mail).
 * Cards: 2 per row below lg, 4 at lg; the three lists are 1 column at 375 and 3 columns from md.
 */
import { computed } from 'vue'

import { DsChart, DsIconChip, DsPanel, type DsAccent } from '@/ds'

import type { SchoolActivityReport } from '../../api/school-admin'
import { count, wholePercent } from './activity-format'

const props = defineProps<{ report: SchoolActivityReport }>()

const o = computed(() => props.report.overview)

const trendLabels = computed(() => props.report.trend.map((p) => p.label))
const trendSeries = computed(() => [
  { label: 'Aktiviti', data: props.report.trend.map((p) => p.value) },
])

const breakdown = computed(() => [
  { key: 'quiz', label: 'Kuiz Objektif', value: props.report.breakdown.quiz },
  { key: 'structured', label: 'Soalan Berstruktur', value: props.report.breakdown.structured },
  { key: 'battle', label: 'Battle Arena', value: props.report.breakdown.battle },
  { key: 'game', label: 'Permainan', value: props.report.breakdown.game },
])
const breakdownLabels = computed(() => breakdown.value.map((b) => b.label))
const breakdownSeries = computed(() => [
  { label: 'Aktiviti', data: breakdown.value.map((b) => b.value) },
])

interface Card {
  key: string
  label: string
  icon: string
  accent: DsAccent
  pct?: string
  value: string
  of?: string
  note?: string
  warn?: boolean
}
const cards = computed<Card[]>(() => [
  {
    key: 'pupils-logged',
    label: 'Murid Pernah Log Masuk',
    icon: 'graduation-cap',
    accent: 'action',
    pct: wholePercent(o.value.pupilsLogged, o.value.pupils),
    value: count(o.value.pupilsLogged),
    of: `/ ${count(o.value.pupils)}`,
    note: `${count(o.value.pupils - o.value.pupilsLogged)} belum pernah log masuk`,
    warn: true,
  },
  {
    key: 'teachers-logged',
    label: 'Cikgu Pernah Log Masuk',
    icon: 'chalkboard-teacher',
    accent: 'friend',
    pct: wholePercent(o.value.teachersLogged, o.value.teachers),
    value: count(o.value.teachersLogged),
    of: `/ ${count(o.value.teachers)}`,
    note: `${count(o.value.teachers - o.value.teachersLogged)} belum pernah log masuk`,
    warn: true,
  },
  {
    key: 'practised',
    label: 'Murid Buat Latihan',
    icon: 'clipboard-text',
    accent: 'win',
    pct: wholePercent(o.value.practised, o.value.pupils),
    value: count(o.value.practised),
    of: `/ ${count(o.value.pupils)}`,
  },
  {
    key: 'activity',
    label: 'Jumlah Aktiviti',
    icon: 'chart-line-up',
    accent: 'heat',
    value: count(o.value.activity),
    note: `${String(props.report.range)} hari lepas`,
  },
])
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="la-overview">
    <ul class="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4" data-testid="la-cards">
      <li v-for="c in cards" :key="c.key" class="min-w-0">
        <DsPanel
          class="h-full"
          :data-testid="`la-card-${c.key}`"
        >
          <div class="flex min-w-0 flex-col items-start gap-2">
          <DsIconChip :icon="c.icon" :accent="c.accent" />
          <p class="text-caption break-words text-muted" data-testid="la-card-label">
            {{ c.label }}
          </p>
          <p v-if="c.pct" class="tabular text-heading text-highlighted" data-testid="la-card-pct">
            {{ c.pct }}
          </p>
          <p
            :class="
              c.pct ? 'text-label break-words text-muted' : 'tabular text-heading break-words text-highlighted'
            "
          >
            <span data-testid="la-card-value">{{ c.value }}</span>
            <span v-if="c.of" class="ms-1 text-muted" data-testid="la-card-of">{{ c.of }}</span>
          </p>
          <p
            v-if="c.note"
            class="flex items-center gap-1 text-caption text-muted"
            data-testid="la-card-note"
          >
            <UIcon v-if="c.warn" name="i-ph-warning-circle" class="size-4 shrink-0" aria-hidden="true" />{{
              c.note
            }}
          </p>
          </div>
        </DsPanel>
      </li>
    </ul>

    <DsPanel data-testid="la-trend">
      <div class="flex min-w-0 flex-col gap-3">
        <h2 class="text-subheading text-highlighted" data-testid="la-trend-title">Trend Aktiviti</h2>
        <DsChart
          type="line"
          title="Trend aktiviti"
          table-label="Trend aktiviti"
          :labels="trendLabels"
          :series="trendSeries"
          data-testid="la-trend-chart"
        />
      </div>
    </DsPanel>

    <div class="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-3">
      <DsPanel data-testid="la-breakdown">
        <h2 class="text-subheading text-highlighted">Pecahan Aktiviti</h2>
        <DsChart
          class="mt-3"
          type="bar"
          horizontal
          title="Pecahan aktiviti"
          table-label="Pecahan aktiviti"
          :labels="breakdownLabels"
          :series="breakdownSeries"
        />
        <ul class="mt-3 flex flex-col text-body">
          <li
            v-for="b in breakdown"
            :key="b.key"
            class="flex items-center justify-between gap-3 py-2 even:bg-soft"
            data-testid="la-breakdown-row"
          >
            <span class="text-muted" data-testid="la-breakdown-label">{{ b.label }}</span>
            <span class="tabular text-label text-highlighted" data-testid="la-breakdown-value">{{
              count(b.value)
            }}</span>
          </li>
        </ul>
      </DsPanel>

      <DsPanel data-testid="la-top">
        <h2 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-trophy" class="size-5 text-primary-t" aria-hidden="true" />Pelajar Paling
          Aktif
        </h2>
        <ol class="mt-3 flex flex-col text-body">
          <li
            v-for="(p, i) in report.topPupils"
            :key="p.userId"
            class="flex min-w-0 items-center gap-3 py-2 even:bg-soft"
            data-testid="la-top-row"
          >
            <UBadge
              color="neutral"
              variant="soft"
              :label="String(i + 1)"
              data-testid="la-top-rank"
            />
            <span class="min-w-0 flex-1 truncate text-highlighted" data-testid="la-top-name">{{
              p.name
            }}</span>
            <span class="tabular text-label text-highlighted" data-testid="la-top-count">{{
              count(p.activities)
            }}</span>
          </li>
        </ol>
      </DsPanel>

      <DsPanel data-testid="la-never">
        <h2 class="text-subheading text-highlighted">Cikgu Belum Log Masuk</h2>
        <ul class="mt-3 flex flex-col text-body">
          <li
            v-for="t in report.teachersNeverLogged"
            :key="t.userId"
            class="min-w-0 py-2 even:bg-soft"
            data-testid="la-never-row"
          >
            <p class="truncate text-label text-highlighted" data-testid="la-never-name">
              {{ t.name }}
            </p>
            <p class="truncate text-caption text-muted" data-testid="la-never-email">
              {{ t.email }}
            </p>
          </li>
        </ul>
      </DsPanel>
    </div>
  </div>
</template>
