<script setup lang="ts">
/**
 * One set of S34 (PROPOSED row, FN-M10-5.7.2): title, teacher, "{n} soalan" and "Mula" to the M05 quiz.
 * R1 sets have no timer and no attempt cap, so neither is shown (R1-MUR-26).
 */
import { DsIconChip, DsPanel } from '@/ds'

import type { StudentQuestionSet } from '../../api/types'
import { SET_COPY } from './copy'
import { questionCountLabel, quizPath } from './format'

defineProps<{ item: StudentQuestionSet }>()
</script>

<template>
  <li class="min-w-0" data-testid="set-row">
    <DsPanel>
      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="flex min-w-0 items-start gap-3">
          <DsIconChip icon="clipboard-text" accent="action" size="lg" />
          <div class="flex min-w-0 flex-col gap-2">
            <h3 class="text-subheading break-words text-highlighted" data-testid="set-title">
              {{ item.title }}
            </h3>
            <ul class="flex flex-wrap gap-x-4 gap-y-1 text-label text-muted">
              <li
                v-if="item.teacherName"
                class="inline-flex items-center gap-2"
                data-testid="set-teacher"
              >
                <UIcon name="i-ph-user-duotone" class="size-4 shrink-0" aria-hidden="true" />
                {{ item.teacherName }}
              </li>
              <li class="inline-flex items-center gap-2" data-testid="set-count">
                <UIcon
                  name="i-ph-list-numbers-duotone"
                  class="size-4 shrink-0"
                  aria-hidden="true"
                />
                {{ questionCountLabel(item.questionCount) }}
              </li>
            </ul>
          </div>
        </div>
        <UButton
          :to="quizPath(item.id)"
          size="xl"
          icon="i-ph-play-duotone"
          class="min-h-12 justify-center"
          data-testid="set-start"
          >{{ SET_COPY.start }}</UButton
        >
      </div>
    </DsPanel>
  </li>
</template>
