<script setup lang="ts">
/**
 * Dispatcher for the five production answer modes (US-10). Binds one `modelValue`:
 * mcq = option id, short_text / numeric / extended_essay = string, essay_choice = { topic, text }.
 * An unknown mode renders nothing: the "Jenis jawapan ini akan tersedia tidak lama lagi." fallback
 * is never shown for an approved question (AC-10.10).
 */
import { computed } from 'vue'

import EssayAnswer from './EssayAnswer.vue'
import McqOptions from './McqOptions.vue'
import TextAnswer from './TextAnswer.vue'
import type { AnswerMode, EssayChoiceValue, EssayTopic, McqOptionData } from './types'

const props = defineProps<{
  mode: AnswerMode
  modelValue?: string | EssayChoiceValue
  options?: McqOptionData[]
  topics?: EssayTopic[]
  unit?: string
  wordLimit?: number
  range?: { min: number; max: number }
  readonly?: boolean
  reveal?: boolean
  correctId?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [string | EssayChoiceValue] }>()

const asString = computed(() => (typeof props.modelValue === 'string' ? props.modelValue : undefined))
const asChoice = computed(() =>
  typeof props.modelValue === 'object' ? props.modelValue : undefined,
)
</script>

<template>
  <McqOptions
    v-if="mode === 'mcq'"
    :options="options ?? []"
    :model-value="asString"
    :disabled="readonly"
    :reveal="reveal"
    :correct-id="correctId"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <TextAnswer
    v-else-if="mode === 'short_text' || mode === 'numeric'"
    :mode="mode"
    :model-value="asString"
    :unit="unit"
    :readonly="readonly"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <EssayAnswer
    v-else-if="mode === 'extended_essay'"
    mode="extended_essay"
    :model-value="asString"
    :word-limit="wordLimit"
    :readonly="readonly"
    @update:model-value="emit('update:modelValue', $event)"
  />
  <EssayAnswer
    v-else-if="mode === 'essay_choice'"
    mode="essay_choice"
    :choice="asChoice"
    :topics="topics"
    :range="range"
    :readonly="readonly"
    @update:choice="emit('update:modelValue', $event)"
  />
</template>
