<script setup lang="ts">
/**
 * One stimulus of a group (V2 Langkah 2 "Rangsangan (stimulus)"): `Jenis rangsangan`, `Kapsyen (pilihan)`, the text, the
 * picture with its alt text, and the source. A figure is stored once and shown once with all its questions (D90).
 */
import { DsFormField, DsGrid, DsNativeSelect, DsStack } from '@/ds'

import { STIMULUS_KINDS, type StimulusForm } from '../../lib/studio/stimulus'
import StudioImageField from './StudioImageField.vue'

defineProps<{ testid: string; disabled?: boolean; error?: string | undefined }>()
const form = defineModel<StimulusForm>({ required: true })
</script>

<template>
  <DsStack gap="md" :data-testid="testid">
    <DsGrid :cols="{ base: 1, sm: 2 }" gap="md">
      <DsFormField v-slot="{ id }" native label="Jenis rangsangan" :for="`${testid}-kind`">
        <DsNativeSelect :id="id" v-model="form.kind" :disabled="disabled" :data-testid="`${testid}-kind`">
          <option v-for="k in STIMULUS_KINDS" :key="k.value" :value="k.value">{{ k.label }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-slot="{ id }" native label="Label" :for="`${testid}-label`" hint="Contoh: Rajah 1">
        <UInput :id="id" v-model="form.label" :disabled="disabled" maxlength="100" :data-testid="`${testid}-label`" />
      </DsFormField>
    </DsGrid>
    <DsFormField v-slot="{ id }" native label="Kapsyen (pilihan)" :for="`${testid}-caption`">
      <UInput :id="id" v-model="form.caption" :disabled="disabled" maxlength="300" :data-testid="`${testid}-caption`" />
    </DsFormField>
    <DsFormField v-slot="{ id }" native label="Teks rangsangan" :for="`${testid}-body`" :error="error">
      <UTextarea :id="id" v-model="form.body" :disabled="disabled" :rows="5" :data-testid="`${testid}-body`" />
    </DsFormField>
    <DsFormField label="Gambar (pilihan)">
      <StudioImageField v-model="form.imageToken" :testid="`${testid}-image`" :disabled="disabled" />
    </DsFormField>
    <DsFormField v-slot="{ id }" native label="Penerangan gambar (teks alternatif)" :for="`${testid}-alt`">
      <UInput :id="id" v-model="form.alt" :disabled="disabled" maxlength="1000" :data-testid="`${testid}-alt`" />
    </DsFormField>
    <DsFormField v-slot="{ id }" native label="Sumber (pilihan)" :for="`${testid}-source`">
      <UInput :id="id" v-model="form.sourceCitation" :disabled="disabled" maxlength="300" :data-testid="`${testid}-source`" />
    </DsFormField>
  </DsStack>
</template>
