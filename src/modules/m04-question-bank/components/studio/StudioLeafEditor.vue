<script setup lang="ts">
/**
 * One sub-bahagian (leaf part) of the Studio wizard, Langkah 3: `Label`, `Jenis jawapan`, `Markah`, `Arahan sub-bahagian`,
 * the answer editor of its mode, and the DSKP tags of THIS leaf: `TP` and `Aras pemikiran` (ADR-0031, R1-F03b). The four
 * KBAT levels show a `KBAT` badge. A thin host: the answer editor of each mode is its own `*LeafForm.vue`.
 */
import { DsBadge, DsCluster, DsFormField, DsGrid, DsNativeSelect, DsStack, DsSurface, DsText } from '@/ds'

import {
  isSchemeMode,
  LEAF_MODES,
  withMode,
  type LeafDraft,
  type LeafMode,
} from '../../lib/studio/draft'
import { COGNITIVE_OPTIONS, isCognitive, isKbat, TP_VALUES } from '../../lib/studio/dskp-tags'
import EssayLeafForm from './EssayLeafForm.vue'
import McqLeafForm from './McqLeafForm.vue'
import NumericLeafForm from './NumericLeafForm.vue'
import ShortTextLeafForm from './ShortTextLeafForm.vue'
import StudioRichTextField from './StudioRichTextField.vue'

const props = defineProps<{ testid: string; canRemove: boolean; branchFirst?: boolean; disabled?: boolean; errors?: Record<string, string> }>()
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
</script>

<template>
  <DsSurface level="soft" padding="md" shadow="none" :data-testid="testid">
    <DsStack gap="md">
      <DsText v-if="leaf.group !== undefined" variant="caption" tone="muted" :data-testid="`${testid}-branch`">
        Sub-bahagian bagi bahagian ({{ typeof leaf.group.raw.label === 'string' ? leaf.group.raw.label : '' }}).
      </DsText>
      <DsFormField v-if="leaf.group !== undefined && branchFirst === true" v-slot="{ id }" native :label="`Teks bahagian (${typeof leaf.group.raw.label === 'string' ? leaf.group.raw.label : ''})`" :for="`${testid}-branch-prompt`">
        <UTextarea :id="id" v-model="leaf.group.prompt" :rows="3" :disabled="disabled" :data-testid="`${testid}-branch-prompt`" />
      </DsFormField>
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
          <UInput :id="id" v-model.number="leaf.marks" type="number" min="0" step="1" :disabled="disabled" :data-testid="`${testid}-marks`" />
        </DsFormField>
      </DsGrid>

      <DsFormField v-slot="{ id }" native label="Arahan sub-bahagian" :for="`${testid}-prompt`" :error="err('prompt')">
        <StudioRichTextField :id="id" v-model="leaf.prompt" :rows="3" :disabled="disabled" :testid="`${testid}-prompt`" />
      </DsFormField>

      <McqLeafForm v-if="leaf.mode === 'mcq'" v-model="leaf" :testid="testid" :disabled="disabled" :errors="errors" />
      <EssayLeafForm v-else-if="isSchemeMode(leaf.mode)" v-model="leaf" :testid="testid" :disabled="disabled" />
      <ShortTextLeafForm v-else-if="leaf.mode === 'short_text'" v-model="leaf" :testid="testid" :disabled="disabled" />
      <NumericLeafForm v-else v-model="leaf" :testid="testid" :disabled="disabled" />

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
