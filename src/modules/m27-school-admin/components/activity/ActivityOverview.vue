<script setup lang="ts">
/**
 * S3 Overview tab (R1-AS-48; M17 FN-M17-8.2.1 to 8.2.6 in the school scope; restyle spec AS-48).
 * Five stat cards ("Murid Pernah Akses", "Cikgu Pernah Akses", "Murid Buat Latihan", "Jumlah Aktiviti",
 * "Skor Purata" = "purata ketepatan sesi", never "Ketepatan"; no "Struktur"), "Trend Aktiviti ({n} hari)"
 * (`DsChart` line), "Pecahan Aktiviti" (`DsChart` bar), "Pelajar Paling Aktif (Top 10)" and "Cikgu Belum
 * Akses ({n})" (the first 10 names with the e-mail, then a link "+ {n} lagi" that opens the Guru tab).
 * Cards: 2 per row below lg, 5 at lg; the three lists are 1 column at 375 and 3 columns from md.
 */
import { computed } from 'vue'

import { DsChart, DsIconChip, DsPanel, type DsAccent } from '@/ds'

import type { SchoolActivityReport } from '../../api/school-admin'
import { count, skorPurata, wholePercent } from './activity-format'

const props = defineProps<{ report: SchoolActivityReport }>()
const emit = defineEmits<{ showTeachers: [] }>()

/** R1-AS-48: the Overview names the first 10 teachers who never accessed; the rest is a link to the Guru tab. */
const NEVER_SHOWN = 10

const o = computed(() => props.report.overview)

const neverShown = computed(() => props.report.teachersNeverLogged.slice(0, NEVER_SHOWN))
const neverMore = computed(() => Math.max(0, props.report.teachersNeverLogged.length - NEVER_SHOWN))

const trendLabels = computed(() => props.report.trend.map((p) => p.label))
const trendSeries = computed(() => [
  { label: 'Aktiviti', data: props.report.trend.map((p) => p.value) },
])

// Ruling 1 (#485): the OPT-MODE-SESI labels, only the modes with a count above 0 (the server sends them that way).
const breakdown = computed(() =>
  props.report.breakdown.modes.map((m) => ({ key: m.label, label: m.label, value: m.count })),
)
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
    label: 'Murid Pernah Akses',
    icon: 'graduation-cap',
    accent: 'action',
    pct: wholePercent(o.value.pupilsLogged, o.value.pupils),
    value: count(o.value.pupilsLogged),
    of: `/ ${count(o.value.pupils)}`,
    note: `${count(o.value.pupils - o.value.pupilsLogged)} belum pernah login`,
    warn: true,
  },
  {
    key: 'teachers-logged',
    label: 'Cikgu Pernah Akses',
    icon: 'chalkboard-teacher',
    accent: 'friend',
    pct: wholePercent(o.value.teachersLogged, o.value.teachers),
    value: count(o.value.teachersLogged),
    of: `/ ${count(o.value.teachers)}`,
    note: `${count(o.value.teachers - o.value.teachersLogged)} belum pernah login`,
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
  {
    key: 'score',
    label: 'Skor Purata',
    icon: 'target',
    accent: 'trial',
    value: skorPurata(o.value.skorPurata),
    note: 'purata ketepatan sesi',
  },
])
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="la-overview">
    <ul class="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-5" data-testid="la-cards">
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
        <h2 class="text-subheading text-highlighted" data-testid="la-trend-title">
          Trend Aktiviti ({{ report.range }} hari)
        </h2>
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
          Aktif (Top 10)
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
        <h2 class="text-subheading text-highlighted" data-testid="la-never-title">
          Cikgu Belum Akses ({{ count(report.teachersNeverLogged.length) }})
        </h2>
        <ul class="mt-3 flex flex-col text-body">
          <li
            v-for="t in neverShown"
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
        <UButton
          v-if="neverMore > 0"
          type="button"
          color="primary"
          variant="link"
          size="lg"
          class="mt-2 px-0"
          :label="`+ ${count(neverMore)} lagi`"
          data-testid="la-never-more"
          @click="emit('showTeachers')"
        />
      </DsPanel>
    </div>
  </div>
</template>
