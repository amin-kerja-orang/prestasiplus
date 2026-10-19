<script setup lang="ts">
/** "Top Sekolah" (FR-M17-24, FN-M17-3.3.1): up to 5 rows, rank badge, school link to S4, "{n} plj". */
import { formatCount } from '@/lib/number'

import type { CcTopSchool } from '../../api/command-center-board'
import { ccPaths } from '../command-center/cc-paths'
import { shortSchool } from '../command-center/cc-format'
import { rankColor, S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'
import { DsStack, DsText } from '@/ds'

const props = defineProps<{ rows: CcTopSchool[] | null; basePath: string }>()
const paths = ccPaths(props.basePath)
</script>

<template>
  <BoardPanel icon="i-ph-trophy" title="Top Sekolah" testid="cc-panel-top-schools">
    <DsText v-if="rows === null" variant="body" tone="muted">{{ S2_COPY.loading }}</DsText>
    <DsText v-else-if="rows.length === 0" variant="body" tone="muted" data-testid="cc-empty">
      {{ S2_COPY.noData }}
    </DsText>
    <DsStack v-else as="ul" gap="2xs">
      <li
        v-for="(s, i) in rows"
        :key="s.schoolId"
        class="flex min-h-11 items-center gap-3"
        data-testid="cc-top-school"
      >
        <UBadge :color="rankColor(i)" variant="soft" class="shrink-0" data-testid="cc-rank">{{
          i + 1
        }}</UBadge>
        <UButton
          :to="paths.school(s.schoolId)"
          variant="link"
          color="neutral"
          class="h-auto min-w-0 flex-1 justify-start p-0 text-start"
          :label="shortSchool(s.schoolName)"
          :title="s.schoolName"
          data-testid="cc-top-school-link"
        />
        <DsText
          variant="body"
          as="span"
          tone="muted"
          tabular
          class="shrink-0"
          data-testid="cc-top-school-count"
          >{{ formatCount(s.activeCount) }} plj</DsText
        >
      </li>
    </DsStack>
  </BoardPanel>
</template>
