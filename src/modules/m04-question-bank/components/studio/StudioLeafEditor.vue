<script setup lang="ts">
/**
 * One sub-bahagian (leaf part) of the Studio wizard, Langkah 3: `Label`, `Jenis jawapan`, `Markah`, `Arahan sub-bahagian`,
 * the answer editor of its mode, and the DSKP tags of THIS leaf: `TP` and `Aras pemikiran` (ADR-0031, R1-F03b). The four
 * KBAT levels show a `KBAT` badge. Pictures of options are uploaded through the files module.
 */
import { DsBadge, DsCluster, DsFormField, DsGrid, DsNativeSelect, DsStack, DsSurface, DsText } from '@/ds'

import {
  addOption,
  LEAF_MODES,
  MAX_OPTIONS,
  MIN_OPTIONS,
  removeOption,
  withMode,
  type LeafDraft,
  type LeafMode,
} from '../../lib/studio/draft'
import { COGNITIVE_OPTIONS, isCognitive, isKbat, TP_VALUES } from '../../lib/studio/dskp-tags'
import StudioImageField from './StudioImageField.vue'

const props = defineProps<{ testid: string; canRemove: boolean; disabled?: boolean; errors?: Record<string, string> }>()
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

      <DsFormField v-slot="{ id }" native label="Arahan sub-bahagian" :for="`${testid}-prompt`" required :error="err('prompt')">
        <UTextarea :id="id" v-model="leaf.prompt" :rows="3" :disabled="disabled" :data-testid="`${testid}-prompt`" />
      </DsFormField>

      <!-- MCQ -->
      <DsStack v-if="leaf.mode === 'mcq'" gap="md" :data-testid="`${testid}-options`">
        <DsFormField v-slot="{ id }" native label="Jawapan betul" :for="`${testid}-correct`" required>
          <DsNativeSelect :id="id" v-model="leaf.correct" placeholder="Pilih jawapan betul" :disabled="disabled" :data-testid="`${testid}-correct`">
            <option v-for="o in leaf.options" :key="o.label" :value="o.label">{{ o.label }}</option>
          </DsNativeSelect>
        </DsFormField>
        <DsStack v-for="(o, i) in leaf.options" :key="o.label" gap="sm" :data-testid="`${testid}-option-${o.label}`">
          <DsFormField v-slot="{ id }" native :label="`Teks pilihan ${o.label}`" :for="`${testid}-text-${o.label}`" :error="err(`options.${String(i)}`)">
            <UInput :id="id" v-model="o.text" :disabled="disabled" :data-testid="`${testid}-text-${o.label}`" />
          </DsFormField>
          <StudioImageField v-model="o.imageToken" :testid="`${testid}-option-image-${o.label}`" :label="`Gambar pilihan ${o.label}`" :disabled="disabled" />
          <DsText v-if="err(`optionImages.${String(i)}`)" variant="caption" tone="error" role="alert">{{ err(`optionImages.${String(i)}`) }}</DsText>
          <DsCluster v-if="leaf.options.length > MIN_OPTIONS" gap="sm">
            <UButton type="button" color="error" variant="soft" :disabled="disabled" :data-testid="`${testid}-option-${o.label}-remove`" @click="leaf = removeOption(leaf, i)">
              Buang pilihan {{ o.label }}
            </UButton>
          </DsCluster>
        </DsStack>
        <DsCluster v-if="leaf.options.length < MAX_OPTIONS" gap="sm">
          <UButton type="button" color="neutral" variant="soft" :disabled="disabled" :data-testid="`${testid}-add-option`" @click="leaf = addOption(leaf)">
            + Pilihan
          </UButton>
        </DsCluster>
      </DsStack>

      <!-- Short text -->
      <DsFormField v-else-if="leaf.mode === 'short_text'" v-slot="{ id }" native label="Jawapan diterima" :for="`${testid}-accepted`" hint="Satu jawapan pada setiap baris.">
        <UTextarea :id="id" v-model="leaf.accepted" :rows="3" :disabled="disabled" :data-testid="`${testid}-accepted`" />
      </DsFormField>

      <!-- Numeric -->
      <DsGrid v-else :cols="{ base: 1, sm: 3 }" gap="md">
        <DsFormField v-slot="{ id }" native label="Jawapan" :for="`${testid}-value`" required>
          <UInput :id="id" v-model="leaf.numeric.value" inputmode="decimal" :disabled="disabled" :data-testid="`${testid}-value`" />
        </DsFormField>
        <DsFormField v-slot="{ id }" native label="Toleransi" :for="`${testid}-tolerance`">
          <UInput :id="id" v-model="leaf.numeric.tolerance" inputmode="decimal" placeholder="0.01" :disabled="disabled" :data-testid="`${testid}-tolerance`" />
        </DsFormField>
        <DsFormField v-slot="{ id }" native label="Unit" :for="`${testid}-unit`">
          <UInput :id="id" v-model="leaf.numeric.unit" :disabled="disabled" :data-testid="`${testid}-unit`" />
        </DsFormField>
      </DsGrid>

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
