<script setup lang="ts">
/** "📚 Kelas Saya" (FN-M10-2.2.4): a row per class; a click opens the mounted M17 class page in a new tab. */
import type { CcClassRow } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { useOpenTab } from './composables'
import { classPath, S2_COPY } from './copy'

defineProps<{ classes: CcClassRow[] }>()
const openTab = useOpenTab()
</script>

<template>
  <BoardPanel icon="📚" title="Kelas Saya" testid="cc-panel-classes">
    <p v-if="classes.length === 0" class="text-sm text-slate-400" data-testid="cc-classes-empty">
      {{ S2_COPY.noData }}
    </p>
    <ul v-else class="space-y-2">
      <li
        v-for="c in classes"
        :key="c.id"
        class="min-w-0 cursor-pointer rounded-xl border border-slate-700 bg-slate-900/50 px-3 py-2 hover:bg-slate-700/50"
        :title="S2_COPY.classHint"
        data-testid="cc-class-row"
        @click="openTab(classPath(c.id))"
      >
        <div class="font-semibold break-words text-slate-50" data-testid="cc-class-name">
          {{ c.name }}
        </div>
        <div class="text-xs text-slate-400" data-testid="cc-class-level">
          {{ c.educationLevel }}
        </div>
        <div class="text-sm text-slate-300" data-testid="cc-class-stats">
          {{ c.studentCount }} plj | {{ c.active }} aktif | {{ c.accuracy }}%
        </div>
      </li>
    </ul>
  </BoardPanel>
</template>
