<script setup lang="ts">
/**
 * Answer editor of the `essay` mode (PRD45 3.1.6 mode 6, FR-QA-21): `Bilangan patah perkataan` min and max (0 to 5000,
 * min <= max), `Had keras`, `Ruang jawapan`. Stored in `modeConfig`. The rubric is edited by the scheme editor (S2-T10 part C);
 * a stored rubric is kept as it is.
 */
import { computed } from 'vue'

import { DsFormField, DsGrid, DsNativeSelect, DsStack, DsText } from '@/ds'

import { ANSWER_SPACES, wordRangeOf, WORD_RANGE_MESSAGE, type AnswerSpace, type LeafDraft } from '../../lib/studio/draft'

const props = defineProps<{ testid: string; disabled?: boolean; errors?: Record<string, string> }>()
const leaf = defineModel<LeafDraft>({ required: true })
const rangeError = computed(() => (wordRangeOf(leaf.value) === 'invalid' ? WORD_RANGE_MESSAGE : (props.errors?.['modeConfig.wordRange'] ?? undefined)))
const setSpace = (v: string): void => {
  leaf.value.answerSpace = v === '' ? '' : (v as AnswerSpace)
}
</script>

<template>
  <DsStack gap="md" :data-testid="`${testid}-essay`">
    <DsGrid :cols="{ base: 1, sm: 2 }" gap="md">
      <DsFormField v-slot="{ id }" native label="Patah perkataan minimum" :for="`${testid}-words-min`" :error="rangeError">
        <UInput :id="id" v-model="leaf.words.min" inputmode="numeric" placeholder="0" :disabled="disabled" :data-testid="`${testid}-words-min`" />
      </DsFormField>
      <DsFormField v-slot="{ id }" native label="Patah perkataan maksimum" :for="`${testid}-words-max`">
        <UInput :id="id" v-model="leaf.words.max" inputmode="numeric" placeholder="5000" :disabled="disabled" :data-testid="`${testid}-words-max`" />
      </DsFormField>
    </DsGrid>
    <UCheckbox v-model="leaf.hardLimit" label="Had keras" :disabled="disabled" :data-testid="`${testid}-hard-limit`" />
    <DsFormField v-slot="{ id }" native label="Ruang jawapan" :for="`${testid}-answer-space`">
      <DsNativeSelect :id="id" :model-value="leaf.answerSpace" placeholder="Pilih ruang jawapan" :disabled="disabled" :data-testid="`${testid}-answer-space`" @update:model-value="setSpace(String($event))">
        <option v-for="s in ANSWER_SPACES" :key="s.value" :value="s.value">{{ s.label }}</option>
      </DsNativeSelect>
    </DsFormField>
    <DsText variant="caption" tone="muted" :data-testid="`${testid}-scheme-note`">
      {{ leaf.keyBase === null ? 'Rubrik belum ditetapkan.' : 'Rubrik tersimpan dikekalkan.' }}
    </DsText>
  </DsStack>
</template>
