<script setup lang="ts">
/**
 * S1 `/guru/laporan` "Laporan Statistik" (M11-T2; FR-M11-10…25, BR-M11-01…07, DV-M11-01).
 * Query names as on live: `range` (7 | 30 | 90, else 30) and `classroom_id`. One student population for
 * the whole page (the viewer's own classes); four expandable cards sharing one `expanded` state, the
 * trend chart and the two student lists. Changing the class keeps the range; the range pills drop the
 * class (live behaviour).
 */
import {
  ChartBar,
  CircleAlert,
  CircleCheck,
  LogIn,
  Moon,
  Pencil,
  Star,
  Trophy,
  UserX,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchTeacherReport } from '../api'
import ActivityPanel from '../components/laporan/ActivityPanel.vue'
import {
  type ExpandKey,
  LAPORAN_COPY,
  loginPanelTitle,
  neverLoggedCount,
  practisePanelTitle,
  rangeAgo,
} from '../components/laporan/copy'
import FilterCard from '../components/laporan/FilterCard.vue'
import { grouped, parseId, parseRange, pctInt } from '../components/laporan/format'
import ScorePanel from '../components/laporan/ScorePanel.vue'
import StudentRows from '../components/laporan/StudentRows.vue'
import SummaryCard from '../components/laporan/SummaryCard.vue'
import TrendCard from '../components/laporan/TrendCard.vue'

const route = useRoute()
const router = useRouter()

const range = computed(() => parseRange(route.query.range))
const classroomId = computed(() => parseId(route.query.classroom_id))

const report = useApi(
  (signal) =>
    fetchTeacherReport(
      {
        range: range.value,
        ...(classroomId.value !== undefined ? { classroomId: classroomId.value } : {}),
      },
      { signal },
    ),
  [range, classroomId],
)

/** FR-M11-17: one shared state; a reload (query change) closes every panel, as a page load does. */
const expanded = ref<ExpandKey | null>(null)
const toggle = (key: ExpandKey): void => {
  expanded.value = expanded.value === key ? null : key
}
watch([range, classroomId], () => {
  expanded.value = null
})

function onClassChange(value: string): void {
  void router.push({
    path: '/guru/laporan',
    query: { range: String(range.value), classroom_id: value },
  })
}

const d = computed(() => report.data.value)
const n = computed(() => d.value?.population.total ?? 0)
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="laporan-page">
    <AlertBox v-if="report.error.value" :messages="LAPORAN_COPY.loadFailed" />

    <div
      v-else-if="!d"
      class="flex justify-center py-10 text-slate-400"
      data-testid="laporan-loading"
    >
      <LoadingSpinner :size="28" />
    </div>

    <template v-else>
      <FilterCard
        :range="range"
        :classes="d.options.classes"
        :classroom-id="d.classroomId"
        @update:classroom="onClassChange"
      />

      <div class="grid grid-cols-2 gap-4 lg:grid-cols-5" data-testid="summary-cards">
        <SummaryCard
          tone="blue"
          :icon="LogIn"
          :value="pctInt(d.population.loggedIn, n)"
          :title="LAPORAN_COPY.loginTitle"
          :hint="LAPORAN_COPY.clickList"
          :open="expanded === 'login'"
          test-id="card-login"
          @toggle="toggle('login')"
        >
          <p class="mt-0.5 text-sm text-blue-600">
            <span class="font-bold">{{ d.population.loggedIn }}</span> / {{ n }} pelajar
          </p>
          <p
            v-if="n - d.population.loggedIn > 0"
            class="mt-0.5 flex items-start gap-1 text-xs text-red-500"
            data-testid="card-login-missing"
          >
            <CircleAlert class="mt-0.5 h-3 w-3 shrink-0" />{{
              neverLoggedCount(n - d.population.loggedIn)
            }}
          </p>
        </SummaryCard>

        <SummaryCard
          tone="emerald"
          :icon="Pencil"
          :value="pctInt(d.population.practised, n)"
          :title="LAPORAN_COPY.practiseTitle"
          :hint="LAPORAN_COPY.clickList"
          :open="expanded === 'latihan'"
          test-id="card-latihan"
          @toggle="toggle('latihan')"
        >
          <p class="mt-0.5 text-sm text-emerald-700">
            <span class="font-bold">{{ d.population.practised }}</span> / {{ n }} pelajar
          </p>
        </SummaryCard>

        <SummaryCard
          tone="purple"
          :icon="ChartBar"
          :value="grouped(d.activity.total)"
          :title="LAPORAN_COPY.activityTitle"
          :hint="LAPORAN_COPY.clickBreakdown"
          :open="expanded === 'aktiviti'"
          test-id="card-aktiviti"
          @toggle="toggle('aktiviti')"
        >
          <p class="mt-0.5 text-sm text-purple-600" data-testid="card-range">
            {{ rangeAgo(d.range) }}
          </p>
        </SummaryCard>

        <SummaryCard
          tone="amber"
          :icon="Star"
          :value="d.score.overall === null ? LAPORAN_COPY.noScore : `${d.score.overall}%`"
          :title="LAPORAN_COPY.scoreTitle"
          :hint="LAPORAN_COPY.clickBreakdown"
          :open="expanded === 'skor'"
          test-id="card-skor"
          @toggle="toggle('skor')"
        />
      </div>

      <section
        v-if="expanded === 'login'"
        class="rounded-2xl bg-white p-5 shadow"
        data-testid="panel-login"
      >
        <h4 class="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
          <UserX class="h-4 w-4 text-blue-500" />{{ loginPanelTitle(d.notLoggedIn.length) }}
        </h4>
        <p
          v-if="d.notLoggedIn.length === 0"
          class="flex items-center gap-2 text-sm font-semibold text-emerald-600"
        >
          <CircleCheck class="h-4 w-4" />{{ LAPORAN_COPY.allLoggedIn }}
        </p>
        <StudentRows v-else :rows="d.notLoggedIn" test-id="panel-login-list" />
      </section>

      <section
        v-if="expanded === 'latihan'"
        class="rounded-2xl bg-white p-5 shadow"
        data-testid="panel-latihan"
      >
        <h4 class="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
          <Moon class="h-4 w-4 text-emerald-500" />{{
            practisePanelTitle(d.notPractisedAll.length)
          }}
        </h4>
        <p
          v-if="d.notPractisedAll.length === 0"
          class="flex items-center gap-2 text-sm font-semibold text-emerald-600"
        >
          <CircleCheck class="h-4 w-4" />{{ LAPORAN_COPY.allPractised }}
        </p>
        <StudentRows v-else :rows="d.notPractisedAll" test-id="panel-latihan-list" />
      </section>

      <ActivityPanel v-if="expanded === 'aktiviti'" :activity="d.activity" :range="d.range" />
      <ScorePanel v-if="expanded === 'skor'" :score="d.score" />

      <TrendCard :trend="d.trend" :range="d.range" />

      <div class="grid gap-5 md:grid-cols-2">
        <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="list-active">
          <h3 class="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
            <Trophy class="h-4 w-4 text-amber-500" />{{ LAPORAN_COPY.mostActiveTitle }}
          </h3>
          <p
            v-if="d.mostActive.length === 0"
            class="py-6 text-center text-sm text-slate-400"
            data-testid="list-active-empty"
          >
            {{ LAPORAN_COPY.noActivity }}
          </p>
          <StudentRows v-else :rows="d.mostActive" test-id="list-active-rows" />
        </section>

        <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="list-idle">
          <h3 class="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
            <Moon class="h-4 w-4 text-slate-400" />{{ LAPORAN_COPY.notPractisedTitle }}
          </h3>
          <p
            v-if="d.notPractised.length === 0"
            class="py-6 text-center text-sm text-slate-400"
            data-testid="list-idle-empty"
          >
            {{ LAPORAN_COPY.allPractised }}
          </p>
          <StudentRows v-else :rows="d.notPractised" test-id="list-idle-rows" />
        </section>
      </div>
    </template>
  </div>
</template>
