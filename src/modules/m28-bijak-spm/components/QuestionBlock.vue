<script setup lang="ts">
/**
 * One question on the attempt screen: heading ("Soalan 6 · berdasarkan Rajah 2"), stem, then MCQ
 * option cards (DsQuizOption, single column) or the structured parts. Choose-N sections add the
 * "Pilih soalan ini untuk dijawab" box; the flag button marks the question for review.
 */
import { computed, ref } from 'vue'

import { McqOptions, qdCopy } from '../../../components/question-display'
import { DsQuizOption, DsStack, DsText } from '@/ds'

import { leavesOf } from '../domain/paper-model'
import type { PartAnswer, QuestionResult, QuestionView } from '../domain/types'
import { toOptionData } from '../lib/stimulus-data'
import PartNode from './PartNode.vue'
import PartResultCard from './PartResultCard.vue'
import RichText from './RichText.vue'
import StimulusStack from './StimulusStack.vue'

const props = defineProps<{
  question: QuestionView
  answers: Record<string, PartAnswer>
  attemptId: string
  /** Label of the pinned stimulus, e.g. "Rajah 2". */
  stimulusLabel?: string
  /** The group picture failed to load: say why Seterusnya waits (AC-07.4). */
  stimulusBlocked?: boolean
  flagged: boolean
  /** Latihan after "Semak": the marked question (inputs lock, results show). */
  check?: QuestionResult
  disabled?: boolean
  choose?: { chosen: boolean; dimmed: boolean; blocked: boolean; hint?: string }
}>()
const emit = defineEmits<{
  answer: [partId: string, answer: PartAnswer]
  'toggle-flag': []
  'toggle-choose': []
}>()

const heading = ref<HTMLElement | null>(null)
defineExpose({ focus: () => heading.value?.focus() })

const locked = computed(() => !!props.check || props.disabled)
const chosenOption = computed(() => props.answers[props.question.id]?.choice)
const correctOption = computed(() => props.check?.parts[0]?.scheme.correctOption)
const partResults = computed(() => props.check?.parts ?? [])
/** The question's own stimuli above the stem (V2 section 1.5); `stemImage` only when `stimuli` is absent, so a picture shows once. */
const ownStimuli = computed(() => props.question.stimuli ?? (props.question.stemImage ? [props.question.stemImage] : []))
const leaves = computed(() => leavesOf(props.question.parts ?? []))
/** An option with a picture switches the choices to the shared `McqOptions` (picture boxes, load-failure state). */
const optionPictures = computed(() => (props.question.mcq?.options ?? []).some((o) => !!o.image))
const optionData = computed(() => (props.question.mcq?.options ?? []).map(toOptionData))

function optionState(id: string) {
  if (props.check) {
    if (id === correctOption.value) return 'correct' as const
    if (id === chosenOption.value) return 'wrong' as const
    return 'dimmed' as const
  }
  return id === chosenOption.value ? ('selected' as const) : ('idle' as const)
}

function pick(id: string): void {
  emit('answer', props.question.id, { choice: chosenOption.value === id ? undefined : id })
}
</script>

<template>
  <article
    class="flex flex-col gap-4"
    :class="choose?.dimmed ? 'opacity-70' : ''"
    :data-testid="`question-${question.id}`"
    :aria-labelledby="`h-${question.id}`"
  >
    <header class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2
          :id="`h-${question.id}`"
          ref="heading"
          tabindex="-1"
          class="font-display text-heading font-extrabold text-highlighted"
          data-testid="question-heading"
        >
          Soalan {{ question.number
          }}<template v-if="stimulusLabel"> · berdasarkan {{ stimulusLabel }}</template>
        </h2>
        <p class="tabular text-caption text-muted">[{{ question.marks }} markah]</p>
      </div>
      <UButton
        type="button"
        :color="flagged ? 'warning' : 'neutral'"
        :variant="flagged ? 'soft' : 'ghost'"
        :icon="flagged ? 'i-ph-flag-fill' : 'i-ph-flag'"
        class="min-h-11 shrink-0 rounded-2xl"
        :aria-pressed="flagged"
        data-testid="flag-button"
        @click="emit('toggle-flag')"
        >{{ flagged ? 'Ditanda' : 'Tanda soalan' }}</UButton
      >
    </header>

    <DsStack v-if="choose" gap="2xs">
      <UCheckbox
        :model-value="choose.chosen"
        :disabled="choose.blocked && !choose.chosen"
        label="Pilih soalan ini untuk dijawab"
        :aria-describedby="choose.hint ? `choose-hint-${question.id}` : undefined"
        data-testid="choose-checkbox"
        @update:model-value="emit('toggle-choose')"
      />
      <DsText
        v-if="choose.hint"
        :id="`choose-hint-${question.id}`"
        variant="caption"
        data-testid="choose-hint"
      >
        {{ choose.hint }}
      </DsText>
    </DsStack>

    <!-- The question's OWN stimuli (R1E2E-05b), above the stem as in V2 section 1.5. -->
    <StimulusStack v-if="ownStimuli.length" :stimuli="ownStimuli" data-testid="own-stimuli" />

    <p v-if="question.stem" class="text-body text-default" data-testid="question-stem">
      <RichText :text="question.stem" />
    </p>

    <p
      v-if="stimulusBlocked"
      class="text-caption text-error"
      role="status"
      data-testid="need-stimulus"
    >
      {{ qdCopy.needStimulus }}
    </p>

    <McqOptions
      v-if="question.mcq && optionPictures"
      :options="optionData"
      :model-value="chosenOption"
      :disabled="disabled"
      :name="`mcq-${question.id}`"
      :reveal="!!check"
      :correct-id="correctOption"
      @update:model-value="!disabled && pick($event)"
    />

    <div
      v-else-if="question.mcq"
      class="flex flex-col gap-3"
      role="group"
      aria-label="Pilihan jawapan"
    >
      <DsQuizOption
        v-for="(o, i) in question.mcq.options"
        :key="o.id"
        :letter="String.fromCharCode(65 + i)"
        :state="optionState(o.id)"
        :data-testid="`option-${o.id}`"
        @select="!disabled && pick(o.id)"
      >
        <RichText :text="o.text" />
      </DsQuizOption>
    </div>

    <template v-else>
      <PartNode
        v-for="p in question.parts"
        :key="p.id"
        :part="p"
        :answers="answers"
        :attempt-id="attemptId"
        :disabled="locked"
        :option-bank="question.optionBank"
        @answer="(id, a) => emit('answer', id, a)"
      />
    </template>

    <div v-if="check && !question.mcq" class="flex flex-col gap-3" data-testid="check-results">
      <PartResultCard
        v-for="r in partResults"
        :key="r.partId"
        :result="r"
        :title="leaves.find((l) => l.id === r.partId)?.label"
      />
    </div>
  </article>
</template>
