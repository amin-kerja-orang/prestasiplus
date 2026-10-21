<script setup lang="ts">
/**
 * S2 `/admin/command-center` "PRESTASIPLUS COMMAND CENTER" and its Admin Sekolah alias
 * `/admin-sekolah/command-center` (M17 FR-M17-20..33, FR-M17-101..112; M17-T3b), v2: the staff theme in its own
 * frame (no shell wraps these `bare` routes). Polls `live-data` every 10 s, a 1 s MYT clock, four counters, the
 * panels and the footer. The alias (`alias` prop) renders the same board for the school the server derives from
 * the session: no "Top Sekolah", the SERVER-defined school copy and the school's own 7 days under "Engagement".
 * Panels stack in 1 column at 375, 2 at 768 and a 12-column grid from 1280 (DV-M17-01).
 */
import { computed } from 'vue'

import { DsPage } from '@/ds'

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
const { data } = useLiveBoard()
</script>

<template>
  <CcBoardFrame>
    <DsPage :data-testid="alias ? 'cc-s2-alias' : 'cc-s2'">
      <BoardHeader :paths="paths" :school="alias" />

      <div class="flex min-w-0 flex-col gap-4" data-testid="cc-body">
        <BoardKpis :data="data" :school="alias" />

        <!--
          One grid, explicit spans, DOM order = the mobile order (live first, then rankings, quality, insight).
          Panels in a row stretch to equal height. md: 2 columns; xl: 12 columns - the tall Live Feed (8) beside
          Today + Pembetulan + Mood (4), then rankings (6+6), then Kirkpatrick + ALESA (6+6).
        -->
        <div
          class="grid min-w-0 grid-flow-dense gap-4 md:grid-cols-2 xl:grid-cols-12"
          data-testid="cc-panels"
        >
          <FeedPanel
            :rows="data ? data.recentFeed : null"
            :base-path="paths.basePath"
            class="md:col-span-2 xl:col-span-8 xl:col-start-1 xl:row-span-3 xl:row-start-1"
          />
          <TodayPanel :data="data" class="xl:col-span-4 xl:col-start-9 xl:row-start-1" />
          <CorrectionPanel
            :correction="data ? data.correction : null"
            class="xl:col-span-4 xl:col-start-9 xl:row-start-2"
          />
          <MoodPanel
            :mood="data ? data.mood : null"
            class="xl:col-span-4 xl:col-start-9 xl:row-start-3"
            :class="alias ? 'md:col-span-2' : ''"
          />
          <TopSchoolsPanel
            v-if="!alias"
            :rows="data ? data.topSchools : null"
            :base-path="paths.basePath"
            class="xl:col-span-6"
          />
          <TopPupilsPanel
            :rows="data ? data.topStudents : null"
            :base-path="paths.basePath"
            :class="alias ? 'md:col-span-2 xl:col-span-12' : 'xl:col-span-6'"
          />
          <KirkpatrickPanel :data="data" class="xl:col-span-7" />
          <!-- md: the odd panel out spans both columns so no half-row is left empty. -->
          <AlesaPanel :data="data" class="xl:col-span-5" :class="alias ? '' : 'md:col-span-2'" />
        </div>

        <EngagementPanel :data="data" :school="alias" />
      </div>

      <p class="text-center text-caption text-muted" data-testid="cc-footer">
        {{ S2_COPY.footer }}
      </p>
    </DsPage>
  </CcBoardFrame>
</template>
