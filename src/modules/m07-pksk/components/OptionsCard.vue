<script setup lang="ts">
/**
 * Card "Pilihan Jawapan" of S6 and S7 (FR-M07-36, FR-M07-37, FR-M07-43; FN-M07-2.2.4..2.2.6).
 *
 * Rows hold a letter badge (recomputed from the position), the text input, the "Betul" checkbox
 * (`showCorrect`) and a remove button (hidden at 2 rows); "Tambah Pilihan" is hidden at 6 rows. The
 * checkbox and the whole card are only hidden (`v-show`), never removed, so their state is kept. A
 * `disabled` card (Bahagian C on S6) is neither validated nor sent (DV-M07-05).
 */
import { DsFormSection, DsStack, DsCluster } from '@/ds'

import { MAX_OPTIONS, MIN_OPTIONS, newOption, optionLetter, type OptionRow } from '../lib/admin'

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
  <div v-show="shown" data-testid="options-card">
    <DsFormSection
      :title="suffix ? 'Pilihan Jawapan (Tiada jawapan betul/salah)' : 'Pilihan Jawapan'"
      icon="list-numbers"
      accent="win"
    >
      <DsStack gap="sm">
        <DsCluster v-for="(opt, idx) in rows" :key="opt.uid" :wrap="false" data-testid="option-row">
          <UBadge
            color="neutral"
            variant="soft"
            size="lg"
            :label="optionLetter(idx)"
            data-testid="option-letter"
          />
          <UInput
            v-model="opt.text"
            type="text"
            :name="`options[${String(idx)}][text]`"
            :aria-label="`Pilihan ${optionLetter(idx)}`"
            :placeholder="placeholder"
            :required="!disabled"
            :disabled="disabled"
            size="md"
            class="min-w-0 flex-1"
            data-testid="option-text"
          />
          <UCheckbox
            v-show="showCorrect"
            v-model="opt.isCorrect"
            label="Betul"
            :name="`options[${String(idx)}][is_correct]`"
            value="1"
            :disabled="disabled"
            :ui="{ root: 'min-h-11 items-center' }"
            data-testid="option-correct"
          />
          <UButton
            v-show="rows.length > MIN_OPTIONS"
            type="button"
            color="error"
            variant="ghost"
            icon="i-ph-x"
            aria-label="Buang pilihan"
            class="min-h-11 min-w-11 justify-center"
            data-testid="option-remove"
            @click="remove(opt.uid)"
          />
        </DsCluster>
      </DsStack>
      <UButton
        v-show="rows.length < MAX_OPTIONS"
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-plus"
        label="Tambah Pilihan"
        block
        class="min-h-11"
        data-testid="option-add"
        @click="add"
      />
    </DsFormSection>
  </div>
</template>
