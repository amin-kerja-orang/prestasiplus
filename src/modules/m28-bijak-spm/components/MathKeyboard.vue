<script setup lang="ts">
/**
 * On-screen maths keypad laid out like the Casio fx-570 / fx-991 SPM students use (US-09): a
 * function area on top (layer "Fungsi": fraction, root, powers, trig, log; layer "Simbol": x, y,
 * comma, %, ±, inequalities, =; both over `( ) π °` and a layer key) above a number block
 * (7 8 9 DEL AC / 4 5 6 × ÷ / 1 2 3 + − / 0 . ×10ˣ cursor). Keys are tab-reachable buttons; they
 * insert friendly notation at the caret of the field that owns the keypad. The key map lives in
 * `lib/math-keys.ts`. Built from DS layout primitives only (the owner draws the surface).
 */
import { computed, ref } from 'vue'

import { DsGrid, DsStack } from '@/ds'

import {
  FUNCTION_ROWS,
  type KeyPress,
  type KeyTone,
  type MathKey,
  NUMBER_ROWS,
  SHARED_KEYS,
  SYMBOL_ROWS,
} from '../lib/math-keys'
import RichText from './RichText.vue'

export type { KeyPress }

defineProps<{ label: string }>()
const emit = defineEmits<{ press: [KeyPress]; close: [] }>()

const symbols = ref(false)
/** The fraction key shows an empty stacked fraction (KaTeX), like the box-over-box key on a Casio. */
const FRAC_GLYPH = '\\tfrac{\\square}{\\square}'

type ButtonColor = 'primary' | 'neutral' | 'warning'
type ButtonVariant = 'soft' | 'solid' | 'subtle'
type Tone = KeyTone | 'layer'
/** Tone of a key: function and symbol keys are primary-tinted, operators solid, DEL / AC warning. */
const TONE: Record<Tone, { color: ButtonColor; variant: ButtonVariant }> = {
  fn: { color: 'primary', variant: 'soft' },
  sci: { color: 'primary', variant: 'soft' },
  sym: { color: 'primary', variant: 'soft' },
  num: { color: 'neutral', variant: 'subtle' },
  op: { color: 'primary', variant: 'solid' },
  del: { color: 'warning', variant: 'soft' },
  nav: { color: 'neutral', variant: 'soft' },
  layer: { color: 'neutral', variant: 'subtle' },
}

interface KeyView {
  id: string
  label: string
  aria: string
  tone: Tone
  key?: MathKey
}

/** The layer key sits at the end of the shared row; its label names the layer it switches to. */
const layerKey = computed<KeyView>(() => ({
  id: 'layer',
  label: symbols.value ? 'Fungsi' : 'Simbol',
  aria: symbols.value ? 'Papar kekunci fungsi' : 'Papar kekunci simbol',
  tone: 'layer',
}))

const view = (k: MathKey): KeyView => ({
  id: k.id,
  label: k.label,
  aria: k.aria,
  tone: k.tone,
  key: k,
})

/** Two groups of 5-column rows: the function area, then the number block. */
const groups = computed<KeyView[][][]>(() => [
  [
    ...(symbols.value ? SYMBOL_ROWS : FUNCTION_ROWS).map((r) => r.map(view)),
    [...SHARED_KEYS.map(view), layerKey.value],
  ],
  NUMBER_ROWS.map((r) => r.map(view)),
])

function press(k: KeyView): void {
  if (!k.key) {
    symbols.value = !symbols.value
    return
  }
  emit(
    'press',
    k.key.action ? { action: k.key.action } : { insert: k.key.insert, cursor: k.key.cursor },
  )
}
</script>

<template>
  <DsStack
    gap="2xs"
    class="mx-auto w-full max-w-md"
    role="group"
    :aria-label="label"
    data-testid="math-keyboard"
    @keydown.esc.stop="emit('close')"
  >
    <span class="sr-only" aria-live="polite" data-testid="math-layer-status">{{
      symbols ? 'Lapisan simbol' : 'Lapisan fungsi'
    }}</span>
    <DsStack
      v-for="(rows, g) in groups"
      :key="g"
      gap="2xs"
      :data-testid="
        g === 1 ? 'math-area-number' : symbols ? 'math-area-simbol' : 'math-area-fungsi'
      "
    >
      <DsGrid v-for="(row, r) in rows" :key="`${symbols}-${r}`" :cols="5" gap="2xs">
        <UButton
          v-for="k in row"
          :key="k.id"
          type="button"
          block
          :color="TONE[k.tone].color"
          :variant="TONE[k.tone].variant"
          :class="
            k.tone === 'num' || k.tone === 'op'
              ? 'min-h-11 sm:min-h-12 learner:min-h-11 sm:learner:min-h-12'
              : 'min-h-11 learner:min-h-11'
          "
          class="px-0 learner:px-0"
          :aria-label="k.aria"
          :data-key="k.id"
          :data-testid="k.id === 'layer' ? 'math-layer' : undefined"
          @mousedown.prevent
          @click="press(k)"
        >
          <RichText v-if="k.id === 'frac'" :text="FRAC_GLYPH" math-only />
          <template v-else>{{ k.label }}</template>
        </UButton>
      </DsGrid>
    </DsStack>
  </DsStack>
</template>
