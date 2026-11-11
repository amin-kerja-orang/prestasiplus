<script setup lang="ts">
/**
 * Answer editor of the `essay` mode (V2 structured sub-question and essay): the `Skema` text and the marking points, each with its
 * marks. A point that already exists keeps everything the form does not show; see `essayToPart` in lib/studio/draft.ts (KP-14).
 */
import { DsCluster, DsFormField, DsStack, DsText } from '@/ds'

import { newUid, type LeafDraft } from '../../lib/studio/draft'

defineProps<{ testid: string; disabled?: boolean }>()
const leaf = defineModel<LeafDraft>({ required: true })

function addPoint(): void {
  leaf.value.essay.points.push({ uid: newUid(), id: '', text: '', marks: 1 })
}
function removePoint(uid: string): void {
  leaf.value.essay.points = leaf.value.essay.points.filter((p) => p.uid !== uid)
}
const total = (): number => leaf.value.essay.points.reduce((n, p) => n + (Number.isFinite(p.marks) ? p.marks : 0), 0)
</script>

<template>
  <DsStack gap="md" :data-testid="`${testid}-essay`">
    <DsFormField v-slot="{ id }" native label="Skema jawapan" :for="`${testid}-model`" hint="Jawapan model yang ditunjukkan kepada pelajar selepas menjawab.">
      <UTextarea :id="id" v-model="leaf.essay.modelText" :rows="3" :disabled="disabled" :data-testid="`${testid}-model`" />
    </DsFormField>
    <DsStack gap="sm">
      <DsText variant="label">Poin pemarkahan</DsText>
      <DsCluster v-for="(pt, i) in leaf.essay.points" :key="pt.uid" gap="sm" align="start" :data-testid="`${testid}-point-${String(i)}`">
        <UTextarea v-model="pt.text" :rows="2" class="min-w-0 flex-1" :aria-label="`Poin ${String(i + 1)}`" :disabled="disabled" :data-testid="`${testid}-point-${String(i)}-text`" />
        <UInput v-model.number="pt.marks" type="number" min="0" step="1" class="w-24" :aria-label="`Markah poin ${String(i + 1)}`" :disabled="disabled" :data-testid="`${testid}-point-${String(i)}-marks`" />
        <UButton type="button" color="error" variant="soft" class="min-h-11" :disabled="disabled || leaf.essay.points.length <= 1" :data-testid="`${testid}-point-${String(i)}-remove`" @click="removePoint(pt.uid)">
          Buang
        </UButton>
      </DsCluster>
      <DsCluster gap="sm" align="center">
        <UButton type="button" color="neutral" variant="soft" class="min-h-11" :disabled="disabled" :data-testid="`${testid}-point-add`" @click="addPoint">+ Poin</UButton>
        <DsText as="span" variant="caption" tone="muted" :data-testid="`${testid}-points-total`">Jumlah markah poin: {{ total() }}</DsText>
      </DsCluster>
    </DsStack>
  </DsStack>
</template>
