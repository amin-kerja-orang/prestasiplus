<script setup lang="ts">
/**
 * S3 `/admin/command-center/daily-activity` "AKTIVITI PLATFORM — PRESTASIPLUS" and its Admin Sekolah alias
 * `/admin-sekolah/command-center/daily-activity` "AKTIVITI SEKOLAH — PRESTASIPLUS" (M17 FR-M17-34..47,
 * FR-M17-116; M17-T3b), v2: the staff theme in its own frame, with the period tabs, six pulse cards and the
 * panels. The page always starts on "Hari Ini" (the `?period=` query is ignored), reloads the period every
 * 30 s and keeps an open school drill. The alias hides "Sekolah" and its drill (admin only, #5).
 */
import { computed } from 'vue'

import { DsGrid, DsPage, DsStack } from '@/ds'

import type { CcPeriod } from '../api/command-center-board'
import { boardPaths, S3_TABS } from '../components/command-center-board/board-copy'
import { useDailyBoard, useSchoolDrill } from '../components/command-center-board/composables'
import DailyFeedPanel from '../components/command-center-board/DailyFeedPanel.vue'
import DailyHeader from '../components/command-center-board/DailyHeader.vue'
import DailyHeatmapPanel from '../components/command-center-board/DailyHeatmapPanel.vue'
import DailyLoginsPanel from '../components/command-center-board/DailyLoginsPanel.vue'
import DailyMoodBadgePanels from '../components/command-center-board/DailyMoodBadgePanels.vue'
import DailySchoolsPanel from '../components/command-center-board/DailySchoolsPanel.vue'
import DailySubjectsPanel from '../components/command-center-board/DailySubjectsPanel.vue'
import DailyTopPanel from '../components/command-center-board/DailyTopPanel.vue'
import PulseCards from '../components/command-center-board/PulseCards.vue'
import CcBoardFrame from '../components/frame/CcBoardFrame.vue'

const props = withDefaults(defineProps<{ alias?: boolean }>(), { alias: false })

const paths = computed(() => boardPaths(props.alias))
const { period, data, status, setPeriod } = useDailyBoard()
const drill = useSchoolDrill(period)

function pick(next: CcPeriod): void {
  drill.close()
  setPeriod(next)
}
</script>

<template>
  <CcBoardFrame>
    <DsPage :data-testid="alias ? 'cc-s3-alias' : 'cc-s3'">
      <DailyHeader :paths="paths" :school="alias" />

      <div class="flex min-w-0 flex-col gap-4" data-testid="cc-s3-body">
        <div
          class="flex max-w-full flex-wrap gap-2"
          role="group"
          aria-label="Tempoh"
          data-testid="cc-tabs"
        >
          <UButton
            v-for="t in S3_TABS"
            :key="t.period"
            :color="period === t.period ? 'primary' : 'neutral'"
            :variant="period === t.period ? 'solid' : 'soft'"
            :icon="t.icon"
            :label="t.label"
            :aria-pressed="period === t.period"
            :data-period="t.period"
            :data-active="period === t.period"
            data-testid="cc-tab"
            @click="pick(t.period)"
          />
        </div>

        <PulseCards :data="data" :period="period" />

        <!-- Row 1: where the activity is. The school list shares its column with the top pupils. -->
        <DsGrid min-item="md" gap="md" data-testid="cc-row-1">
          <DsStack gap="md">
            <DailySchoolsPanel
              v-if="!alias"
              :data="data"
              :status="status"
              :drill="drill.state.value"
              :base-path="paths.basePath"
              :stretch="false"
              @toggle="drill.toggle"
            />
            <DailyTopPanel
              :data="data"
              :status="status"
              :base-path="paths.basePath"
              :stretch="false"
            />
          </DsStack>
          <DailySubjectsPanel :data="data" :status="status" :stretch="false" />
          <DailyHeatmapPanel v-if="period === 'today'" :data="data" :status="status" />
        </DsGrid>

        <!-- Row 2: who is active (feed, logins) and how they feel (mood, badges). -->
        <DsGrid min-item="md" gap="md" data-testid="cc-row-2">
          <DailyFeedPanel :data="data" :status="status" :base-path="paths.basePath" />
          <DailyLoginsPanel :data="data" :status="status" :base-path="paths.basePath" />
          <DsStack gap="md">
            <DailyMoodBadgePanels :data="data" :status="status" only="mood" />
            <DailyMoodBadgePanels :data="data" :status="status" only="badge" />
          </DsStack>
        </DsGrid>
      </div>
    </DsPage>
  </CcBoardFrame>
</template>
