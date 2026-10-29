<script setup lang="ts">
/**
 * S2 `/admin/command-center` "PRESTASIPLUS COMMAND CENTER" and its Admin Sekolah alias
 * `/admin-sekolah/command-center` (M17 FR-M17-20..33, FR-M17-101..112; M17-T3b), v2: the staff theme in its own
 * frame (no shell wraps these `bare` routes). Polls `live-data` every 10 s, a 1 s MYT clock, four counters, the
 * panels and the footer. The alias (`alias` prop) renders the same board for the school the server derives from
 * the session: no "Top Sekolah", the SERVER-defined school copy and the school's own 7 days under "Engagement".
 * Panels stack in 1 column at 375, 2 at 768 and 3 from 1280 (DV-M17-01). The columns stretch to the grid and
 * the last panel of each grows (`grow`), so no column ends in a hole (FR-M17-107, DV-M17-54).
 */
import { computed } from 'vue'

import { DsEmptyState, DsPage } from '@/ds'

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
</script>

<template>
  <CcBoardFrame>
    <DsPage :data-testid="alias ? 'cc-s2-alias' : 'cc-s2'">
      <BoardHeader :paths="paths" :school="alias" />

      <div class="flex min-w-0 flex-col gap-4" data-testid="cc-body">
        <DsEmptyState
          v-if="unavailable"
          size="sm"
          icon="plugs"
          :title="S2_COPY.unavailable"
          data-testid="cc-unavailable"
        />

        <BoardKpis :data="data" :school="alias" />

        <div class="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="cc-panels">
          <div class="flex min-w-0 flex-col gap-4" data-testid="cc-col-1">
            <TopSchoolsPanel
              v-if="!alias"
              :rows="data ? data.topSchools : null"
              :base-path="paths.basePath"
            />
            <KirkpatrickPanel :data="data" />
            <AlesaPanel :data="data" class="grow" />
          </div>
          <div class="flex min-w-0 flex-col gap-4" data-testid="cc-col-2">
            <TodayPanel :data="data" />
            <FeedPanel :rows="data ? data.recentFeed : null" :base-path="paths.basePath" />
            <TopPupilsPanel
              :rows="data ? data.topStudents : null"
              :base-path="paths.basePath"
              :class="{ grow: alias }"
            />
            <MoodPanel v-if="!alias" :mood="data ? data.mood : null" class="grow" />
          </div>
          <div
            class="flex min-w-0 flex-col gap-4 md:col-span-2 xl:col-span-1"
            data-testid="cc-col-3"
          >
            <CorrectionPanel
              :correction="data ? data.correction : null"
              :class="{ grow: !alias }"
            />
            <MoodPanel v-if="alias" :mood="data ? data.mood : null" class="grow" />
          </div>
        </div>

        <EngagementPanel :data="data" :school="alias" />
      </div>

      <p class="text-center text-caption text-muted" data-testid="cc-footer">
        {{ S2_COPY.footer }}
      </p>
    </DsPage>
  </CcBoardFrame>
</template>
