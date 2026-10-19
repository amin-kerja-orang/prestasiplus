<script setup lang="ts">
/**
 * One maths entry line. The student types friendly notation (`1/2`, `x^2`, `√3`, `2×3`) with the
 * keyboard or the on-screen maths keyboard, which also inserts friendly tokens; LaTeX source is never
 * shown. The stored value is LaTeX (converted on every change) and a KaTeX preview right under the
 * box shows how the line was understood.
 */
import { computed, nextTick, ref, useId, watch } from 'vue'

import { latexToFriendly, plainToLatex } from '../domain/math-expr'
import MathKeyboard, { type KeyPress } from './MathKeyboard.vue'
import RichText from './RichText.vue'
import { DsCluster, DsText } from '@/ds'

const props = withDefaults(
  defineProps<{
    /** Stored value (LaTeX). */
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
/** What the student sees and edits (friendly notation); the LaTeX is derived from it. */
const text = ref(latexToFriendly(props.modelValue))

// A value that did not come from this box (reload, restore) replaces the text.
watch(
  () => props.modelValue,
  (m) => {
    if (m !== plainToLatex(text.value)) text.value = latexToFriendly(m)
  },
)

function input(): HTMLInputElement | null {
  return wrap.value?.querySelector('input') ?? null
}

/** The preview shows once there is something to show (an empty `()/()` template is not content). */
const hasContent = computed(() => text.value.replace(/[()/\s^√]/g, '').length > 0)

function setText(v: string): void {
  text.value = v
  emit('update:modelValue', plainToLatex(v))
}

function onInput(v: string | number | undefined): void {
  setText(String(v ?? ''))
}

async function onKey(k: KeyPress): Promise<void> {
  const el = input()
  if (!el) return
  const v = text.value
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
      // An empty `()` pair goes in one step.
      const pair = v.slice(a - 1, a + 1) === '()'
      next = v.slice(0, a - 1) + v.slice(a + (pair ? 1 : 0))
      caret = a - 1
    }
  } else if (k.action === 'left') {
    caret = Math.max(0, a - 1)
  } else if (k.action === 'right') {
    // Step over the `)/(` of a fraction so "▶" goes from numerator to denominator.
    caret = v.slice(a, a + 3) === ')/(' ? a + 3 : Math.min(v.length, a + 1)
  }
  if (next !== v) setText(next)
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
    <DsText v-if="!hideLabel" :for="id" variant="label" as="label" tone="toned">{{ label }}</DsText>
    <DsCluster gap="xs" :wrap="false">
      <UInput
        :id="id"
        :model-value="text"
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
        @keydown.enter.prevent
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
    </DsCluster>
    <MathKeyboard
      v-if="keypad"
      label="Papan kekunci matematik"
      @press="onKey"
      @close="keypad = false"
    />
    <p
      v-if="hasContent"
      class="rounded-xl bg-muted px-3 py-2 text-body text-highlighted"
      data-testid="math-preview"
    >
      <span class="sr-only">Pratonton: </span>
      <RichText :text="modelValue" math-only />
    </p>
  </div>
</template>
