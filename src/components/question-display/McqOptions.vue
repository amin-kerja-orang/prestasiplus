<script setup lang="ts">
/**
 * `mcq` answer widget: radio group "Pilihan jawapan"; each option is a lettered chip with the body
 * and an optional picture. Whole option is the touch target (>= 44px). `reveal` (Semakan) locks the
 * group and marks the correct and the wrong chosen option with an icon and a word, never colour only.
 * Option images: one column at 375, two columns from 768.
 */
import { computed, ref } from 'vue'

import { qdCopy } from './copy'
import type { McqOptionData } from './types'

const props = withDefaults(
  defineProps<{
    options: McqOptionData[]
    /** Option id (single choice) or the ticked option ids in option order (`multi`). */
    modelValue?: string | string[]
    /** `mcq_multi`: checkbox group (2 to 8 options), `v-model` is `string[]`. */
    multi?: boolean
    disabled?: boolean
    /** Name of the radio group; defaults to a unique one. */
    name?: string
    /** Semakan: show the verdict. */
    reveal?: boolean
    /** Id of the correct option (only used with `reveal`). */
    correctId?: string
    /** Ids of the correct options (only used with `reveal` and `multi`). */
    correctIds?: string[]
  }>(),
  {
    modelValue: undefined,
    multi: false,
    disabled: false,
    name: undefined,
    reveal: false,
    correctId: undefined,
    correctIds: undefined,
  },
)
const emit = defineEmits<{ 'update:modelValue': [string | string[]]; 'image-error': [string] }>()

const ticked = computed<string[]>(() =>
  Array.isArray(props.modelValue) ? props.modelValue : [],
)
function isOn(id: string): boolean {
  return props.multi ? ticked.value.includes(id) : props.modelValue === id
}
function toggle(id: string, on: boolean): void {
  const next = new Set(ticked.value)
  if (on) next.add(id)
  else next.delete(id)
  emit('update:modelValue', props.options.map((o) => o.id).filter((x) => next.has(x)))
}

const uid = `mcq-${Math.random().toString(36).slice(2, 8)}`
const groupName = computed(() => props.name ?? uid)
const hasImages = computed(() => props.options.some((o) => o.imageSrc))
const broken = ref<Record<string, boolean>>({})

function verdict(o: McqOptionData): 'correct' | 'wrong' | undefined {
  if (!props.reveal) return undefined
  if (props.multi) {
    const right = props.correctIds?.includes(o.id) ?? false
    if (right) return 'correct'
    return isOn(o.id) ? 'wrong' : undefined
  }
  if (o.id === props.correctId) return 'correct'
  if (o.id === props.modelValue) return 'wrong'
  return undefined
}
function onImgError(id: string): void {
  broken.value = { ...broken.value, [id]: true }
  emit('image-error', id)
}
</script>

<template>
  <div class="flex flex-col gap-2">
  <p v-if="multi" :id="`${groupName}-hint`" class="text-caption text-toned" data-testid="mcq-multi-hint">
    {{ qdCopy.mcqMultiHint }}
  </p>
  <div
    :role="multi ? 'group' : 'radiogroup'"
    :aria-label="qdCopy.mcqAria"
    :aria-describedby="multi ? `${groupName}-hint` : undefined"
    class="grid grid-cols-1 gap-2"
    :class="hasImages ? 'md:grid-cols-2' : ''"
    data-testid="mcq-options"
  >
    <label
      v-for="o in options"
      :key="o.id"
      class="relative flex min-h-11 items-start gap-3 rounded-xl p-3 text-body text-default ring-1 ring-inset has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
      :class="[
        verdict(o) === 'correct'
          ? 'bg-success/20 ring-success'
          : verdict(o) === 'wrong'
            ? 'bg-error/20 ring-error'
            : isOn(o.id)
              ? 'bg-primary/18 ring-primary'
              : 'bg-default ring-default',
        disabled || reveal ? 'cursor-default' : 'cursor-pointer',
      ]"
      :data-testid="`mcq-option-${o.id}`"
      :data-selected="isOn(o.id)"
      :data-verdict="verdict(o)"
    >
      <input
        :type="multi ? 'checkbox' : 'radio'"
        class="sr-only"
        :name="groupName"
        :value="o.id"
        :checked="isOn(o.id)"
        :disabled="disabled || reveal"
        :aria-label="`${o.letter}. ${o.text}`"
        @change="
          multi
            ? toggle(o.id, ($event.target as HTMLInputElement).checked)
            : emit('update:modelValue', o.id)
        "
      />
      <span
        class="flex size-8 shrink-0 items-center justify-center rounded-full text-label font-semibold"
        :class="isOn(o.id) ? 'bg-primary text-primary-on' : 'bg-elevated text-toned'"
        aria-hidden="true"
        >{{ o.letter }}</span
      >
      <span class="flex min-w-0 grow flex-col gap-2">
        <span>{{ o.text }}</span>
        <template v-if="o.imageSrc">
          <span
            v-if="broken[o.id]"
            class="flex items-center gap-2 rounded-lg border border-error p-2 text-caption text-error"
            data-testid="mcq-image-failed"
          >
            <UIcon name="i-ph-warning-circle" class="size-4 shrink-0" aria-hidden="true" />
            {{ qdCopy.imageFailed }}
          </span>
          <img
            v-else
            :src="o.imageSrc"
            :alt="o.imageAlt ?? o.text"
            :width="o.imageWidth"
            :height="o.imageHeight"
            loading="lazy"
            decoding="async"
            class="h-auto max-h-48 w-full rounded-lg bg-muted object-contain"
            :style="
              o.imageWidth && o.imageHeight
                ? { aspectRatio: `${o.imageWidth} / ${o.imageHeight}` }
                : undefined
            "
            data-testid="mcq-option-image"
            @error="onImgError(o.id)"
          />
        </template>
      </span>
      <span
        v-if="verdict(o)"
        class="flex shrink-0 items-center gap-1 text-caption font-semibold"
        :class="verdict(o) === 'correct' ? 'text-success' : 'text-error'"
        data-testid="mcq-verdict"
      >
        <UIcon
          :name="verdict(o) === 'correct' ? 'i-ph-check-circle' : 'i-ph-x-circle'"
          class="size-5"
          aria-hidden="true"
        />
        {{ verdict(o) === 'correct' ? 'Betul' : 'Salah' }}
      </span>
    </label>
  </div>
  </div>
</template>
