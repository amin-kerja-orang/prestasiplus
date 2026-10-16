<script setup lang="ts">
/**
 * One maths entry line. The value is LaTeX (the canonical stored form). Typing works from the
 * physical keyboard (friendly forms such as `1/2`, `x^2`, `sqrt(3)` become LaTeX when the field
 * loses focus) or from the on-screen maths keyboard. A KaTeX preview shows what was understood.
 */
import { nextTick, ref, useId } from 'vue'

import { plainToLatex } from '../domain/math-expr'
import MathKeyboard, { type KeyPress } from './MathKeyboard.vue'
import RichText from './RichText.vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    label: string
    placeholder?: string
    disabled?: boolean
    /** Hide the visible label (the aria-label stays). */
    hideLabel?: boolean
    /** Allow removing this line (step lines). */
    removable?: boolean
  }>(),
  { placeholder: 'cth. 2x + 6', disabled: false, hideLabel: false, removable: false },
)
const emit = defineEmits<{ 'update:modelValue': [string]; remove: [] }>()

const id = useId()
const wrap = ref<HTMLElement | null>(null)
const keypad = ref(false)

function input(): HTMLInputElement | null {
  return wrap.value?.querySelector('input') ?? null
}

function onInput(v: string | number | undefined): void {
  emit('update:modelValue', String(v ?? ''))
}

function commit(): void {
  const converted = plainToLatex(props.modelValue)
  if (converted !== props.modelValue) emit('update:modelValue', converted)
}

async function onKey(k: KeyPress): Promise<void> {
  const el = input()
  if (!el) return
  const v = props.modelValue
  const a = el.selectionStart ?? v.length
  const b = el.selectionEnd ?? a
  let next = v
  let caret = a
  if (k.insert !== undefined) {
    next = v.slice(0, a) + k.insert + v.slice(b)
    caret = a + (k.cursor ?? k.insert.length)
  } else if (k.action === 'backspace') {
    if (a !== b) {
      next = v.slice(0, a) + v.slice(b)
      caret = a
    } else if (a > 0) {
      // Remove an empty `{}` pair or a whole `\command` in one step.
      const before = v.slice(0, a)
      const cmd = /\\[a-zA-Z]+\s?$/.exec(before)
      const cut = cmd ? cmd[0].length : 1
      next = v.slice(0, a - cut) + v.slice(a)
      caret = a - cut
    }
  } else if (k.action === 'left') {
    caret = Math.max(0, a - 1)
  } else if (k.action === 'right') {
    // Step over the `}{` of a template so "▶" goes from numerator to denominator.
    caret = a + 1
    while (v[caret - 1] === '}' && v[caret] === '{') caret += 1
  }
  if (next !== v) emit('update:modelValue', next)
  await nextTick()
  const again = input()
  again?.focus()
  again?.setSelectionRange(caret, caret)
}

function toggleKeypad(): void {
  keypad.value = !keypad.value
  if (keypad.value) void nextTick(() => input()?.focus())
}
</script>

<template>
  <div ref="wrap" class="flex flex-col gap-2" data-testid="math-field">
    <label v-if="!hideLabel" :for="id" class="text-label text-toned">{{ label }}</label>
    <div class="flex items-center gap-2">
      <UInput
        :id="id"
        :model-value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-label="hideLabel ? label : undefined"
        :inputmode="keypad ? 'none' : 'text'"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        size="xl"
        class="min-w-0 flex-1"
        data-testid="math-input"
        @update:model-value="onInput"
        @blur="commit"
        @keydown.enter.prevent="commit"
      />
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-keyboard"
        class="size-11 shrink-0 justify-center rounded-2xl"
        :aria-label="keypad ? 'Tutup papan kekunci matematik' : 'Buka papan kekunci matematik'"
        :aria-pressed="keypad"
        :disabled="disabled"
        data-testid="math-keypad-toggle"
        @click="toggleKeypad"
      />
      <UButton
        v-if="removable"
        type="button"
        color="neutral"
        variant="ghost"
        icon="i-ph-x"
        class="size-11 shrink-0 justify-center rounded-2xl"
        :aria-label="`Buang ${label}`"
        :disabled="disabled"
        @click="emit('remove')"
      />
    </div>
    <MathKeyboard v-if="keypad" label="Papan kekunci matematik" @press="onKey" @close="keypad = false" />
    <p
      v-if="modelValue.trim()"
      class="rounded-xl bg-muted px-3 py-2 text-body text-highlighted"
      data-testid="math-preview"
    >
      <span class="sr-only">Pratonton: </span>
      <RichText :text="modelValue" math-only />
    </p>
  </div>
</template>
