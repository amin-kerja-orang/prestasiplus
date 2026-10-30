<script setup lang="ts">
/**
 * `extended_essay` (textarea + live word counter, turns "over" past `wordLimit`) and `essay_choice`
 * (pick one topic, then write; counter shows the target range). `readonly` = Semakan.
 * The counter is announced politely; "over" carries an icon and the words "melebihi had".
 */
import { computed } from 'vue'

import { qdCopy, wordCountLabel, wordTargetLabel } from './copy'
import type { EssayChoiceValue, EssayTopic } from './types'
import { countWords } from './words'

const props = withDefaults(
  defineProps<{
    mode: 'extended_essay' | 'essay_choice'
    /** extended_essay: the text. */
    modelValue?: string
    /** essay_choice: topic + text. */
    choice?: EssayChoiceValue
    topics?: EssayTopic[]
    wordLimit?: number
    range?: { min: number; max: number }
    readonly?: boolean
    disabled?: boolean
    name?: string
  }>(),
  {
    modelValue: '',
    choice: undefined,
    topics: () => [],
    wordLimit: undefined,
    range: undefined,
    readonly: false,
    disabled: false,
    name: undefined,
  },
)
const emit = defineEmits<{
  'update:modelValue': [string]
  'update:choice': [EssayChoiceValue]
}>()

const isChoice = computed(() => props.mode === 'essay_choice')
const text = computed(() => (isChoice.value ? (props.choice?.text ?? '') : props.modelValue))
const words = computed(() => countWords(text.value))
const over = computed(() => !isChoice.value && !!props.wordLimit && words.value > props.wordLimit)
const needTopic = computed(() => isChoice.value && !props.choice?.topic)
const counter = computed(() =>
  isChoice.value && props.range
    ? wordTargetLabel(words.value, props.range.min, props.range.max)
    : wordCountLabel(words.value),
)
const groupName = computed(() => props.name ?? `topic-${Math.random().toString(36).slice(2, 8)}`)

function onText(v: string): void {
  if (isChoice.value) emit('update:choice', { topic: props.choice?.topic, text: v })
  else emit('update:modelValue', v)
}
function pick(id: string): void {
  emit('update:choice', { topic: id, text: props.choice?.text ?? '' })
}
</script>

<template>
  <div class="flex w-full flex-col gap-3" :data-testid="`answer-${mode}`">
    <div
      v-if="isChoice"
      role="radiogroup"
      :aria-label="qdCopy.essayChoiceTopicsAria"
      class="flex flex-col gap-2"
      data-testid="topic-list"
    >
      <label
        v-for="t in topics"
        :key="t.id"
        class="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl p-3 text-body text-default ring-1 ring-inset has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
        :class="choice?.topic === t.id ? 'bg-primary/18 ring-primary' : 'bg-default ring-default'"
        :data-testid="`topic-${t.id}`"
      >
        <input
          type="radio"
          class="mt-1 size-4 shrink-0 accent-primary"
          :name="groupName"
          :value="t.id"
          :checked="choice?.topic === t.id"
          :disabled="readonly || disabled"
          @change="pick(t.id)"
        />
        <span>{{ t.label }}</span>
      </label>
    </div>

    <p v-if="needTopic" class="text-caption text-muted" data-testid="topic-hint">
      {{ qdCopy.essayChoiceHint }}
    </p>

    <UTextarea
      :model-value="text"
      :placeholder="isChoice ? qdCopy.essayChoicePlaceholder : qdCopy.essayPlaceholder"
      :aria-label="isChoice ? qdCopy.essayChoiceAria : qdCopy.essayAria"
      :readonly="readonly"
      :disabled="disabled || needTopic"
      :rows="8"
      autoresize
      class="w-full"
      data-testid="answer-textarea"
      @update:model-value="onText(String($event ?? ''))"
    />

    <p
      class="flex items-center gap-1 text-caption"
      :class="over ? 'text-error' : 'text-muted'"
      role="status"
      :data-over="over"
      data-testid="word-count"
    >
      <UIcon v-if="over" name="i-ph-warning" class="size-4" aria-hidden="true" />
      {{ counter }}<template v-if="over"> · {{ qdCopy.over }}</template>
    </p>
  </div>
</template>
