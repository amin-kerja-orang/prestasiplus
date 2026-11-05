<script setup lang="ts">
/**
 * Answer editor of the `essay_choice` mode (PRD45 3.1.6 mode 7, FR-QA-22, FR-ADM-QE3.12): everything of the `essay` mode plus
 * 2 to 6 `Gesaan alternatif`: `Tajuk` (the contract's `topics[].label`), `Teks gesaan` and `Rangsangan gesaan` (one stimulus of
 * the group; `modeConfig.alternatives[]`). The rubric or points are shared by all alternatives.
 */
import { DsCluster, DsFormField, DsNativeSelect, DsStack, DsText } from '@/ds'

import { ESSAY_CHOICE_MESSAGE, MAX_ALTERNATIVES, MIN_ALTERNATIVES, type LeafDraft } from '../../lib/studio/draft'
import EssayLeafForm from './EssayLeafForm.vue'
import StudioRichTextField from './StudioRichTextField.vue'

const props = defineProps<{
  testid: string
  disabled?: boolean
  errors?: Record<string, string>
  /** The stimuli of the group (`Rangsangan gesaan`); empty without a group. */
  stimuli: { id: string; label: string }[]
}>()
const leaf = defineModel<LeafDraft>({ required: true })
const err = (k: string): string | undefined => props.errors?.[k]

function nextId(): string {
  let n = leaf.value.alternatives.length + 1
  while (leaf.value.alternatives.some((a) => a.id === `t${String(n)}`)) n += 1
  return `t${String(n)}`
}
function add(): void {
  leaf.value.alternatives.push({ id: nextId(), title: '', prompt: '', promptEn: null, stimulusId: null })
}
function remove(i: number): void {
  leaf.value.alternatives.splice(i, 1)
}
</script>

<template>
  <DsStack gap="md" :data-testid="`${testid}-essay-choice`">
    <EssayLeafForm v-model="leaf" :testid="testid" :disabled="disabled" :errors="errors" />
    <DsText variant="label">Gesaan alternatif</DsText>
    <DsText v-if="err('topics') ?? err('modeConfig.alternatives')" variant="caption" tone="error" role="alert">{{ err('topics') ?? err('modeConfig.alternatives') }}</DsText>
    <DsStack v-for="(a, i) in leaf.alternatives" :key="a.id" gap="sm" :data-testid="`${testid}-alt-${i}`">
      <DsFormField v-slot="{ id }" native :label="`Tajuk gesaan ${String(i + 1)}`" :for="`${testid}-alt-${i}-title`" required>
        <UInput :id="id" v-model="a.title" maxlength="200" :disabled="disabled" :data-testid="`${testid}-alt-${i}-title`" />
      </DsFormField>
      <DsFormField v-slot="{ id }" native :label="`Teks gesaan ${String(i + 1)}`" :for="`${testid}-alt-${i}-prompt`">
        <StudioRichTextField :id="id" v-model="a.prompt" :rows="3" :disabled="disabled" :testid="`${testid}-alt-${i}-prompt`" />
      </DsFormField>
      <DsFormField v-if="stimuli.length > 0" v-slot="{ id }" native :label="`Rangsangan gesaan ${String(i + 1)}`" :for="`${testid}-alt-${i}-stimulus`">
        <DsNativeSelect :id="id" :model-value="a.stimulusId ?? ''" placeholder="Tiada rangsangan" :disabled="disabled" :data-testid="`${testid}-alt-${i}-stimulus`" @update:model-value="a.stimulusId = String($event) === '' ? null : String($event)">
          <option v-for="s in stimuli" :key="s.id" :value="s.id">{{ s.label }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsCluster v-if="leaf.alternatives.length > MIN_ALTERNATIVES" gap="sm">
        <UButton type="button" color="error" variant="soft" :disabled="disabled" :data-testid="`${testid}-alt-${i}-remove`" @click="remove(i)">
          Buang gesaan {{ i + 1 }}
        </UButton>
      </DsCluster>
    </DsStack>
    <DsText v-if="leaf.alternatives.length < MIN_ALTERNATIVES || leaf.alternatives.length > MAX_ALTERNATIVES" variant="caption" tone="error" role="alert" :data-testid="`${testid}-alt-count`">
      {{ ESSAY_CHOICE_MESSAGE }}
    </DsText>
    <DsCluster v-if="leaf.alternatives.length < MAX_ALTERNATIVES" gap="sm">
      <UButton type="button" color="neutral" variant="soft" :disabled="disabled" :data-testid="`${testid}-add-alt`" @click="add">+ Gesaan alternatif</UButton>
    </DsCluster>
  </DsStack>
</template>
