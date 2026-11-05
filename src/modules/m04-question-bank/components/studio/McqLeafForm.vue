<script setup lang="ts">
/** Answer editor of the `mcq` mode: correct letter, options 3 to 8 with pictures (moved out of StudioLeafEditor, behaviour unchanged). */
import { DsCluster, DsFormField, DsNativeSelect, DsStack, DsText } from '@/ds'

import { addOption, MAX_OPTIONS, MIN_OPTIONS, removeOption, type LeafDraft } from '../../lib/studio/draft'
import StudioImageField from './StudioImageField.vue'

const props = defineProps<{ testid: string; disabled?: boolean; errors?: Record<string, string> }>()
const leaf = defineModel<LeafDraft>({ required: true })
const err = (k: string): string | undefined => props.errors?.[k]
</script>

<template>
  <DsStack gap="md" :data-testid="`${testid}-options`">
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
</template>
