<script setup lang="ts">
/**
 * Answer editor of the `mcq` mode: options 2 to 8 with pictures and the correct letter, plus the extras of PRD45 3.1.6 mode 1:
 * `Betul / Salah` (two fixed rows), `Pelbagai jawapan` (`modeConfig.multi`, key `options`), `Terima pilihan lain` (extra accepted
 * labels and `Nota kunci`, key `accepted` / `note`).
 */
import { ref } from 'vue'

import { DsCluster, DsFormField, DsNativeSelect, DsStack, DsText } from '@/ds'

import { addOption, isTrueFalse, MAX_OPTIONS, MIN_OPTIONS, removeOption, setMulti, setTrueFalse, type LeafDraft } from '../../lib/studio/draft'
import StudioImageField from './StudioImageField.vue'

const props = defineProps<{ testid: string; disabled?: boolean; errors?: Record<string, string> }>()
const leaf = defineModel<LeafDraft>({ required: true })
const err = (k: string): string | undefined => props.errors?.[k]

const acceptOpen = ref(leaf.value.acceptedOptions.length > 0 || leaf.value.keyNote !== '')
function setAccept(on: boolean): void {
  acceptOpen.value = on
  if (!on) {
    leaf.value.acceptedOptions = []
    leaf.value.keyNote = ''
  }
}
function toggle(list: string[], label: string): string[] {
  return list.includes(label) ? list.filter((l) => l !== label) : [...list, label]
}
</script>

<template>
  <DsStack gap="md" :data-testid="`${testid}-options`">
    <DsCluster gap="md">
      <UCheckbox :model-value="isTrueFalse(leaf)" label="Betul / Salah" :disabled="disabled || leaf.multi" :data-testid="`${testid}-true-false`" @update:model-value="leaf = setTrueFalse(leaf, $event === true)" />
      <UCheckbox :model-value="leaf.multi" label="Pelbagai jawapan" :disabled="disabled || isTrueFalse(leaf)" :data-testid="`${testid}-multi`" @update:model-value="leaf = setMulti(leaf, $event === true)" />
    </DsCluster>

    <DsStack v-if="leaf.multi" gap="xs" role="group" aria-label="Jawapan betul" :data-testid="`${testid}-correct-multi`">
      <DsText variant="label">Jawapan betul</DsText>
      <UCheckbox
        v-for="o in leaf.options"
        :key="o.label"
        :model-value="leaf.correctMulti.includes(o.label)"
        :label="o.label"
        :disabled="disabled"
        :data-testid="`${testid}-correct-${o.label}`"
        @update:model-value="leaf.correctMulti = toggle(leaf.correctMulti, o.label)"
      />
    </DsStack>
    <DsFormField v-else v-slot="{ id }" native label="Jawapan betul" :for="`${testid}-correct`" required>
      <DsNativeSelect :id="id" v-model="leaf.correct" placeholder="Pilih jawapan betul" :disabled="disabled" :data-testid="`${testid}-correct`">
        <option v-for="o in leaf.options" :key="o.label" :value="o.label">{{ o.label }}</option>
      </DsNativeSelect>
    </DsFormField>

    <DsStack v-for="(o, i) in leaf.options" :key="o.label" gap="sm" :data-testid="`${testid}-option-${o.label}`">
      <DsFormField v-slot="{ id }" native :label="`Teks pilihan ${o.label}`" :for="`${testid}-text-${o.label}`" :error="err(`options.${String(i)}`)">
        <UInput :id="id" v-model="o.text" :disabled="disabled || isTrueFalse(leaf)" :data-testid="`${testid}-text-${o.label}`" />
      </DsFormField>
      <template v-if="!isTrueFalse(leaf)">
        <StudioImageField v-model="o.imageToken" :testid="`${testid}-option-image-${o.label}`" :label="`Gambar pilihan ${o.label}`" :disabled="disabled" />
        <DsText v-if="err(`optionImages.${String(i)}`)" variant="caption" tone="error" role="alert">{{ err(`optionImages.${String(i)}`) }}</DsText>
        <DsCluster v-if="leaf.options.length > MIN_OPTIONS" gap="sm">
          <UButton type="button" color="error" variant="soft" :disabled="disabled" :data-testid="`${testid}-option-${o.label}-remove`" @click="leaf = removeOption(leaf, i)">
            Buang pilihan {{ o.label }}
          </UButton>
        </DsCluster>
      </template>
    </DsStack>
    <DsCluster v-if="leaf.options.length < MAX_OPTIONS && !isTrueFalse(leaf)" gap="sm">
      <UButton type="button" color="neutral" variant="soft" :disabled="disabled" :data-testid="`${testid}-add-option`" @click="leaf = addOption(leaf)">
        + Pilihan
      </UButton>
    </DsCluster>

    <UCheckbox v-if="!leaf.multi" :model-value="acceptOpen" label="Terima pilihan lain" :disabled="disabled" :data-testid="`${testid}-accept-other`" @update:model-value="setAccept($event === true)" />
    <DsStack v-if="acceptOpen && !leaf.multi" gap="xs" role="group" aria-label="Pilihan lain diterima" :data-testid="`${testid}-accepted-options`">
      <UCheckbox
        v-for="o in leaf.options"
        :key="o.label"
        :model-value="leaf.acceptedOptions.includes(o.label)"
        :label="`Terima pilihan ${o.label}`"
        :disabled="disabled"
        :data-testid="`${testid}-accepted-${o.label}`"
        @update:model-value="leaf.acceptedOptions = toggle(leaf.acceptedOptions, o.label)"
      />
    </DsStack>
    <DsFormField v-if="acceptOpen || leaf.multi" v-slot="{ id }" native label="Nota kunci" :for="`${testid}-key-note`">
      <UInput :id="id" v-model="leaf.keyNote" maxlength="500" :disabled="disabled" :data-testid="`${testid}-key-note`" />
    </DsFormField>
  </DsStack>
</template>
