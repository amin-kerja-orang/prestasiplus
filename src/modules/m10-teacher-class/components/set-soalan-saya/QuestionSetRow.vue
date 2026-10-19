<script setup lang="ts">
/**
 * One set of S34 (PROPOSED row, FN-M10-5.7.2): title, teacher, "{n} soalan", optional time limit and
 * attempts, and "Mula" to the M05 quiz.  "Mula" is always a link: M05 Q6 answers a set with no attempt left (409).
 */
import { computed } from 'vue'

import { DsIconChip, DsPanel, DsCluster, DsStack, DsHeading } from '@/ds'

import type { StudentQuestionSet } from '../../api/types'
import { SET_COPY } from './copy'
import { attemptsLabel, questionCountLabel, quizPath, timeLimitLabel } from './format'

const props = defineProps<{ item: StudentQuestionSet }>()

const time = computed(() => timeLimitLabel(props.item.timeLimitMinutes))
</script>

<template>
  <li class="min-w-0" data-testid="set-row">
    <DsPanel>
      <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <DsCluster align="start" :wrap="false">
          <DsIconChip icon="clipboard-text" accent="action" size="lg" />
          <DsStack gap="xs">
            <DsHeading :level="3" wrap="anywhere" data-testid="set-title">
              {{ item.title }}
            </DsHeading>
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
              <li v-if="time" class="inline-flex items-center gap-2" data-testid="set-time">
                <UIcon name="i-ph-clock-duotone" class="size-4 shrink-0" aria-hidden="true" />
                {{ time }}
              </li>
              <li class="inline-flex items-center gap-2" data-testid="set-attempts">
                <UIcon
                  name="i-ph-arrows-clockwise-duotone"
                  class="size-4 shrink-0"
                  aria-hidden="true"
                />
                {{ attemptsLabel(item.attemptsLeft) }}
              </li>
            </ul>
          </DsStack>
        </DsCluster>
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
