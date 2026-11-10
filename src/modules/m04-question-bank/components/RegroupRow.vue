<script setup lang="ts">
/**
 * One row of the regroup work-list (PRD45 6.6.2): `Soalan` (first 120 characters), `Subjek`, `Tingkatan`, `Kertas sumber` and
 * number, `Sebab` and `Rujukan`, with the row actions `Bukan masalah` (API-Q-12), `Lampirkan rangsangan` (API-Q-24 with an existing
 * stimulus), `Muat naik gambar` (opens Audit Rajah, API-Q-21) and the checkbox that feeds `Kumpulkan` on the page.
 */
import { ref } from 'vue'

import { DsCluster, DsNativeSelect, DsStack, DsSurface, DsText } from '@/ds'

import { listStimuliToAttach, type StimulusPick } from '../api/questions'
import { DIAGRAMS_PATH } from '../lib/audit-routes'
import { regroupFlagLabel, regroupReference, regroupSource, type RegroupWorkRow } from '../lib/question-list'

const props = defineProps<{ row: RegroupWorkRow; selected?: boolean; busy?: boolean }>()
const emit = defineEmits<{ toggle: [id: string]; dismiss: [row: RegroupWorkRow]; attach: [row: RegroupWorkRow, stimulusId: string] }>()

const picking = ref(false)
const choices = ref<StimulusPick[]>([])
const choice = ref('')
const loadFailed = ref(false)

async function openPicker(): Promise<void> {
  picking.value = !picking.value
  if (!picking.value) return
  loadFailed.value = false
  choice.value = ''
  try {
    choices.value = (await listStimuliToAttach()).data.filter((s) => s.groupCount === 0)
  } catch {
    loadFailed.value = true
  }
}

function attach(): void {
  if (choice.value === '') return
  emit('attach', props.row, choice.value)
}
const pickable = (f: string): boolean => f === 'stimulus_missing' || f === 'figure_only'
</script>

<template>
  <DsSurface as="li" level="soft" padding="sm" shadow="none" :data-testid="`regroup-row-${row.questionId}`">
    <DsStack gap="xs">
      <DsCluster gap="sm">
        <UCheckbox
          :model-value="selected === true"
          :disabled="busy === true"
          :aria-label="`Pilih soalan ${row.questionId}`"
          :data-testid="`regroup-select-${row.questionId}`"
          @update:model-value="emit('toggle', row.questionId)"
        />
        <DsText variant="body" wrap="anywhere" data-testid="regroup-stem">{{ row.stemExcerpt }}</DsText>
      </DsCluster>
      <DsCluster gap="sm">
        <DsText variant="caption" tone="muted">{{ row.subject }}</DsText>
        <DsText variant="caption" tone="muted">{{ row.level }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="regroup-source">{{ regroupSource(row) }}</DsText>
        <DsText variant="caption" tone="warning" data-testid="regroup-flag">{{ regroupFlagLabel(row.flag) }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="regroup-reference">{{ regroupReference(row) }}</DsText>
      </DsCluster>
      <DsCluster gap="sm">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
         
          :disabled="busy === true"
          :data-testid="`regroup-dismiss-${row.questionId}`"
          @click="emit('dismiss', row)"
        >
          Bukan masalah
        </UButton>
        <template v-if="pickable(row.flag)">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
           
            :aria-expanded="picking"
            :disabled="busy === true"
            :data-testid="`regroup-attach-${row.questionId}`"
            @click="openPicker"
          >
            Lampirkan rangsangan
          </UButton>
          <UButton :to="DIAGRAMS_PATH" color="neutral" variant="soft" :data-testid="`regroup-upload-${row.questionId}`">Muat naik gambar</UButton>
        </template>
      </DsCluster>
      <DsCluster v-if="picking" gap="sm" :data-testid="`regroup-picker-${row.questionId}`">
        <DsText v-if="loadFailed" variant="caption" tone="error" role="alert" :data-testid="`regroup-picker-error-${row.questionId}`">Maaf, berlaku ralat. Sila cuba semula.</DsText>
        <template v-else>
          <DsNativeSelect
            :id="`regroup-pick-${row.questionId}`"
            v-model="choice"
            aria-label="Rangsangan"
            :data-testid="`regroup-pick-${row.questionId}`"
          >
            <option value="">Rangsangan</option>
            <option v-for="s in choices" :key="s.id" :value="s.id">#{{ s.id }} {{ s.label }}</option>
          </DsNativeSelect>
          <UButton type="button" :disabled="choice === '' || busy === true" :data-testid="`regroup-pick-go-${row.questionId}`" @click="attach">
            Lampirkan rangsangan
          </UButton>
        </template>
      </DsCluster>
    </DsStack>
  </DsSurface>
</template>
