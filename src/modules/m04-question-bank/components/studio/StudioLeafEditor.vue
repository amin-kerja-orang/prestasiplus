<script setup lang="ts">
/**
 * One sub-bahagian (leaf part) of the Studio wizard, Langkah 3: `Label`, `Jenis jawapan`, `Markah`, `Arahan sub-bahagian`,
 * the answer editor of its mode, and the DSKP tags of THIS leaf: `TP` and `Aras pemikiran` (ADR-0031, R1-F03b). The four
 * KBAT levels show a `KBAT` badge. A thin host: the answer editor of each mode is its own `*LeafForm.vue`.
 */
import { computed } from 'vue'

import { DsBadge, DsCluster, DsFormField, DsGrid, DsNativeSelect, DsStack, DsSurface } from '@/ds'

import {
  EXAMPLE_ANSWER_MAX,
  EXAMPLE_ANSWER_MESSAGE,
  type LeafGroup,
  LEAF_MODES,
  withMode,
  type LeafDraft,
  type LeafMode,
} from '../../lib/studio/draft'
import { COGNITIVE_OPTIONS, isCognitive, isKbat, TP_VALUES } from '../../lib/studio/dskp-tags'
import EssayChoiceLeafForm from './EssayChoiceLeafForm.vue'
import EssayLeafForm from './EssayLeafForm.vue'
import MatchLeafForm from './MatchLeafForm.vue'
import McqLeafForm from './McqLeafForm.vue'
import NumericLeafForm from './NumericLeafForm.vue'
import ShortTextLeafForm from './ShortTextLeafForm.vue'
import StudioRichTextField from './StudioRichTextField.vue'
import WorkingLeafForm from './WorkingLeafForm.vue'

const props = defineProps<{ testid: string; canRemove: boolean; disabled?: boolean; errors?: Record<string, string>; group?: LeafGroup | null }>()
const leaf = defineModel<LeafDraft>({ required: true })
const emit = defineEmits<{ remove: [] }>()

function setMode(value: string): void {
  leaf.value = withMode(leaf.value, value as LeafMode)
}
function setTp(value: string): void {
  leaf.value.tp = value === '' ? null : Number(value)
}
function setCognitive(value: string): void {
  leaf.value.cognitive = isCognitive(value) ? value : null
}
const err = (k: string): string | undefined => props.errors?.[k]

/** L-13 `Contoh (tidak dimarkah)`: ticking makes the leaf worth 0 marks; unticking gives back 1. */
function setExample(on: boolean): void {
  leaf.value.exampleAnswer = on ? '' : null
  if (on) leaf.value.marks = 0
  else if (leaf.value.marks === 0) leaf.value.marks = 1
}
const isExample = computed(() => leaf.value.exampleAnswer !== null)
/** `Jawapan contoh` is the option label of an mcq leaf, the bank letter of a match leaf, otherwise free text. */
const exampleChoices = computed<string[] | null>(() =>
  leaf.value.mode === 'mcq' ? leaf.value.options.map((o) => o.label) : leaf.value.mode === 'match_letter' ? (props.group?.bank.map((o) => o.label) ?? []) : null,
)
const exampleError = computed(() => (isExample.value && (leaf.value.exampleAnswer ?? '').trim() === '' ? EXAMPLE_ANSWER_MESSAGE : undefined))
</script>

<template>
  <DsSurface level="soft" padding="md" shadow="none" :data-testid="testid">
    <DsStack gap="md">
      <DsGrid :cols="{ base: 1, sm: 3 }" gap="md">
        <DsFormField v-slot="{ id }" native label="Label" :for="`${testid}-label`" required>
          <UInput :id="id" v-model="leaf.label" maxlength="10" placeholder="a" :disabled="disabled" :data-testid="`${testid}-label`" />
        </DsFormField>
        <DsFormField v-slot="{ id }" native label="Jenis jawapan" :for="`${testid}-mode`">
          <DsNativeSelect :id="id" :model-value="leaf.mode" :disabled="disabled" :data-testid="`${testid}-mode`" @update:model-value="setMode(String($event))">
            <option v-for="m in LEAF_MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField v-slot="{ id }" native label="Markah" :for="`${testid}-marks`" required>
          <UInput :id="id" v-model.number="leaf.marks" type="number" min="0" step="1" :disabled="disabled || isExample" :data-testid="`${testid}-marks`" />
        </DsFormField>
      </DsGrid>

      <DsFormField v-slot="{ id }" native label="Arahan sub-bahagian" :for="`${testid}-prompt`" required :error="err('prompt')">
        <StudioRichTextField :id="id" v-model="leaf.prompt" :rows="3" :disabled="disabled" :testid="`${testid}-prompt`" />
      </DsFormField>

      <UCheckbox :model-value="isExample" label="Contoh (tidak dimarkah)" :disabled="disabled" :data-testid="`${testid}-example`" @update:model-value="setExample($event === true)" />
      <DsFormField v-if="isExample" v-slot="{ id }" native label="Jawapan contoh" :for="`${testid}-example-answer`" required :error="exampleError ?? err('modeConfig.example.answer')">
        <DsNativeSelect v-if="exampleChoices !== null" :id="id" :model-value="leaf.exampleAnswer ?? ''" placeholder="Pilih jawapan contoh" :disabled="disabled" :data-testid="`${testid}-example-answer`" @update:model-value="leaf.exampleAnswer = String($event)">
          <option v-for="c in exampleChoices" :key="c" :value="c">{{ c }}</option>
        </DsNativeSelect>
        <UInput v-else :id="id" :model-value="leaf.exampleAnswer ?? ''" :maxlength="EXAMPLE_ANSWER_MAX" :disabled="disabled" :data-testid="`${testid}-example-answer`" @update:model-value="leaf.exampleAnswer = String($event)" />
      </DsFormField>

      <McqLeafForm v-if="leaf.mode === 'mcq'" v-model="leaf" :testid="testid" :disabled="disabled" :errors="errors" />
      <MatchLeafForm v-else-if="leaf.mode === 'match_letter'" v-model="leaf" :testid="testid" :disabled="disabled" :errors="errors" :bank="group?.bank ?? null" />
      <ShortTextLeafForm v-else-if="leaf.mode === 'short_text'" v-model="leaf" :testid="testid" :disabled="disabled" />
      <NumericLeafForm v-else-if="leaf.mode === 'numeric'" v-model="leaf" :testid="testid" :disabled="disabled" />
      <WorkingLeafForm v-else-if="leaf.mode === 'working'" v-model="leaf" :testid="testid" :disabled="disabled" :errors="errors" />
      <EssayLeafForm v-else-if="leaf.mode === 'essay'" v-model="leaf" :testid="testid" :disabled="disabled" :errors="errors" />
      <EssayChoiceLeafForm v-else v-model="leaf" :testid="testid" :disabled="disabled" :errors="errors" :stimuli="group?.stimuli ?? []" />

      <!-- DSKP tags of this leaf -->
      <DsGrid :cols="{ base: 1, sm: 2 }" gap="md" :data-testid="`${testid}-dskp`">
        <DsFormField v-slot="{ id }" native label="TP" :for="`${testid}-tp`">
          <DsNativeSelect :id="id" :model-value="leaf.tp === null ? '' : String(leaf.tp)" placeholder="Pilih TP" :disabled="disabled" :data-testid="`${testid}-tp`" @update:model-value="setTp(String($event))">
            <option v-for="n in TP_VALUES" :key="n" :value="String(n)">TP {{ n }}</option>
          </DsNativeSelect>
        </DsFormField>
        <DsStack gap="sm">
          <DsFormField v-slot="{ id }" native label="Aras pemikiran" :for="`${testid}-cognitive`">
            <DsNativeSelect :id="id" :model-value="leaf.cognitive ?? ''" placeholder="Pilih aras" :disabled="disabled" :data-testid="`${testid}-cognitive`" @update:model-value="setCognitive(String($event))">
              <option v-for="c in COGNITIVE_OPTIONS" :key="c.value" :value="c.value">{{ c.label }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsBadge v-if="isKbat(leaf.cognitive)" tone="info" icon="lightbulb" label="KBAT" :data-testid="`${testid}-kbat`" />
        </DsStack>
      </DsGrid>

      <DsCluster v-if="canRemove" gap="sm">
        <UButton type="button" color="error" variant="soft" :disabled="disabled" :data-testid="`${testid}-remove`" @click="emit('remove')">
          Buang
        </UButton>
      </DsCluster>
    </DsStack>
  </DsSurface>
</template>
