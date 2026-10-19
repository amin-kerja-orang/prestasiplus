<script setup lang="ts">
/**
 * One section of the provisional player (L-3): "Bahagian n · Soalan a-b", its audio player
 * (`DsAudioPlayer`) and its questions shown together, each a radio group A–D (FR-M09-75).
 */
import { computed } from 'vue'

import { DsAudioPlayer, DsStack, DsHeading, DsText } from '@/ds'

import type { AudioSection } from '../../api'
import { CHOICES, PLAYER_COPY, sectionRange, type Choice } from '../../lib/audio-kbat'

const props = defineProps<{
  section: AudioSection
  answers: Readonly<Record<number, Choice | undefined>>
  disabled?: boolean
}>()

const emit = defineEmits<{ choose: [no: number, choice: Choice] }>()

const questions = computed(() =>
  props.section.questions.map((q) => ({
    no: q.no,
    text: q.questionText,
    items: CHOICES.map((choice) => ({
      label: `${choice}. ${q.options[choice]}`,
      value: choice,
    })),
  })),
)

function choose(no: number, value: unknown): void {
  if (typeof value === 'string') emit('choose', no, value as Choice)
}
</script>

<template>
  <UCard
    as="section"
    class="min-w-0"
    :aria-labelledby="`section-${String(section.no)}-title`"
    data-testid="audio-section"
    :data-section-no="section.no"
  >
    <DsStack>
      <DsHeading
        :id="`section-${String(section.no)}-title`"
        :level="2"
        variant="subheading"
        wrap="anywhere"
      >
        {{ PLAYER_COPY.sectionPrefix }} {{ section.no }} · {{ PLAYER_COPY.questionPrefix }}
        {{ sectionRange(section.questions) }}
        <DsText variant="label" tone="muted" class="block" data-testid="section-title">{{
          section.title
        }}</DsText>
      </DsHeading>

      <DsAudioPlayer
        v-if="section.audioUrl"
        :src="section.audioUrl"
        :title="section.title"
        data-testid="section-audio"
      />
      <DsText v-else variant="label" as="p" tone="muted" data-testid="section-no-audio">
        {{ PLAYER_COPY.noAudio }}
      </DsText>

      <ol class="flex flex-col gap-5">
        <li v-for="q in questions" :key="q.no" class="min-w-0" data-testid="audio-question">
          <URadioGroup
            :model-value="answers[q.no]"
            :items="q.items"
            :legend="`${q.no}. ${q.text}`"
            :disabled="disabled"
            variant="card"
            class="w-full"
            :data-testid="`q${String(q.no)}`"
            @update:model-value="(v: unknown) => choose(q.no, v)"
          />
        </li>
      </ol>
    </DsStack>
  </UCard>
</template>
