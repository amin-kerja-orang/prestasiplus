<script setup lang="ts">
/**
 * The frame of one served question (S5-T03 part B): a question with stimuli (its group's or its own) sits in the S8-T02
 * `StimulusGroup` (pinned pane from 1024px, "Lihat {label}" sheet below); one without any is shown as it was. The runner keys this
 * frame by the group id, so the panel is mounted once for the whole group while the members change one per screen.
 */
import { StimulusGroup } from '../../../../components/question-display'
import type { StimulusData } from '../../../../components/question-display'

defineProps<{
  stimuli: readonly StimulusData[]
  groupId?: string | undefined
}>()
</script>

<template>
  <StimulusGroup v-if="stimuli.length > 0" :stimuli="stimuli" :group-id="groupId" split="sitting">
    <slot />
  </StimulusGroup>
  <slot v-else />
</template>
