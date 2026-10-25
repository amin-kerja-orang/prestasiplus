<script setup lang="ts">
/**
 * On-screen maths keypad laid out like the Casio fx-570 / fx-991 SPM students use (US-09): a
 * function area on top (layer "Fungsi": fraction, root, powers, trig, log; layer "Simbol": x, y,
 * comma, %, ±, inequalities, =; both over `( ) π °` and a layer key) above a number block
 * (7 8 9 DEL AC / 4 5 6 × ÷ / 1 2 3 + − / 0 . ×10ˣ cursor). Keys are tab-reachable buttons; they
 * insert friendly notation at the caret of the field that owns the keypad. The key map lives in
 * `lib/math-keys.ts`.
 */
import { ref } from 'vue'

import {
  FUNCTION_ROWS,
  type KeyPress,
  type KeyTone,
  type MathKey,
  NUMBER_ROWS,
  SHARED_KEYS,
  SYMBOL_ROWS,
} from '../lib/math-keys'

export type { KeyPress }

defineProps<{ label: string }>()
const emit = defineEmits<{ press: [KeyPress]; close: [] }>()

const symbols = ref(false)

type ButtonColor = 'primary' | 'neutral' | 'warning'
type ButtonVariant = 'soft' | 'solid' | 'subtle'
/** Tone of a key: function and symbol keys are primary-tinted, operators solid, DEL / AC warning. */
const TONE: Record<KeyTone, { color: ButtonColor; variant: ButtonVariant }> = {
  fn: { color: 'primary', variant: 'soft' },
  sci: { color: 'primary', variant: 'soft' },
  sym: { color: 'primary', variant: 'soft' },
  num: { color: 'neutral', variant: 'subtle' },
  op: { color: 'primary', variant: 'solid' },
  del: { color: 'warning', variant: 'soft' },
  nav: { color: 'neutral', variant: 'soft' },
}

function press(k: MathKey): void {
  emit('press', k.action ? { action: k.action } : { insert: k.insert, cursor: k.cursor })
}
</script>

<template>
  <div
    class="mx-auto flex w-full max-w-md flex-col gap-1 rounded-card bg-accented p-1.5 sm:gap-1.5 sm:p-2"
    role="group"
    :aria-label="label"
    data-testid="math-keyboard"
    @keydown.esc.stop="emit('close')"
  >
    <span class="sr-only" aria-live="polite" data-testid="math-layer-status">{{
      symbols ? 'Lapisan simbol' : 'Lapisan fungsi'
    }}</span>
    <div
      class="flex flex-col gap-1 sm:gap-1.5"
      :data-testid="symbols ? 'math-area-simbol' : 'math-area-fungsi'"
    >
      <div
        v-for="(row, r) in symbols ? SYMBOL_ROWS : FUNCTION_ROWS"
        :key="`${symbols}-${r}`"
        class="grid grid-cols-5 gap-1 sm:gap-1.5"
      >
        <UButton
          v-for="k in row"
          :key="k.id"
          type="button"
          :color="TONE[k.tone].color"
          :variant="TONE[k.tone].variant"
          class="min-h-11 w-full min-w-0 justify-center rounded-xl px-0 text-label learner:min-h-11 learner:rounded-xl learner:px-0 learner:text-label"
          :aria-label="k.aria"
          :data-key="k.id"
          @mousedown.prevent
          @click="press(k)"
        >
          <span
            v-if="k.id === 'frac'"
            class="flex flex-col items-center gap-0.5"
            aria-hidden="true"
          >
            <span class="size-2 rounded-none bg-primary-t opacity-60" />
            <span class="h-0.5 w-4 bg-primary-t" />
            <span class="size-2 rounded-none bg-primary-t opacity-60" />
          </span>
          <template v-else>{{ k.label }}</template>
        </UButton>
      </div>
      <div class="grid grid-cols-5 gap-1 sm:gap-1.5">
        <UButton
          v-for="k in SHARED_KEYS"
          :key="k.id"
          type="button"
          :color="TONE[k.tone].color"
          :variant="TONE[k.tone].variant"
          class="min-h-11 w-full min-w-0 justify-center rounded-xl px-0 text-label learner:min-h-11 learner:rounded-xl learner:px-0 learner:text-label"
          :aria-label="k.aria"
          :data-key="k.id"
          @mousedown.prevent
          @click="press(k)"
          >{{ k.label }}</UButton
        >
        <UButton
          type="button"
          color="neutral"
          variant="subtle"
          class="min-h-11 w-full min-w-0 justify-center rounded-xl px-0 text-caption learner:min-h-11 learner:rounded-xl learner:px-0 learner:text-caption"
          :aria-label="symbols ? 'Papar kekunci fungsi' : 'Papar kekunci simbol'"
          data-key="layer"
          data-testid="math-layer"
          @mousedown.prevent
          @click="symbols = !symbols"
          >{{ symbols ? 'Fungsi' : 'Simbol' }}</UButton
        >
      </div>
    </div>

    <div class="mt-1 flex flex-col gap-1 sm:gap-1.5" data-testid="math-area-number">
      <div v-for="(row, r) in NUMBER_ROWS" :key="r" class="grid grid-cols-5 gap-1 sm:gap-1.5">
        <UButton
          v-for="k in row"
          :key="k.id"
          type="button"
          :color="TONE[k.tone].color"
          :variant="TONE[k.tone].variant"
          class="min-h-11 w-full min-w-0 justify-center rounded-xl px-0 sm:min-h-12 md:min-h-14 learner:min-h-11 learner:rounded-xl learner:px-0 sm:learner:min-h-12 md:learner:min-h-14"
          :class="k.tone === 'num' || k.tone === 'op' ? 'text-heading' : 'text-label'"
          :aria-label="k.aria"
          :data-key="k.id"
          @mousedown.prevent
          @click="press(k)"
          >{{ k.label }}</UButton
        >
      </div>
    </div>
  </div>
</template>
