<script setup lang="ts">
/**
 * S2 `/admin/command-center` "PRESTASIPLUS COMMAND CENTER" and its Admin Sekolah alias
 * `/admin-sekolah/command-center` (M17 FR-M17-20..33, FR-M17-101..112; M17-T3b), v2: the staff theme in its own
 * frame (no shell wraps these `bare` routes). Polls `live-data` every 10 s, four counters, the
 * panels and the footer. The alias (`alias` prop) renders the same board for the school the server derives from
 * the session: no "Top Sekolah", the SERVER-defined school copy and the school's own 7 days under "Engagement".
 * Panels stack in 1 column at 375, 2 at 768 and 3 from 1280 (DV-M17-01).
 */
import { computed } from 'vue'

import { isAlesaAiOn } from '@/app/features'
import { DsEmptyState, DsGrid, DsGridItem, DsPage } from '@/ds'

import AlesaPanel from '../components/command-center-board/AlesaPanel.vue'
import { boardPaths, S2_COPY } from '../components/command-center-board/board-copy'
import BoardHeader from '../components/command-center-board/BoardHeader.vue'
import BoardKpis from '../components/command-center-board/BoardKpis.vue'
import { useLiveBoard } from '../components/command-center-board/composables'
import CorrectionPanel from '../components/command-center-board/CorrectionPanel.vue'
import EngagementPanel from '../components/command-center-board/EngagementPanel.vue'
import FeedPanel from '../components/command-center-board/FeedPanel.vue'
import KirkpatrickPanel from '../components/command-center-board/KirkpatrickPanel.vue'
import MoodPanel from '../components/command-center-board/MoodPanel.vue'
import TodayPanel from '../components/command-center-board/TodayPanel.vue'
import TopPupilsPanel from '../components/command-center-board/TopPupilsPanel.vue'
import TopSchoolsPanel from '../components/command-center-board/TopSchoolsPanel.vue'
import CcBoardFrame from '../components/frame/CcBoardFrame.vue'

const props = withDefaults(defineProps<{ alias?: boolean }>(), { alias: false })

const paths = computed(() => boardPaths(props.alias))
const { data, unavailable } = useLiveBoard()
// ALESA AI is hidden unless VITE_ALESA_AI=on (D73): no panel, and the footer drops "Powered by ALESA AI".
const alesaOn = isAlesaAiOn()
</script>

<template>
  <CcBoardFrame>
    <DsPage :data-testid="alias ? 'cc-s2-alias' : 'cc-s2'">
      <BoardHeader :school="alias" />

      <div class="flex min-w-0 flex-col gap-4" data-testid="cc-body">
        <DsEmptyState
          v-if="unavailable"
          size="sm"
          icon="plugs"
          :title="S2_COPY.unavailable"
          data-testid="cc-unavailable"
        />

        <BoardKpis :data="data" :school="alias" />

        <!-- Row 1: the day at a glance (today, correction, Kirkpatrick; ALESA when on). -->
        <DsGrid min-item="md" gap="md" data-testid="cc-row-1">
          <AlesaPanel v-if="alesaOn" :data="data" />
          <TodayPanel :data="data" />
          <CorrectionPanel :correction="data ? data.correction : null" />
          <KirkpatrickPanel :data="data" />
        </DsGrid>

        <!-- Row 2: who is doing well (top schools, top pupils) and how they feel. -->
        <DsGrid min-item="md" gap="md" data-testid="cc-row-2">
          <TopSchoolsPanel
            v-if="!alias"
            :rows="data ? data.topSchools : null"
            :base-path="paths.basePath"
          />
          <TopPupilsPanel :rows="data ? data.topStudents : null" :base-path="paths.basePath" />
          <MoodPanel :mood="data ? data.mood : null" />
        </DsGrid>

        <!-- Row 3: the live feed beside the engagement chart. -->
        <DsGrid :cols="{ base: 1, xl: 3 }" gap="md" :equal-height="false" data-testid="cc-row-3">
          <DsGridItem :span="{ base: 1, xl: 2 }">
            <FeedPanel :rows="data ? data.recentFeed : null" :base-path="paths.basePath" />
          </DsGridItem>
          <DsGridItem>
            <EngagementPanel :data="data" :school="alias" />
          </DsGridItem>
        </DsGrid>
      </div>

      <p class="text-center text-caption text-muted" data-testid="cc-footer">
        {{ alesaOn ? S2_COPY.footer : S2_COPY.footerPlain }}
      </p>
    </DsPage>
  </CcBoardFrame>
</template>
