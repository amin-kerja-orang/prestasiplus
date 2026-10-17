<script setup lang="ts">
/**
 * One section of the provisional player (L-3): "Bahagian n · Soalan a-b", its audio player
 * (`DsAudioPlayer`) and its questions shown together, each a radio group A–D (FR-M09-75).
 */
import { computed } from 'vue'

import { DsAudioPlayer } from '@/ds'

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
    <div class="flex flex-col gap-4">
      <h2
        :id="`section-${String(section.no)}-title`"
        class="text-subheading break-words text-highlighted"
      >
        {{ PLAYER_COPY.sectionPrefix }} {{ section.no }} · {{ PLAYER_COPY.questionPrefix }}
        {{ sectionRange(section.questions) }}
        <span class="block text-label text-muted" data-testid="section-title">{{
          section.title
        }}</span>
      </h2>

      <DsAudioPlayer
        v-if="section.audioUrl"
        :src="section.audioUrl"
        :title="section.title"
        data-testid="section-audio"
      />
      <p v-else class="text-label text-muted" data-testid="section-no-audio">
        {{ PLAYER_COPY.noAudio }}
      </p>

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
    </div>
  </UCard>
</template>
