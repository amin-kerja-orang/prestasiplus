<script setup lang="ts">
/**
 * The pane of the active subject on S7 (FR-M08-49…52): progress ring, 4 KPIs, the encouragement box
 * for an accuracy below 50 (PROPOSED, OQ-M08-08) and "Peta DSKP — Standard Pembelajaran".
 * Text is 12px and up (D-26, D9: the live 11px / 10px text is unreadable).
 */
import { ArrowDown, ArrowUp, HeartHandshake, Map, Minus } from '@lucide/vue'
import { computed } from 'vue'

import type { AnalyticsSubject } from '../../api/types'
import { STATUS_LABEL, TILE_STYLE, TREND_TEXT, accuracyText, ringDash } from '../../lib/analitik'

const props = defineProps<{ subject: AnalyticsSubject }>()

const LEGEND = [
  { status: 'mahir', label: 'Mahir (75%+)' },
  { status: 'sederhana', label: 'Sederhana (50-74%)' },
  { status: 'lemah', label: 'Lemah (<50%)' },
  { status: 'belum', label: 'Belum Cuba' },
] as const

const dots = computed(() => [
  { id: 'mahir', color: 'bg-green-500', count: props.subject.counts.mahir },
  { id: 'sederhana', color: 'bg-yellow-400', count: props.subject.counts.sederhana },
  { id: 'lemah', color: 'bg-red-500', count: props.subject.counts.lemah },
  { id: 'belum', color: 'bg-slate-200', count: props.subject.counts.belum },
])
</script>

<template>
  <div class="min-w-0 space-y-5" :data-testid="`pane-${subject.subjectId}`">
    <div class="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div
        class="flex min-w-0 flex-col items-center justify-center rounded-2xl bg-white p-5 shadow"
        data-testid="ring-card"
      >
        <div class="relative h-32 w-32">
          <svg viewBox="0 0 120 120" class="h-32 w-32 -rotate-90">
            <circle cx="60" cy="60" r="50" fill="none" stroke-width="12" class="stroke-slate-100" />
            <circle
              cx="60"
              cy="60"
              r="50"
              fill="none"
              stroke-width="12"
              stroke-linecap="round"
              class="stroke-green-500"
              :stroke-dasharray="ringDash(subject.counts.mahir, subject.ringTotal)"
              data-testid="ring-arc"
            />
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-2xl font-bold text-slate-800" data-testid="ring-mahir">{{
              subject.counts.mahir
            }}</span>
            <span class="text-xs text-slate-400" data-testid="ring-total"
              >/ {{ subject.ringTotal }} SP</span
            >
          </div>
        </div>
        <p class="mt-3 text-sm font-semibold text-slate-700">Standard Dikuasai</p>
        <div class="mt-2 flex items-center gap-3 text-xs text-slate-500" data-testid="ring-legend">
          <span v-for="d in dots" :key="d.id" class="flex items-center gap-1">
            <span :class="['h-2.5 w-2.5 rounded-full', d.color]"></span>{{ d.count }}
          </span>
        </div>
      </div>

      <div class="min-w-0 rounded-2xl bg-white p-5 shadow lg:col-span-2">
        <div class="grid grid-cols-2 gap-4 text-center sm:grid-cols-4" data-testid="kpis">
          <div>
            <p
              :class="['text-2xl font-bold', accuracyText(subject.accuracy)]"
              data-testid="kpi-acc"
            >
              {{ subject.accuracy.toFixed(1) }}%
            </p>
            <p class="text-xs text-slate-400">Ketepatan</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-slate-700" data-testid="kpi-answered">
              {{ subject.answered }}
            </p>
            <p class="text-xs text-slate-400">Soalan Dijawab</p>
          </div>
          <div>
            <p
              class="flex h-8 items-center justify-center text-2xl font-bold"
              data-testid="kpi-trend"
            >
              <ArrowUp v-if="subject.trend === 'up'" :class="['h-6 w-6', TREND_TEXT.up]" />
              <ArrowDown
                v-else-if="subject.trend === 'down'"
                :class="['h-6 w-6', TREND_TEXT.down]"
              />
              <Minus v-else :class="['h-6 w-6', TREND_TEXT.stable]" />
            </p>
            <p class="text-xs text-slate-400">Trend 30 Hari</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-blue-600" data-testid="kpi-grade">
              {{ subject.projection.low }} – {{ subject.projection.high }}
            </p>
            <p class="text-xs text-slate-400">Unjuran Gred</p>
          </div>
        </div>
        <div
          v-if="subject.accuracy < 50"
          class="mt-4 flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"
          data-testid="encourage-box"
        >
          <HeartHandshake class="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            Jangan putus asa! Latihan konsisten akan membantu. Mulakan dengan topik yang paling
            lemah di bawah.
          </p>
        </div>
      </div>
    </div>

    <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="dskp-map">
      <h3 class="flex items-center gap-2 text-sm font-bold text-slate-700">
        <Map class="h-4 w-4 text-blue-500" />Peta DSKP — Standard Pembelajaran
      </h3>
      <p
        class="mt-3 text-xs font-semibold tracking-wide text-slate-500 uppercase"
        data-testid="map-caption"
      >
        {{ subject.map.caption }}
      </p>
      <div class="mt-2 flex flex-wrap gap-2" data-testid="map-tiles">
        <div
          v-for="t in subject.map.tiles"
          :key="t.spId"
          :class="[
            'flex h-11 min-w-11 items-center justify-center rounded-lg border px-1 text-xs font-semibold',
            TILE_STYLE[t.status],
          ]"
          :title="`${t.code}: ${t.title} — ${STATUS_LABEL[t.status]}`"
          :data-testid="`tile-${t.spId}`"
        >
          {{ t.code }}
        </div>
      </div>
      <div
        class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500"
        data-testid="map-legend"
      >
        <span v-for="l in LEGEND" :key="l.status" class="flex items-center gap-1.5">
          <span :class="['h-3 w-3 rounded border', TILE_STYLE[l.status]]"></span>{{ l.label }}
        </span>
        <span class="flex items-center gap-1.5">
          <span class="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700"
            >Fokus</span
          >Klik untuk latihan fokus
        </span>
      </div>
    </section>
  </div>
</template>
