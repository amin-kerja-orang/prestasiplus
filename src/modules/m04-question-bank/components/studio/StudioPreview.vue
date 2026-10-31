<script setup lang="ts">
/**
 * Pratonton (design S1.4): the question as the pupil sees it. A question in a group shows the shared stimulus ONCE with every
 * member under it (D90), through the shared display library (`StimulusGroup`: pinned pane from 1024px, chip and sheet below).
 * A group's further stimuli (up to three) are listed above the questions. Display only.
 */
import { computed } from 'vue'

// The pupil display library is what D90 renders groups with. It has no `@/ds` re-export yet, and the admin import rule bans
// `@/components/*`, so it is reached by path until the DS owner re-exports it (reported to the lead).
import { StimulusFigure, StimulusGroup } from '../../../../components/question-display'
import { DsDialog, DsStack, DsText } from '@/ds'

import type { StudioDraft } from '../../lib/studio/draft'
import type { GroupView } from '../../lib/studio/group-members'
import { previewItems, toStimulusData } from '../../lib/studio/preview'

const props = defineProps<{ group: GroupView | null; draft: StudioDraft; questionId: string | null }>()
const open = defineModel<boolean>('open', { required: true })
const sheet = defineModel<boolean>('sheet', { default: false })

const items = computed(() => previewItems(props.group, props.draft, props.questionId))
const stimuli = computed(() => (props.group?.stimuli ?? []).map(toStimulusData))
</script>

<template>
  <DsDialog v-model:open="open" title="Pratonton" size="lg" data-testid="studio-preview">
    <StimulusGroup v-if="stimuli[0]" v-model:open="sheet" :stimulus="stimuli[0]">
      <DsStack gap="md">
        <StimulusFigure v-for="s in stimuli.slice(1)" :key="s.id" :stimulus="s" />
        <DsStack v-for="it in items" :key="it.id" gap="xs" :data-testid="`studio-preview-q-${it.id}`">
          <DsText variant="body-strong">{{ it.label ? `${it.label}. ` : '' }}{{ it.stem || 'Teks soalan belum diisi.' }}</DsText>
          <DsStack v-for="l in it.leaves" :key="l.label" gap="2xs">
            <DsText variant="body">({{ l.label }}) {{ l.prompt }}</DsText>
            <DsText v-for="o in l.options" :key="o.letter" variant="body" tone="muted">{{ o.letter }}. {{ o.text }}</DsText>
          </DsStack>
        </DsStack>
      </DsStack>
    </StimulusGroup>
    <DsStack v-else gap="xs">
      <DsText variant="body-strong" data-testid="studio-preview-single">{{ draft.stem || 'Teks soalan belum diisi.' }}</DsText>
      <DsStack v-for="l in items[0]?.leaves ?? []" :key="l.label" gap="2xs">
        <DsText variant="body">({{ l.label }}) {{ l.prompt }}</DsText>
        <DsText v-for="o in l.options" :key="o.letter" variant="body" tone="muted">{{ o.letter }}. {{ o.text }}</DsText>
      </DsStack>
    </DsStack>
  </DsDialog>
</template>
