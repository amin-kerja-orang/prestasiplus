<script setup lang="ts">
/**
 * On-screen maths keyboard (US-09): fraction, power, root, pi, plus-minus, times, divide,
 * brackets, x / y, digits. Keys are 44 px and tab-reachable buttons; they insert LaTeX at the
 * caret of the field that owns the keyboard.
 */
export interface KeyPress {
  insert?: string
  /** Caret offset inside the inserted text (default: its end). */
  cursor?: number
  action?: 'backspace' | 'left' | 'right'
}

interface Key {
  id: string
  label: string
  aria: string
  insert?: string
  cursor?: number
  action?: KeyPress['action']
  tone?: 'math' | 'num' | 'act'
}

const KEYS: Key[] = [
  { id: 'frac', label: 'a/b', aria: 'Pecahan', insert: '\\frac{}{}', cursor: 6, tone: 'math' },
  { id: 'pow', label: 'xⁿ', aria: 'Kuasa', insert: '^{}', cursor: 2, tone: 'math' },
  { id: 'sq', label: 'x²', aria: 'Kuasa dua', insert: '^{2}', cursor: 4, tone: 'math' },
  { id: 'sqrt', label: '√', aria: 'Punca kuasa dua', insert: '\\sqrt{}', cursor: 6, tone: 'math' },
  { id: 'pi', label: 'π', aria: 'Pi', insert: '\\pi ', tone: 'math' },
  { id: 'pm', label: '±', aria: 'Tambah atau tolak', insert: '\\pm ', tone: 'math' },
  { id: '7', label: '7', aria: '7', insert: '7', tone: 'num' },
  { id: '8', label: '8', aria: '8', insert: '8', tone: 'num' },
  { id: '9', label: '9', aria: '9', insert: '9', tone: 'num' },
  { id: 'times', label: '×', aria: 'Darab', insert: '\\times ', tone: 'math' },
  { id: 'div', label: '÷', aria: 'Bahagi', insert: '\\div ', tone: 'math' },
  { id: 'back', label: '⌫', aria: 'Padam', action: 'backspace', tone: 'act' },
  { id: '4', label: '4', aria: '4', insert: '4', tone: 'num' },
  { id: '5', label: '5', aria: '5', insert: '5', tone: 'num' },
  { id: '6', label: '6', aria: '6', insert: '6', tone: 'num' },
  { id: 'plus', label: '+', aria: 'Tambah', insert: '+', tone: 'math' },
  { id: 'minus', label: '−', aria: 'Tolak', insert: '-', tone: 'math' },
  { id: 'left', label: '◀', aria: 'Kursor ke kiri', action: 'left', tone: 'act' },
  { id: '1', label: '1', aria: '1', insert: '1', tone: 'num' },
  { id: '2', label: '2', aria: '2', insert: '2', tone: 'num' },
  { id: '3', label: '3', aria: '3', insert: '3', tone: 'num' },
  { id: 'lp', label: '(', aria: 'Kurungan buka', insert: '(', tone: 'math' },
  { id: 'rp', label: ')', aria: 'Kurungan tutup', insert: ')', tone: 'math' },
  { id: 'right', label: '▶', aria: 'Kursor ke kanan', action: 'right', tone: 'act' },
  { id: '0', label: '0', aria: '0', insert: '0', tone: 'num' },
  { id: 'dot', label: '.', aria: 'Titik perpuluhan', insert: '.', tone: 'num' },
  { id: 'x', label: 'x', aria: 'Pemboleh ubah x', insert: 'x', tone: 'math' },
  { id: 'y', label: 'y', aria: 'Pemboleh ubah y', insert: 'y', tone: 'math' },
  { id: 'eq', label: '=', aria: 'Sama dengan', insert: '=', tone: 'math' },
  { id: 'lt', label: '<', aria: 'Kurang daripada', insert: '<', tone: 'math' },
  { id: 'gt', label: '>', aria: 'Lebih daripada', insert: '>', tone: 'math' },
  { id: 'le', label: '≤', aria: 'Kurang daripada atau sama dengan', insert: '\\le ', tone: 'math' },
  { id: 'ge', label: '≥', aria: 'Lebih daripada atau sama dengan', insert: '\\ge ', tone: 'math' },
  { id: 'percent', label: '%', aria: 'Peratus', insert: '\\%', tone: 'math' },
  { id: 'comma', label: ',', aria: 'Koma', insert: ', ', tone: 'math' },
]

defineProps<{ label: string }>()
const emit = defineEmits<{ press: [KeyPress]; close: [] }>()

function press(k: Key): void {
  emit('press', k.action ? { action: k.action } : { insert: k.insert, cursor: k.cursor })
}
</script>

<template>
  <div
    class="grid grid-cols-7 gap-1 rounded-card bg-muted p-2"
    role="group"
    :aria-label="label"
    data-testid="math-keyboard"
    @keydown.esc.stop="emit('close')"
  >
    <UButton
      v-for="k in KEYS"
      :key="k.id"
      type="button"
      :color="k.tone === 'math' ? 'primary' : 'neutral'"
      variant="soft"
      class="min-h-11 justify-center rounded-xl text-body font-semibold"
      :aria-label="k.aria"
      :data-key="k.id"
      @mousedown.prevent
      @click="press(k)"
      >{{ k.label }}</UButton
    >
  </div>
</template>
