<script setup lang="ts">
/** One node of a structured question: label + prompt, then either the answer controls (leaf) or its children. */
import type { MatchLayout, McqOption, PartAnswer, PartView } from '../domain/types'
import PartInput from './PartInput.vue'
import RichText from './RichText.vue'

defineOptions({ name: 'PartNode' })

defineProps<{
  part: PartView
  answers: Record<string, PartAnswer>
  attemptId: string
  disabled?: boolean
  depth?: number
  optionBank?: McqOption[]
  matchLayout?: MatchLayout
}>()
const emit = defineEmits<{ answer: [partId: string, answer: PartAnswer] }>()
</script>

<template>
  <div
    class="flex flex-col gap-3"
    :class="(depth ?? 0) > 0 ? 'ps-3' : ''"
    :data-testid="`part-${part.id}`"
  >
    <p class="flex flex-wrap items-baseline gap-x-2 text-body text-highlighted">
      <span v-if="part.label" class="font-bold">{{ part.label }}</span>
      <RichText :text="part.prompt" />
      <span v-if="!part.children?.length" class="tabular text-caption text-muted"
        >[{{ part.marks }} markah]</span
      >
    </p>
    <template v-if="part.children?.length">
      <PartNode
        v-for="c in part.children"
        :key="c.id"
        :part="c"
        :answers="answers"
        :attempt-id="attemptId"
        :disabled="disabled"
        :depth="(depth ?? 0) + 1"
        :option-bank="optionBank"
        :match-layout="matchLayout"
        @answer="(id, a) => emit('answer', id, a)"
      />
    </template>
    <PartInput
      v-else
      :leaf="{
        id: part.id,
        label: part.label,
        prompt: part.prompt,
        marks: part.marks,
        kind: part.answer?.kind ?? 'short_text',
        unit: part.answer?.unit,
        wordRange: part.answer?.wordRange,
        depth: depth ?? 0,
      }"
      :model-value="answers[part.id]"
      :attempt-id="attemptId"
      :disabled="disabled"
      :option-bank="optionBank"
      :match-layout="matchLayout"
      @update:model-value="emit('answer', part.id, $event)"
    />
  </div>
</template>
