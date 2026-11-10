<script setup lang="ts">
/** Answer editor of the `short_text` mode: accepted answers, one per line (moved out of StudioLeafEditor, behaviour unchanged). */
import { DsFormField } from '@/ds'

import type { LeafDraft } from '../../lib/studio/draft'

defineProps<{ testid: string; disabled?: boolean }>()
const leaf = defineModel<LeafDraft>({ required: true })
</script>

<template>
  <DsFormField v-slot="{ id }" native label="Jawapan diterima" :for="`${testid}-accepted`" hint="Satu jawapan pada setiap baris.">
    <UTextarea :id="id" v-model="leaf.accepted" :rows="3" :disabled="disabled" :data-testid="`${testid}-accepted`" />
  </DsFormField>
</template>
