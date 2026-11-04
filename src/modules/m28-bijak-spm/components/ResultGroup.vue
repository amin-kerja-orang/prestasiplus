<script setup lang="ts">
/**
 * A stimulus group in the Semakan list: the stimuli are shown ONCE with every member question under them
 * (D90), through the one shared StimulusGroup (pinned pane from 1024px, chip + sheet below it). No group id: the sheet starts closed on the result page.
 * The member cards go in the default slot.
 */
import { computed } from 'vue'

import type { StimulusDef } from '../domain/types'
import { groupLabel, toStimulusData } from '../lib/stimulus-data'
import { StimulusGroup } from '../../../components/question-display'

const props = defineProps<{ groupId: string; stimuli: readonly StimulusDef[] }>()
const label = groupLabel(props.stimuli)
const data = computed(() => props.stimuli.map(toStimulusData))
</script>

<template>
  <section :aria-label="label" :data-group="groupId" data-testid="result-group">
    <StimulusGroup :stimuli="data" :exclude-unrenderable="true" :hint="false">
      <div class="flex min-w-0 flex-col gap-3" data-testid="result-group-members"><slot /></div>
    </StimulusGroup>
  </section>
</template>
