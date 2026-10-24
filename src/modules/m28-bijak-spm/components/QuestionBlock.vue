<script setup lang="ts">
/**
 * One question on the attempt screen: heading ("Soalan 6 · berdasarkan Rajah 2"), stem, then MCQ
 * option cards (DsQuizOption, single column) or the structured parts. Choose-N sections add the
 * "Pilih soalan ini untuk dijawab" box; the flag button marks the question for review.
 */
import { computed, ref } from 'vue'

import { DsCluster, DsQuizOption, DsStack, DsText } from '@/ds'
import { useMedia } from '@/ds/useMedia'

import { leavesOf } from '../domain/paper-model'
import type { PartAnswer, QuestionResult, QuestionView } from '../domain/types'
import PartNode from './PartNode.vue'
import PartResultCard from './PartResultCard.vue'
import RichText from './RichText.vue'

const props = defineProps<{
  question: QuestionView
  answers: Record<string, PartAnswer>
  attemptId: string
  /** Label of the pinned stimulus, e.g. "Rajah 2". */
  stimulusLabel?: string
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

/** Phones (below sm): the flag button uses the compact size so the title keeps its room. */
const phone = useMedia('(width < 640px)', false)
const heading = ref<HTMLElement | null>(null)
defineExpose({ focus: () => heading.value?.focus() })

const locked = computed(() => !!props.check || props.disabled)
const chosenOption = computed(() => props.answers[props.question.id]?.choice)
const correctOption = computed(() => props.check?.parts[0]?.scheme.correctOption)
const partResults = computed(() => props.check?.parts ?? [])
const leaves = computed(() => leavesOf(props.question.parts ?? []))

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
    :class="choose?.dimmed ? 'opacity-70' : ''"
    :data-testid="`question-${question.id}`"
    :aria-labelledby="`h-${question.id}`"
  >
    <DsStack gap="md">
      <DsCluster as="header" gap="sm" row-gap="xs" align="start" justify="between">
        <div class="min-w-0 grow basis-32">
          <h2
            :id="`h-${question.id}`"
            ref="heading"
            tabindex="-1"
            class="font-display text-heading font-extrabold text-highlighted"
            data-testid="question-heading"
          >
            Soalan {{ question.number
            }}<template v-if="stimulusLabel"
              ><span class="sr-only"> · </span
              ><DsText as="span" variant="label" tone="muted" class="block"
                >berdasarkan <span class="text-nowrap">{{ stimulusLabel }}</span></DsText
              ></template
            >
          </h2>
          <p class="tabular text-caption text-muted">[{{ question.marks }} markah]</p>
        </div>
        <UButton
          type="button"
          :color="flagged ? 'warning' : 'neutral'"
          :variant="flagged ? 'soft' : 'ghost'"
          :icon="flagged ? 'i-ph-flag-fill' : 'i-ph-flag'"
          :size="phone ? 'sm' : undefined"
          class="ms-auto min-h-11 shrink-0 rounded-2xl"
          :aria-pressed="flagged"
          data-testid="flag-button"
          @click="emit('toggle-flag')"
          >{{ flagged ? 'Ditanda' : 'Tanda soalan' }}</UButton
        >
      </DsCluster>

      <DsStack v-if="choose" gap="none">
        <UCheckbox
          :model-value="choose.chosen"
          :disabled="choose.blocked && !choose.chosen"
          :aria-describedby="choose.hint ? `choose-hint-${question.id}` : undefined"
          data-testid="choose-checkbox"
          @update:model-value="emit('toggle-choose')"
        >
          <!-- The label is the whole row: 45 px tall, so the tap target is not the 24 px box (FB-056). -->
          <template #label>
            <span class="block py-3">Pilih soalan ini untuk dijawab</span>
          </template>
        </UCheckbox>
        <DsText
          v-if="choose.hint"
          :id="`choose-hint-${question.id}`"
          variant="caption"
          data-testid="choose-hint"
        >
          {{ choose.hint }}
        </DsText>
      </DsStack>

      <p v-if="question.stem" class="text-body text-default" data-testid="question-stem">
        <RichText :text="question.stem" />
      </p>

      <DsStack v-if="question.mcq" gap="sm" role="group" aria-label="Pilihan jawapan">
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
      </DsStack>

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

      <DsStack v-if="check && !question.mcq" gap="sm" data-testid="check-results">
        <PartResultCard
          v-for="r in partResults"
          :key="r.partId"
          :result="r"
          :title="leaves.find((l) => l.id === r.partId)?.label"
        />
      </DsStack>
    </DsStack>
  </article>
</template>
