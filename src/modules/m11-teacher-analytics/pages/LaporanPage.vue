<script setup lang="ts">
/**
 * S1 `/guru/laporan` "Laporan Statistik" (M11-T2; FR-M11-10…25, BR-M11-01…07, DV-M11-01).
 * Query names as on live: `range` (7 | 30 | 90, else 30) and `classroom_id`. One student population for
 * the whole page (the viewer's own classes); four expandable cards sharing one `expanded` state, the
 * trend chart and the two student lists. Changing the class keeps the range; the range pills drop the
 * class (live behaviour).
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsIcon,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsPillNav,
  DsCluster,
  DsGrid,
  DsStack,
  DsText,
} from '@/ds'

import { fetchTeacherReport } from '../api'
import ActivityPanel from '../components/laporan/ActivityPanel.vue'
import {
  type ExpandKey,
  LAPORAN_COPY,
  loginPanelTitle,
  neverLoggedCount,
  practisePanelTitle,
  RANGE_PILLS,
  rangeAgo,
} from '../components/laporan/copy'
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

/** FN-M11-2.1.2: the pills link to `?range=N` only, so they drop `classroom_id` (live behaviour). */
const rangeItems = RANGE_PILLS.map((p) => ({
  key: p.range,
  label: p.label,
  to: { path: '/guru/laporan', query: { range: String(p.range) } },
}))

const d = computed(() => report.data.value)
const n = computed(() => d.value?.population.total ?? 0)
</script>

<template>
  <DsPage data-testid="laporan-page">
    <DsLoadError v-if="report.error.value" @retry="report.reload" />

    <div v-else-if="!d" class="flex justify-center py-12 text-muted" data-testid="laporan-loading">
      <UProgress class="max-w-48" />
    </div>

    <template v-else>
      <!-- FN-M11-2.1.1: the class select submits on change and keeps `range`. -->
      <DsPanel data-testid="filter-card">
        <DsCluster stack-below="sm">
          <p class="flex items-center gap-2 text-label text-highlighted">
            <DsIcon name="funnel" class="size-4" />{{ LAPORAN_COPY.filterLabel }}
          </p>
          <DsNativeSelect
            class="sm:w-64"
            name="classroom_id"
            aria-label="Kelas"
            :model-value="d.classroomId === null ? '' : String(d.classroomId)"
            data-testid="filter-classroom"
            @update:model-value="onClassChange(String($event))"
          >
            <option value="">{{ LAPORAN_COPY.allClasses }}</option>
            <option v-for="c in d.options.classes" :key="c.id" :value="String(c.id)">
              {{ c.name }}
            </option>
          </DsNativeSelect>
          <DsPillNav
            :items="rangeItems"
            :active="range"
            label="Julat"
            testid-prefix="range"
            data-testid="range-pills"
          />
        </DsCluster>
      </DsPanel>

      <DsGrid :cols="{ base: 2, lg: 4 }" data-testid="summary-cards">
        <SummaryCard
          icon="i-ph-sign-in"
          accent="action"
          :value="pctInt(d.population.loggedIn, n)"
          :title="LAPORAN_COPY.loginTitle"
          :hint="LAPORAN_COPY.clickList"
          :open="expanded === 'login'"
          test-id="card-login"
          @toggle="toggle('login')"
        >
          <DsText variant="body">
            <DsText variant="label" tabular>{{ d.population.loggedIn }}</DsText> / {{ n }} pelajar
          </DsText>
          <p
            v-if="n - d.population.loggedIn > 0"
            class="flex items-start gap-1 text-caption text-error"
            data-testid="card-login-missing"
          >
            <UIcon name="i-ph-warning-circle" class="mt-1 size-3 shrink-0" />{{
              neverLoggedCount(n - d.population.loggedIn)
            }}
          </p>
        </SummaryCard>

        <SummaryCard
          icon="i-ph-pencil-simple"
          accent="win"
          :value="pctInt(d.population.practised, n)"
          :title="LAPORAN_COPY.practiseTitle"
          :hint="LAPORAN_COPY.clickList"
          :open="expanded === 'latihan'"
          test-id="card-latihan"
          @toggle="toggle('latihan')"
        >
          <DsText variant="body">
            <DsText variant="label" tabular>{{ d.population.practised }}</DsText> / {{ n }} pelajar
          </DsText>
        </SummaryCard>

        <SummaryCard
          icon="i-ph-chart-bar"
          accent="heat"
          :value="grouped(d.activity.total)"
          :title="LAPORAN_COPY.activityTitle"
          :hint="LAPORAN_COPY.clickBreakdown"
          :open="expanded === 'aktiviti'"
          test-id="card-aktiviti"
          @toggle="toggle('aktiviti')"
        >
          <DsText variant="body" data-testid="card-range">
            {{ rangeAgo(d.range) }}
          </DsText>
        </SummaryCard>

        <SummaryCard
          icon="i-ph-star"
          accent="trial"
          :value="d.score.overall === null ? LAPORAN_COPY.noScore : `${d.score.overall}%`"
          :title="LAPORAN_COPY.scoreTitle"
          :hint="LAPORAN_COPY.clickBreakdown"
          :open="expanded === 'skor'"
          test-id="card-skor"
          @toggle="toggle('skor')"
        />
      </DsGrid>

      <UCard v-if="expanded === 'login'" data-testid="panel-login">
        <DsStack gap="sm">
          <h2 class="flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-user-minus" class="size-4 text-primary-t" />{{
              loginPanelTitle(d.notLoggedIn.length)
            }}
          </h2>
          <p
            v-if="d.notLoggedIn.length === 0"
            class="flex items-center gap-2 text-label text-success"
          >
            <UIcon name="i-ph-check-circle" class="size-4" />{{ LAPORAN_COPY.allLoggedIn }}
          </p>
          <StudentRows v-else :rows="d.notLoggedIn" test-id="panel-login-list" />
        </DsStack>
      </UCard>

      <UCard v-if="expanded === 'latihan'" data-testid="panel-latihan">
        <DsStack gap="sm">
          <h2 class="flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-moon" class="size-4 text-primary-t" />{{
              practisePanelTitle(d.notPractisedAll.length)
            }}
          </h2>
          <p
            v-if="d.notPractisedAll.length === 0"
            class="flex items-center gap-2 text-label text-success"
          >
            <UIcon name="i-ph-check-circle" class="size-4" />{{ LAPORAN_COPY.allPractised }}
          </p>
          <StudentRows v-else :rows="d.notPractisedAll" test-id="panel-latihan-list" />
        </DsStack>
      </UCard>

      <ActivityPanel v-if="expanded === 'aktiviti'" :activity="d.activity" :range="d.range" />
      <ScorePanel v-if="expanded === 'skor'" :score="d.score" />

      <TrendCard :trend="d.trend" :range="d.range" />

      <DsGrid :cols="{ md: 2 }">
        <UCard class="min-w-0" data-testid="list-active">
          <DsStack gap="sm">
            <h2 class="flex items-center gap-2 text-label text-highlighted">
              <UIcon name="i-ph-trophy" class="size-4 text-primary-t" />{{
                LAPORAN_COPY.mostActiveTitle
              }}
            </h2>
            <p
              v-if="d.mostActive.length === 0"
              class="py-6 text-center text-body text-muted"
              data-testid="list-active-empty"
            >
              {{ LAPORAN_COPY.noActivity }}
            </p>
            <StudentRows v-else :rows="d.mostActive" test-id="list-active-rows" />
          </DsStack>
        </UCard>

        <UCard class="min-w-0" data-testid="list-idle">
          <DsStack gap="sm">
            <h2 class="flex items-center gap-2 text-label text-highlighted">
              <UIcon name="i-ph-moon" class="size-4 text-muted" />{{
                LAPORAN_COPY.notPractisedTitle
              }}
            </h2>
            <p
              v-if="d.notPractised.length === 0"
              class="py-6 text-center text-body text-muted"
              data-testid="list-idle-empty"
            >
              {{ LAPORAN_COPY.allPractised }}
            </p>
            <StudentRows v-else :rows="d.notPractised" test-id="list-idle-rows" />
          </DsStack>
        </UCard>
      </DsGrid>
    </template>
  </DsPage>
</template>
