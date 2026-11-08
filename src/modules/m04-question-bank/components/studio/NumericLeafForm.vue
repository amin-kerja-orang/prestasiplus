<script setup lang="ts">
/** Answer editor of the `numeric` mode: value, tolerance, unit (moved out of StudioLeafEditor, behaviour unchanged). */
import { DsFormField, DsGrid } from '@/ds'

import type { LeafDraft } from '../../lib/studio/draft'

defineProps<{ testid: string; disabled?: boolean }>()
const leaf = defineModel<LeafDraft>({ required: true })
</script>

<template>
  <DsGrid :cols="{ base: 1, sm: 3 }" gap="md">
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
</template>
