<script setup lang="ts">
/**
 * S7 "{pelajar} - Command Center" (M17 FR-M17-53..59, FN-M17-5.4.x): back link "← Kembali ke Kelas",
 * breadcrumb, five cards ("Jumlah Jawapan 🔍" opens all sessions), "Pecahan Subjek", "Aktiviti Mingguan
 * (8 Minggu)" (a 0 bar ignores clicks), "Trend Mood (30 Hari)" (a dot opens the mood-day modal from page
 * data), "HeadCount" (a row opens the headcount modal) and "ALESA AI Insight". The sessions, session,
 * headcount and mood-day modals are opened from here. The route prefix is a prop.
 */
import { computed, ref } from 'vue'

import { LoadingSpinner } from '@/components/feedback'

import { fetchCcStudent } from '../api/command-center'
import type { CcMoodDot, CcWeek } from '../api/command-center-types'
import {
  CC_TABLE as T,
  type CcSessionsSource,
  count,
  dmyOfKey,
  MOOD,
  LOAD_ERROR_COPY,
  pct1,
  score2,
} from '../components/command-center/cc-format'
import { ccPaths } from '../components/command-center/cc-paths'
import CcFrame from '../components/command-center/CcFrame.vue'
import CcHeadcountModal from '../components/command-center/CcHeadcountModal.vue'
import CcMoodDayModal from '../components/command-center/CcMoodDayModal.vue'
import CcPanel from '../components/command-center/CcPanel.vue'
import CcSessionDetailModal from '../components/command-center/CcSessionDetailModal.vue'
import CcSessionsModal from '../components/command-center/CcSessionsModal.vue'
import CcStatCard from '../components/command-center/CcStatCard.vue'
import { useCcPage } from '../components/command-center/use-cc-page'

const props = withDefaults(defineProps<{ userId: number; basePath?: string }>(), {
  basePath: '/admin/command-center',
})

const paths = computed(() => ccPaths(props.basePath))

const { data, error, notFound } = useCcPage(
  (signal) => fetchCcStudent(props.userId, { signal }),
  () => props.userId,
  (d) => d.student.name,
)

const classLink = computed(() =>
  data.value?.class ? paths.value.classroom(data.value.class.id) : undefined,
)
const crumbs = computed(() => {
  const d = data.value
  if (!d) return [{ label: 'Command Center', to: paths.value.overview }]
  return [
    { label: 'Command Center', to: paths.value.overview },
    ...(d.school ? [{ label: d.school.name, to: paths.value.school(d.school.id) }] : []),
    ...(d.teacher
      ? [
          {
            label: d.teacher.name,
            to: d.school ? paths.value.teacher(d.school.id, d.teacher.id) : undefined,
          },
        ]
      : []),
    ...(d.class ? [{ label: d.class.name, to: classLink.value }] : []),
    { label: d.student.name },
  ]
})

// --- modals ---------------------------------------------------------------------------------
const sessionsSource = ref<CcSessionsSource | null>(null)
const sessionId = ref<string | null>(null)
const headcount = ref<{ configId: number; subject: string } | null>(null)
const moodDay = ref<(CcMoodDot & { noSession: boolean }) | null>(null)

function openWeek(week: CcWeek) {
  if (week.count === 0) return
  sessionsSource.value = { kind: 'week', start: week.start, end: week.end, label: week.label }
}
function openMood(dot: CcMoodDot) {
  const weeks = data.value?.weeks ?? []
  const week = weeks.find((w) => w.start <= dot.date && dot.date <= w.end)
  moodDay.value = { ...dot, noSession: week !== undefined && week.count === 0 }
}

const maxWeek = computed(() => Math.max(0, ...(data.value?.weeks ?? []).map((w) => w.count)))
function barHeight(n: number): string {
  if (n === 0 || maxWeek.value === 0) return '2px'
  return `${String(Math.max(4, Math.round((n / maxWeek.value) * 100)))}%`
}
const HEADCOUNT_COLUMNS = ['Subjek', 'TOV', 'ETR', 'RS', 'Gred', 'Tarikh']
</script>

<template>
  <CcFrame
    v-if="!notFound"
    :back-to="classLink ?? paths.overview"
    back-label="← Kembali ke Kelas"
    :crumbs="crumbs"
  >
    <p v-if="error" class="text-sm text-rose-400" data-testid="cc-error">{{ LOAD_ERROR_COPY }}</p>
    <p
      v-else-if="!data"
      class="flex items-center gap-2 text-sm text-slate-400"
      data-testid="cc-loading"
    >
      <LoadingSpinner class="h-4 w-4" aria-hidden="true" />Memuatkan...
    </p>
    <template v-else>
      <div
        class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
        data-testid="cc-student-cards"
      >
        <CcStatCard
          label="Jumlah Jawapan"
          :value="count(data.cards.answers)"
          accent="indigo"
          click-title="Klik untuk lihat semua sesi"
          @click="sessionsSource = { kind: 'all' }"
        />
        <CcStatCard label="Ketepatan" :value="pct1(data.cards.accuracy)" accent="emerald" />
        <CcStatCard label="Hari Aktif" :value="String(data.cards.activeDays)" accent="amber" />
        <CcStatCard label="Streak" :value="String(data.cards.streak)" accent="rose" />
        <CcStatCard
          label="Konsistensi"
          :value="`${String(data.cards.consistency)}%`"
          accent="cyan"
        />
      </div>

      <div class="grid gap-4 md:grid-cols-2">
        <CcPanel icon="📊" title="Pecahan Subjek">
          <ul class="space-y-1" data-testid="cc-subjects">
            <li v-for="s in data.subjects" :key="s.code">
              <div
                title="Klik untuk lihat sesi"
                class="grid min-h-11 w-full cursor-pointer grid-cols-[minmax(0,7rem)_minmax(0,1fr)_auto] items-center gap-3 rounded-lg text-left text-sm hover:bg-slate-700/40 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto]"
                data-testid="cc-subject-row"
                :data-code="s.code"
                @click="sessionsSource = { kind: 'subject', code: s.code, name: s.label }"
              >
                <span class="min-w-0 font-medium break-words text-slate-50"
                  >{{ s.label }} <span aria-hidden="true">🔍</span></span
                >
                <span class="h-4 overflow-hidden rounded bg-slate-900" aria-hidden="true">
                  <span
                    class="flex h-full items-center rounded bg-emerald-500 px-1.5 font-mono text-xs font-bold text-slate-900"
                    :style="{ width: `${String(Math.min(100, s.pct))}%` }"
                    >{{ pct1(s.pct) }}</span
                  >
                </span>
                <span class="font-mono text-xs text-slate-400" data-testid="cc-subject-ratio"
                  >{{ s.correct }}/{{ s.total }}</span
                >
              </div>
            </li>
          </ul>
        </CcPanel>

        <CcPanel icon="📈" title="Aktiviti Mingguan (8 Minggu)">
          <ul class="grid grid-cols-8 gap-1.5 sm:gap-2" data-testid="cc-weeks">
            <li v-for="w in data.weeks" :key="w.start" class="min-w-0">
              <div
                class="flex h-40 w-full flex-col items-center justify-end gap-1 rounded"
                :class="w.count === 0 ? '' : 'cursor-pointer hover:bg-slate-700/40'"
                data-testid="cc-week"
                :data-start="w.start"
                :data-count="w.count"
                @click="openWeek(w)"
              >
                <span class="font-mono text-xs text-slate-300">{{ w.count }}</span>
                <span class="flex w-full flex-1 items-end">
                  <span
                    class="block w-full rounded-t bg-indigo-500"
                    :style="{ height: barHeight(w.count) }"
                    data-testid="cc-week-bar"
                  />
                </span>
                <span class="font-mono text-xs text-slate-400" data-testid="cc-week-label"
                  ><span class="block sm:inline">{{ w.label.slice(0, 2) }}</span
                  ><span class="block sm:inline">{{ w.label.slice(2) }}</span></span
                >
              </div>
            </li>
          </ul>
        </CcPanel>

        <CcPanel icon="💚" title="Trend Mood (30 Hari)">
          <p
            v-if="data.moodTrend.length === 0"
            class="text-sm text-slate-400"
            data-testid="cc-mood-empty"
          >
            Tiada data mood
          </p>
          <ul v-else class="flex flex-wrap gap-1" data-testid="cc-mood-dots">
            <li v-for="d in data.moodTrend" :key="d.date">
              <div
                :title="`${d.date} — ${MOOD[d.mood].label}`"
                class="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-full text-xl hover:bg-slate-700/60"
                data-testid="cc-mood-dot"
                :data-date="d.date"
                @click="openMood(d)"
              >
                {{ MOOD[d.mood].emoji }}
              </div>
            </li>
          </ul>
        </CcPanel>

        <CcPanel icon="📋" title="HeadCount">
          <div class="overflow-x-auto" data-testid="cc-table-scroller">
            <table :class="[T.table, 'min-w-[360px]']" data-testid="cc-headcount-table">
              <thead>
                <tr>
                  <th v-for="c in HEADCOUNT_COLUMNS" :key="c" :class="T.th">{{ c }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="h in data.headcount"
                  :key="h.configId"
                  :class="[T.row, T.rowLink]"
                  title="Klik untuk lihat semua pelajar"
                  data-testid="cc-headcount-row"
                  :data-config-id="h.configId"
                  @click="headcount = { configId: h.configId, subject: h.subject }"
                >
                  <td :class="[T.td, 'font-medium text-slate-50']">
                    {{ h.subject }} <span aria-hidden="true">🔍</span>
                  </td>
                  <td :class="[T.td, 'font-mono']">{{ score2(h.tov) }}</td>
                  <td :class="[T.td, 'font-mono']">{{ score2(h.etr) }}</td>
                  <td :class="[T.td, 'font-mono']">{{ score2(h.rs) }}</td>
                  <td :class="T.td">{{ h.grade ?? '-' }}</td>
                  <td :class="[T.td, 'font-mono text-xs whitespace-nowrap text-slate-400']">
                    {{ dmyOfKey(h.date) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CcPanel>
      </div>

      <CcPanel icon="🤖" title="ALESA AI Insight">
        <div
          class="rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4"
          data-testid="cc-insight"
        >
          <div class="text-xs font-bold tracking-wider text-indigo-400 uppercase">
            Analisis ALESA
          </div>
          <p class="mt-1 text-base text-slate-100" data-testid="cc-insight-text">
            {{ data.insight.texts.join(' ') }}
          </p>
          <p class="mt-2 text-right text-xs text-slate-400">Sumber: {{ data.insight.source }}</p>
        </div>
      </CcPanel>

      <CcSessionsModal
        v-if="sessionsSource"
        :user-id="userId"
        :source="sessionsSource"
        @close="sessionsSource = null"
        @open-session="(id) => (sessionId = id)"
      />
      <CcSessionDetailModal v-if="sessionId" :session-id="sessionId" @close="sessionId = null" />
      <CcHeadcountModal
        v-if="headcount"
        :config-id="headcount.configId"
        :subject="headcount.subject"
        @close="headcount = null"
      />
      <CcMoodDayModal
        v-if="moodDay"
        :date="moodDay.date"
        :mood="moodDay.mood"
        :reason="moodDay.reason"
        :no-session="moodDay.noSession"
        @close="moodDay = null"
      />
    </template>
  </CcFrame>
</template>
