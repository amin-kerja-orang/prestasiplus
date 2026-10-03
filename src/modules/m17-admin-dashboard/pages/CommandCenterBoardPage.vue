<script setup lang="ts">
/**
 * S2 `/admin/command-center` "PRESTASIPLUS COMMAND CENTER" and its Admin Sekolah alias
 * `/admin-sekolah/command-center` (M17 FR-M17-20..33, FR-M17-101..112; M17-T3b): standalone dark board, no shell.
 * Polls `live-data` every 10 s, a 1 s MYT clock, four big counters, the panels and the footer. The alias
 * (`alias` prop) renders the same board for the school the server derives from the session: no "Top Sekolah",
 * the SERVER-defined school copy and the school's own 7 days under "Engagement".
 * Layout: from `xl` the board fills the viewport and panels scroll inside themselves; below it the page scrolls
 * (1 column at 375, 2 at 768; DV-M17-01).
 */
import { computed } from 'vue'

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

const props = withDefaults(defineProps<{ alias?: boolean }>(), { alias: false })

const paths = computed(() => boardPaths(props.alias))
const { data } = useLiveBoard()

const COLUMN = 'flex min-h-0 min-w-0 flex-col gap-3 xl:gap-2'
</script>

<template>
  <div
    class="flex min-h-dvh min-w-0 flex-col bg-slate-900 text-slate-200 xl:h-dvh xl:min-h-[44rem]"
    :data-testid="alias ? 'cc-s2-alias' : 'cc-s2'"
  >
    <BoardHeader :paths="paths" :school="alias" />

    <main
      class="flex min-w-0 flex-1 flex-col gap-3 p-3 sm:p-4 xl:min-h-0 xl:gap-2 xl:overflow-hidden xl:p-3"
      data-testid="cc-body"
    >
      <BoardKpis :data="data" :school="alias" />

      <div
        class="grid min-w-0 gap-3 md:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-[1fr_1fr_0.6fr] xl:grid-rows-[minmax(0,1fr)] xl:gap-2"
        data-testid="cc-panels"
      >
        <div :class="COLUMN" data-testid="cc-col-1">
          <TopSchoolsPanel
            v-if="!alias"
            :rows="data ? data.topSchools : null"
            :base-path="paths.basePath"
          />
          <KirkpatrickPanel :data="data" />
          <AlesaPanel :data="data" />
        </div>
        <div :class="COLUMN" data-testid="cc-col-2">
          <TodayPanel :data="data" />
          <FeedPanel :rows="data ? data.recentFeed : null" :base-path="paths.basePath" />
          <TopPupilsPanel :rows="data ? data.topStudents : null" :base-path="paths.basePath" />
          <MoodPanel v-if="!alias" :mood="data ? data.mood : null" />
        </div>
        <div
          :class="[
            COLUMN,
            'md:col-span-2 md:flex-row xl:col-span-1',
            alias ? 'xl:flex-col' : 'xl:block',
          ]"
          data-testid="cc-col-3"
        >
          <CorrectionPanel :correction="data ? data.correction : null" />
          <MoodPanel v-if="alias" :mood="data ? data.mood : null" />
        </div>
      </div>

      <EngagementPanel :data="data" :school="alias" />
    </main>

    <footer
      class="border-t border-slate-800 px-4 py-2 text-center text-xs text-slate-400 xl:shrink-0"
      data-testid="cc-footer"
    >
      {{ S2_COPY.footer }}
    </footer>
  </div>
</template>
