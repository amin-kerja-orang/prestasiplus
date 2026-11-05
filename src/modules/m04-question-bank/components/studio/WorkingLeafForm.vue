<script setup lang="ts">
/**
 * Answer editor of the `working` mode (PRD45 3.1.6 mode 5): marking points and `Jawapan akhir` as plain inputs. This is the
 * MINIMAL form of S2-T10 part B; the full scheme editor (groups, bonus, alternatives, ECF, live validation) is part C. A key that
 * is scheme v2 keeps every field this form does not show (the draft writes it back verbatim).
 */
import { DsCluster, DsFormField, DsGrid, DsNativeSelect, DsStack, DsText } from '@/ds'

import { blankFinal, nextPointId, POINT_CODES, type LeafDraft, type PointCode } from '../../lib/studio/draft'

const props = defineProps<{ testid: string; disabled?: boolean; errors?: Record<string, string> }>()
const leaf = defineModel<LeafDraft>({ required: true })
const err = (k: string): string | undefined => props.errors?.[k]

function addPoint(): void {
  leaf.value.points.push({ id: nextPointId(leaf.value.points), code: 'M', label: '', marks: 1, rest: {} })
}
function removePoint(i: number): void {
  leaf.value.points.splice(i, 1)
}
function clearFinal(): void {
  leaf.value.final = blankFinal()
}
</script>

<template>
  <DsStack gap="md" :data-testid="`${testid}-working`">
    <DsText variant="label">Titik pemarkahan</DsText>
    <DsStack v-for="(p, i) in leaf.points" :key="p.id" gap="sm" :data-testid="`${testid}-point-${i}`">
      <DsGrid :cols="{ base: 1, sm: 3 }" gap="md">
        <DsFormField v-slot="{ id }" native :label="`Kod titik ${String(i + 1)}`" :for="`${testid}-point-${i}-code`">
          <DsNativeSelect :id="id" :model-value="p.code" :disabled="disabled" :data-testid="`${testid}-point-${i}-code`" @update:model-value="p.code = $event as PointCode">
            <option v-for="c in POINT_CODES" :key="c" :value="c">{{ c }}</option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField v-slot="{ id }" native :label="`Penerangan titik ${String(i + 1)}`" :for="`${testid}-point-${i}-label`" :error="err(`key.points.${String(i)}`)">
          <UInput :id="id" v-model="p.label" maxlength="200" :disabled="disabled" :data-testid="`${testid}-point-${i}-label`" />
        </DsFormField>
        <DsFormField v-slot="{ id }" native :label="`Markah titik ${String(i + 1)}`" :for="`${testid}-point-${i}-marks`">
          <UInput :id="id" v-model.number="p.marks" type="number" min="0" step="1" :disabled="disabled" :data-testid="`${testid}-point-${i}-marks`" />
        </DsFormField>
      </DsGrid>
      <DsCluster gap="sm">
        <UButton type="button" color="error" variant="soft" :disabled="disabled" :data-testid="`${testid}-point-${i}-remove`" @click="removePoint(i)">
          Buang titik {{ i + 1 }}
        </UButton>
      </DsCluster>
    </DsStack>
    <DsCluster gap="sm">
      <UButton type="button" color="neutral" variant="soft" :disabled="disabled" :data-testid="`${testid}-add-point`" @click="addPoint">+ Titik pemarkahan</UButton>
    </DsCluster>

    <DsText variant="label">Jawapan akhir</DsText>
    <DsGrid :cols="{ base: 1, sm: 2 }" gap="md">
      <DsFormField v-slot="{ id }" native label="Jawapan akhir (paparan)" :for="`${testid}-final-display`">
        <UInput :id="id" v-model="leaf.final.display" :disabled="disabled" :data-testid="`${testid}-final-display`" />
      </DsFormField>
      <DsFormField v-slot="{ id }" native label="Jawapan akhir diterima" :for="`${testid}-final-accepted`" hint="Satu jawapan pada setiap baris.">
        <UTextarea :id="id" v-model="leaf.final.accepted" :rows="2" :disabled="disabled" :data-testid="`${testid}-final-accepted`" />
      </DsFormField>
      <DsFormField v-slot="{ id }" native label="Toleransi" :for="`${testid}-final-tolerance`">
        <UInput :id="id" v-model="leaf.final.tolerance" inputmode="decimal" :disabled="disabled" :data-testid="`${testid}-final-tolerance`" />
      </DsFormField>
      <DsFormField v-slot="{ id }" native label="Unit" :for="`${testid}-final-unit`">
        <UInput :id="id" v-model="leaf.final.unit" :disabled="disabled" :data-testid="`${testid}-final-unit`" />
      </DsFormField>
    </DsGrid>
    <DsCluster gap="sm">
      <UButton type="button" color="neutral" variant="soft" :disabled="disabled" :data-testid="`${testid}-final-clear`" @click="clearFinal">Kosongkan jawapan akhir</UButton>
    </DsCluster>
  </DsStack>
</template>
