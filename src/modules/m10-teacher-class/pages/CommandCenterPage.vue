<script setup lang="ts">
/**
 * S2 `/guru/command-center` "Command Center" (FR-M10-14..25, FN-M10-2.2.1-2.2.14), v2: inside the staff shell
 * (the v1 standalone dark layout is gone). Polls `live-data` every 10 s (the "Jeda" control pauses it), a 1 s
 * clock, four KPI tiles, the panels, the drill dialog and the five dialogs of the top bar. KPI and panel grids
 * 2 / 2 / 4 columns at 375 / 768 / 1280 with no panel clipped.
 */
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { usePageMeta } from '@/composables'
import { DsPage, DsStack, DsGrid, DsText } from '@/ds'

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

const { data, paused, togglePause } = useLiveData()
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

// Full screen: the browser Fullscreen API when it exists; `aria-pressed` follows the real state.
const fullscreen = ref(false)
function syncFullscreen() {
  fullscreen.value = document.fullscreenElement !== null
}
function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen?.()
}
document.addEventListener('fullscreenchange', syncFullscreen)
onBeforeUnmount(() => {
  document.removeEventListener('fullscreenchange', syncFullscreen)
})
</script>

<template>
  <DsPage data-testid="cc-s2">
    <TopBar
      :paused="paused"
      :fullscreen="fullscreen"
      @open="modal = $event"
      @pause="togglePause"
      @fullscreen="toggleFullscreen"
    />

    <DsStack data-testid="cc-body">
      <DsGrid :cols="{ base: 2, lg: 4 }" gap="sm" data-testid="cc-kpis" aria-live="off">
        <KpiTile
          label="Pelajar Berdaftar"
          :value="students"
          :sub="`${d.activeStudents} aktif menjawab`"
          icon="student"
          accent="action"
          testid="cc-kpi-students"
          @click="openDrill({ type: 'students', label: 'Pelajar Berdaftar' })"
        />
        <KpiTile
          label="Soalan Dijawab"
          :value="answered"
          sub="sepanjang masa"
          icon="clipboard-text"
          accent="win"
          testid="cc-kpi-answered"
          @click="openDrill({ type: 'today', label: 'Soalan Dijawab' })"
        />
        <KpiTile
          label="Ketepatan Purata"
          :value="`${String(d.accuracy)}%`"
          sub="keseluruhan sekolah"
          icon="target"
          accent="heat"
          testid="cc-kpi-accuracy"
          @click="openDrill({ type: 'subjects', label: 'Ketepatan Purata' })"
        />
        <KpiTile
          label="GPS Sekolah"
          :value="gpsText(d.gpsOverall)"
          sub="purata GPS"
          icon="chart-bar"
          accent="trial"
          testid="cc-kpi-gps"
          @click="openDrill({ type: 'gps', label: 'GPS Sekolah' })"
        />
      </DsGrid>

      <DsGrid :cols="{ base: 1, md: 2, xl: 4 }" data-testid="cc-panels">
        <div class="flex min-w-0 flex-col gap-4 xl:col-span-1">
          <ClassPanel :classes="d.classes" />
          <KirkPanel :d="d" @drill="openDrill" />
          <MoodPanel :mood="d.mood" @drill="openDrill" />
          <InsightPanel :d="d" />
        </div>
        <div class="flex min-w-0 flex-col gap-4 xl:col-span-2">
          <ActivityPanel :d="d" @drill="openDrill" />
          <FeedPanel :feed="d.recentFeed" />
          <LeaderboardPanel :rows="d.leaderboardWeek" :badges="d.recentBadges" />
        </div>
        <div class="flex min-w-0 flex-col gap-4 md:col-span-2 xl:col-span-1">
          <EngagementPanel :engagement="d.engagement" @drill="openDrill" />
        </div>
      </DsGrid>
    </DsStack>

    <DsText variant="caption" align="center" data-testid="cc-footer">
      {{ S2_COPY.footer }}
    </DsText>

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
  </DsPage>
</template>
