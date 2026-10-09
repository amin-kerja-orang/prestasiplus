<script setup lang="ts">
/**
 * Card "Pilihan Jawapan" of S6 and S7 (FR-M07-36, FR-M07-37, FR-M07-43; FN-M07-2.2.4..2.2.6).
 *
 * Rows hold a letter circle (recomputed from the position), the text input, the "Betul" checkbox
 * (`showCorrect`) and `fa-times` (hidden at 2 rows); "Tambah Pilihan" is hidden at 6 rows. The
 * checkbox and the whole card are only hidden (`v-show`), never removed, so their state is kept. A
 * `disabled` card (Bahagian C on S6) is neither validated nor sent (DV-M07-05).
 */
import { ListOrdered, Plus, X } from '@lucide/vue'

import { MAX_OPTIONS, MIN_OPTIONS, newOption, optionLetter, type OptionRow } from '../../lib/admin'

withDefaults(
  defineProps<{
    /** Visible (S6: unless Bahagian C). */
    shown?: boolean
    /** Inputs disabled (S6: Bahagian C). */
    disabled?: boolean
    /** Title suffix "(Tiada jawapan betul/salah)" (S6: Bahagian A only). */
    suffix?: boolean
    /** "Betul" checkbox visible (Bahagian B only). */
    showCorrect?: boolean
    /** Input placeholder (S6 "Teks pilihan"; S7 none). */
    placeholder?: string
  }>(),
  { shown: true, disabled: false, suffix: false, showCorrect: false, placeholder: undefined },
)

const rows = defineModel<OptionRow[]>({ required: true })

function add(): void {
  if (rows.value.length < MAX_OPTIONS) rows.value = [...rows.value, newOption()]
}

function remove(uid: number): void {
  if (rows.value.length > MIN_OPTIONS) rows.value = rows.value.filter((r) => r.uid !== uid)
}
</script>

<template>
  <section v-show="shown" class="rounded-2xl bg-white p-4 shadow sm:p-6" data-testid="options-card">
    <h2
      class="mb-4 flex flex-wrap items-center gap-2 font-heading text-lg font-bold text-slate-800"
    >
      <ListOrdered class="h-5 w-5 text-green-500" aria-hidden="true" />
      <span data-testid="options-title"
        >Pilihan Jawapan<template v-if="suffix"> (Tiada jawapan betul/salah)</template></span
      >
    </h2>
    <div class="space-y-3">
      <div
        v-for="(opt, idx) in rows"
        :key="opt.uid"
        class="flex items-center gap-2 sm:gap-3"
        data-testid="option-row"
      >
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600"
          data-testid="option-letter"
          >{{ optionLetter(idx) }}</span
        >
        <input
          v-model="opt.text"
          type="text"
          :name="`options[${String(idx)}][text]`"
          :placeholder="placeholder"
          :required="!disabled"
          :disabled="disabled"
          class="min-h-11 min-w-0 flex-1 rounded-xl border-2 border-slate-200 px-3.5 py-2.5 text-sm transition outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
          data-testid="option-text"
        />
        <label
          v-show="showCorrect"
          class="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 text-sm text-slate-700"
          data-testid="option-correct-label"
        >
          <input
            v-model="opt.isCorrect"
            type="checkbox"
            :name="`options[${String(idx)}][is_correct]`"
            value="1"
            :disabled="disabled"
            class="h-4 w-4 rounded border-slate-300 accent-green-600"
            data-testid="option-correct"
          />
          Betul
        </label>
        <button
          v-show="rows.length > MIN_OPTIONS"
          type="button"
          class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-red-500 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
          data-testid="option-remove"
          @click="remove(opt.uid)"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
    <button
      v-show="rows.length < MAX_OPTIONS"
      type="button"
      class="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:border-indigo-400 hover:text-indigo-600"
      data-testid="option-add"
      @click="add"
    >
      <Plus class="h-4 w-4" aria-hidden="true" />
      Tambah Pilihan
    </button>
  </section>
</template>
