<script setup lang="ts">
/** "Kelas Saya" (FN-M10-2.2.4): a row per class; a click opens the mounted M17 class page in a new tab. */
import type { CcClassRow } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { useOpenTab } from './composables'
import { classPath, S2_COPY } from './copy'

defineProps<{ classes: CcClassRow[] }>()
const openTab = useOpenTab()
</script>

<template>
  <BoardPanel icon="chalkboard-teacher" accent="action" title="Kelas Saya" testid="cc-panel-classes">
    <p v-if="classes.length === 0" class="text-body text-muted" data-testid="cc-classes-empty">
      {{ S2_COPY.noData }}
    </p>
    <ul v-else class="flex flex-col gap-2">
      <li v-for="c in classes" :key="c.id" class="min-w-0">
        <UButton
          color="neutral"
          variant="soft"
          block
          trailing-icon="i-ph-caret-right"
          class="h-auto min-w-0 justify-between gap-3 py-2 text-start"
          :title="S2_COPY.classHint"
          data-testid="cc-class-row"
          @click="openTab(classPath(c.id))"
        >
          <span class="flex min-w-0 flex-1 flex-col">
            <span
              class="min-w-0 text-label break-words text-highlighted"
              data-testid="cc-class-name"
              >{{ c.name }}</span
            >
            <span class="text-caption text-muted" data-testid="cc-class-level">{{
              c.educationLevel
            }}</span>
            <span class="tabular text-caption text-toned" data-testid="cc-class-stats"
              >{{ c.studentCount }} plj | {{ c.active }} aktif | {{ c.accuracy }}%</span
            >
          </span>
        </UButton>
      </li>
    </ul>
  </BoardPanel>
</template>
