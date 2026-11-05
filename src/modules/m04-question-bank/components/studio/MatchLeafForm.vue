<script setup lang="ts">
/**
 * Answer editor of the `match_letter` mode (PRD45 3.1.6 mode 2, FR-ADM-QE3.18): the leaf has no options of its own, it points
 * at a letter of the stimulus group's bank (`Bank pilihan`). `Jawapan betul` lists the bank letters; `Setiap huruf digunakan
 * sekali` is `key.bankUnique`. Without a group the form shows the PRD text instead of the select.
 */
import { DsCallout, DsFormField, DsNativeSelect, DsStack } from '@/ds'

import { MATCH_NO_GROUP_MESSAGE, type LeafDraft } from '../../lib/studio/draft'

const props = defineProps<{
  testid: string
  disabled?: boolean
  errors?: Record<string, string>
  /** The group's bank, or null when the question has no group. */
  bank: { label: string; text: string }[] | null
}>()
const leaf = defineModel<LeafDraft>({ required: true })
const err = (k: string): string | undefined => props.errors?.[k]
</script>

<template>
  <DsStack gap="md" :data-testid="`${testid}-match`">
    <DsCallout v-if="bank === null" tone="warning" :data-testid="`${testid}-match-nogroup`">{{ MATCH_NO_GROUP_MESSAGE }}</DsCallout>
    <template v-else>
      <DsFormField v-slot="{ id }" native label="Jawapan betul" :for="`${testid}-bank-letter`" required :error="err('key.map')">
        <DsNativeSelect :id="id" v-model="leaf.bankLetter" placeholder="Pilih huruf bank" :disabled="disabled" :data-testid="`${testid}-bank-letter`">
          <option v-for="o in bank" :key="o.label" :value="o.label">{{ o.label }}. {{ o.text }}</option>
        </DsNativeSelect>
      </DsFormField>
      <UCheckbox v-model="leaf.bankUnique" label="Setiap huruf digunakan sekali" :disabled="disabled" :data-testid="`${testid}-bank-unique`" />
    </template>
  </DsStack>
</template>
