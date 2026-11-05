<script setup lang="ts">
/**
 * One row of the regroup work-list (PRD45 6.6.2): `Soalan` (first 120 characters), `Subjek`, `Tingkatan`, `Kertas sumber` and
 * number, `Sebab` and `Rujukan`, with the row actions `Bukan masalah` (API-Q-12), `Lampirkan rangsangan` (API-Q-24 with an existing
 * stimulus), `Muat naik gambar` (opens Audit Rajah, API-Q-21) and the checkbox that feeds `Kumpulkan` on the page.
 */
import { ref } from 'vue'

import { DsCluster, DsStack, DsSurface, DsText } from '@/ds'

import { listStimuliToAttach, type StimulusPick } from '../api/questions'
import { DIAGRAMS_PATH } from '../lib/audit-routes'
import { regroupReference, regroupSource, type RegroupWorkRow } from '../lib/question-list'

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
        <label class="inline-flex min-h-11 min-w-11 items-center justify-center">
          <input
            type="checkbox"
            class="size-5"
            :checked="selected === true"
            :disabled="busy === true"
            :aria-label="`Pilih soalan ${row.questionId}`"
            :data-testid="`regroup-select-${row.questionId}`"
            @change="emit('toggle', row.questionId)"
          />
        </label>
        <DsText variant="body" class="min-w-0 flex-1" data-testid="regroup-stem">{{ row.stemExcerpt }}</DsText>
      </DsCluster>
      <DsCluster gap="sm">
        <DsText variant="caption" tone="muted">{{ row.subject }}</DsText>
        <DsText variant="caption" tone="muted">{{ row.level }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="regroup-source">{{ regroupSource(row) }}</DsText>
        <DsText variant="caption" tone="warning" data-testid="regroup-flag">{{ row.flag }}</DsText>
        <DsText variant="caption" tone="muted" data-testid="regroup-reference">{{ regroupReference(row) }}</DsText>
      </DsCluster>
      <DsCluster gap="sm">
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          class="min-h-11"
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
            class="min-h-11"
            :aria-expanded="picking"
            :disabled="busy === true"
            :data-testid="`regroup-attach-${row.questionId}`"
            @click="openPicker"
          >
            Lampirkan rangsangan
          </UButton>
          <UButton :to="DIAGRAMS_PATH" color="neutral" variant="soft" class="min-h-11" :data-testid="`regroup-upload-${row.questionId}`">Muat naik gambar</UButton>
        </template>
      </DsCluster>
      <DsCluster v-if="picking" gap="sm" :data-testid="`regroup-picker-${row.questionId}`">
        <DsText v-if="loadFailed" variant="caption" tone="error" role="alert" :data-testid="`regroup-picker-error-${row.questionId}`">Maaf, berlaku ralat. Sila cuba semula.</DsText>
        <template v-else>
          <label class="sr-only" :for="`regroup-pick-${row.questionId}`">Rangsangan</label>
          <select
            :id="`regroup-pick-${row.questionId}`"
            v-model="choice"
            class="min-h-11 min-w-0 flex-1 rounded-md border border-default bg-default px-2"
            :data-testid="`regroup-pick-${row.questionId}`"
          >
            <option value="">Rangsangan</option>
            <option v-for="s in choices" :key="s.id" :value="s.id">#{{ s.id }} {{ s.label }}</option>
          </select>
          <UButton type="button" class="min-h-11" :disabled="choice === '' || busy === true" :data-testid="`regroup-pick-go-${row.questionId}`" @click="attach">
            Lampirkan rangsangan
          </UButton>
        </template>
      </DsCluster>
    </DsStack>
  </DsSurface>
</template>
