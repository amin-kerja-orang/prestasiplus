<script setup lang="ts">
/**
 * S2 `/guru/command-center` "Command Center" (FR-M10-14..25, FN-M10-2.2.1-2.2.14): standalone dark layout, no
 * shell. Polls `live-data` every 10 s, a 1 s clock, four KPI tiles, the panels, the drill modal and the five
 * modals of the top bar. DV-M10-17: KPI and panel grids 4 / 2 / 1 columns at >= 1024 / 640 / below with no
 * panel clipped; DV-M10-28: no text under 12 px.
 */
import { computed, ref, watch } from 'vue'

import { usePageMeta } from '@/composables'

import AchievementsModal from '../components/command-center/AchievementsModal.vue'
import ActivityPanel from '../components/command-center/ActivityPanel.vue'
import ClassPanel from '../components/command-center/ClassPanel.vue'
import ClassSummaryModal from '../components/command-center/ClassSummaryModal.vue'
import { useCountUp, useLiveData } from '../components/command-center/composables'
import {
  type DrillRequest,
  EMPTY_LIVE,
  gpsText,
  type NavAction,
  S2_COPY,
  TAB_TITLE,
} from '../components/command-center/copy'
import DrillModal from '../components/command-center/DrillModal.vue'
import EngagementPanel from '../components/command-center/EngagementPanel.vue'
import EvaluateModal from '../components/command-center/EvaluateModal.vue'
import FeedPanel from '../components/command-center/FeedPanel.vue'
import InsightPanel from '../components/command-center/InsightPanel.vue'
import KirkPanel from '../components/command-center/KirkPanel.vue'
import KpiTile from '../components/command-center/KpiTile.vue'
import LeaderboardPanel from '../components/command-center/LeaderboardPanel.vue'
import MoodPanel from '../components/command-center/MoodPanel.vue'
import PredictiveModal from '../components/command-center/PredictiveModal.vue'
import RemedialModal from '../components/command-center/RemedialModal.vue'
import TopBar from '../components/command-center/TopBar.vue'

const { data } = useLiveData()
const d = computed(() => data.value ?? EMPTY_LIVE)

const pageMeta = usePageMeta()
watch(
  () => data.value?.teacherName,
  (name) => {
    if (name) pageMeta.setTitle(TAB_TITLE(name))
  },
  { immediate: true },
)

const students = useCountUp(
  computed(() => d.value.totalStudentsRaw),
  computed(() => d.value.totalStudents),
)
const answered = useCountUp(
  computed(() => d.value.totalAnsweredRaw),
  computed(() => d.value.totalAnswered),
)

const modal = ref<NavAction | null>(null)
const drill = ref<DrillRequest | null>(null)
const drillKey = ref(0)
function openDrill(req: DrillRequest) {
  drill.value = req
  drillKey.value += 1
}
</script>

<template>
  <div class="min-h-dvh min-w-0 bg-slate-900 text-slate-200" data-testid="cc-s2">
    <TopBar @open="modal = $event" />

    <div class="min-w-0 space-y-3 p-3 sm:p-4" data-testid="cc-body">
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="cc-kpis">
        <KpiTile
          label="Pelajar Berdaftar"
          :value="students"
          :sub="`${d.activeStudents} aktif menjawab`"
          accent="indigo"
          testid="cc-kpi-students"
          @click="openDrill({ type: 'students', label: 'Pelajar Berdaftar' })"
        />
        <KpiTile
          label="Soalan Dijawab"
          :value="answered"
          sub="sepanjang masa"
          accent="emerald"
          testid="cc-kpi-answered"
          @click="openDrill({ type: 'today', label: 'Soalan Dijawab' })"
        />
        <KpiTile
          label="Ketepatan Purata"
          :value="`${String(d.accuracy)}%`"
          sub="keseluruhan sekolah"
          accent="amber"
          testid="cc-kpi-accuracy"
          @click="openDrill({ type: 'subjects', label: 'Ketepatan Purata' })"
        />
        <KpiTile
          label="GPS Sekolah"
          :value="gpsText(d.gpsOverall)"
          sub="purata GPS"
          accent="rose"
          testid="cc-kpi-gps"
          @click="openDrill({ type: 'gps', label: 'GPS Sekolah' })"
        />
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="cc-panels">
        <div class="contents lg:col-span-1 lg:flex lg:flex-col lg:gap-3">
          <ClassPanel :classes="d.classes" />
          <KirkPanel :d="d" @drill="openDrill" />
          <MoodPanel :mood="d.mood" @drill="openDrill" />
          <InsightPanel :d="d" />
        </div>
        <div class="contents lg:col-span-2 lg:flex lg:flex-col lg:gap-3">
          <ActivityPanel :d="d" @drill="openDrill" />
          <FeedPanel :feed="d.recentFeed" />
          <LeaderboardPanel :rows="d.leaderboardWeek" :badges="d.recentBadges" />
        </div>
        <div class="contents lg:col-span-1 lg:flex lg:flex-col lg:gap-3">
          <EngagementPanel :engagement="d.engagement" @drill="openDrill" />
        </div>
      </div>
    </div>

    <footer
      class="border-t border-slate-800 px-4 py-3 text-center text-xs text-slate-400"
      data-testid="cc-footer"
    >
      {{ S2_COPY.footer }}
    </footer>

    <DrillModal
      v-if="drill"
      :key="drillKey"
      :type="drill.type"
      :filter="drill.filter"
      :label="drill.label"
      @close="drill = null"
    />
    <RemedialModal v-if="modal === 'remedial'" @close="modal = null" />
    <EvaluateModal v-else-if="modal === 'evaluate'" @close="modal = null" />
    <PredictiveModal v-else-if="modal === 'predictive'" @close="modal = null" />
    <ClassSummaryModal v-else-if="modal === 'kelas'" @close="modal = null" />
    <AchievementsModal v-else-if="modal === 'badges'" @close="modal = null" />
  </div>
</template>
