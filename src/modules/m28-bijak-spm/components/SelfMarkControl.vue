<script setup lang="ts">
/**
 * Markah kendiri (R1-B12, V2 Semakan): a stepper 0..max for one subjective part, with a band picker
 * for rubric parts. Choosing a band presets the stepper to the band midpoint and narrows it to the
 * band range. The stepper starts at the awarded mark (the keyword suggestion when there is one) and
 * stays "Belum disahkan" until the pupil saves; a saved self-mark shows as confirmed. The server
 * clamps the mark again, so this only guides.
 */
import { computed, ref, watch } from 'vue'

import {
  bandMidpoint,
  bandOfMark,
  bandOptions,
  clampMark,
  type ReviewPart,
} from '../domain/semakan'

const props = defineProps<{
  part: ReviewPart
  /** Saves the mark; rejects with an Error whose message is the BM refusal to show. */
  save: (body: { partId: string; mark: number; band?: string }) => Promise<void>
}>()

const bands = computed(() => (props.part.scheme.rubric ? bandOptions(props.part) : []))
const max = computed(() => props.part.marks)

/** The band to pre-select: the saved one, else the band that holds a mark the pupil already has. */
function initialBand(): string | undefined {
  if (props.part.band) return props.part.band
  if (props.part.selfMarked || props.part.autoSuggested) {
    return bandOfMark(bands.value, props.part.awarded)
  }
  return undefined
}

const draft = ref(props.part.awarded)
const band = ref<string | undefined>(initialBand())
const saving = ref(false)
const error = ref('')

const selected = computed(() => bands.value.find((b) => b.name === band.value))
const lo = computed(() => selected.value?.from ?? 0)
const hi = computed(() => selected.value?.to ?? max.value)

watch(
  () => [props.part.awarded, props.part.band, props.part.selfMarked] as const,
  () => {
    draft.value = props.part.awarded
    band.value = initialBand()
  },
)

function step(by: number): void {
  draft.value = clampMark(draft.value + by, hi.value, lo.value)
}

function pickBand(name: string | undefined): void {
  band.value = name
  const b = bands.value.find((x) => x.name === name)
  if (b) draft.value = bandMidpoint(b)
}

const savedBand = computed(() => props.part.band)
const dirty = computed(
  () =>
    draft.value !== props.part.awarded ||
    (bands.value.length > 0 && !!band.value && band.value !== savedBand.value),
)
const confirmed = computed(() => !!props.part.selfMarked && !dirty.value)

const badge = computed(() => {
  if (confirmed.value) return { text: 'Markah kendiri disimpan', color: 'success' as const }
  if (dirty.value || props.part.selfMarked)
    return { text: 'Belum disahkan', color: 'warning' as const }
  if (props.part.autoSuggested) return { text: 'Cadangan, belum disahkan', color: 'warning' as const }
  return { text: 'Belum dimarkah', color: 'info' as const }
})

const bandItems = computed(() =>
  bands.value.map((b) => ({
    value: b.name,
    label: `Band ${b.name} (${b.from}-${b.to})`,
    description: b.descriptor,
  })),
)

async function commit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  error.value = ''
  try {
    await props.save({
      partId: props.part.partId,
      mark: clampMark(draft.value, hi.value, lo.value),
      ...(bands.value.length && band.value ? { band: band.value } : {}),
    })
  } catch (e) {
    error.value =
      e instanceof Error && e.message ? e.message : 'Markah tidak dapat disimpan. Cuba lagi.'
  } finally {
    saving.value = false
  }
}

const labelId = computed(() => `selfmark-label-${props.part.partId}`)
</script>

<template>
  <div
    class="flex flex-col gap-3 rounded-xl bg-elevated p-3"
    :data-testid="`selfmark-${part.partId}`"
    :data-confirmed="confirmed"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <span :id="labelId" class="text-label text-highlighted">Markah kendiri:</span>
      <UBadge :color="badge.color" variant="soft" size="md" data-testid="selfmark-state">{{
        badge.text
      }}</UBadge>
    </div>

    <URadioGroup
      v-if="bandItems.length"
      :model-value="band"
      :items="bandItems"
      variant="card"
      legend="Pilih band yang sepadan dengan jawapan anda"
      data-testid="selfmark-bands"
      @update:model-value="pickBand($event as string)"
    />

    <div role="group" :aria-labelledby="labelId" class="flex items-center gap-3">
      <UButton
        color="neutral"
        variant="outline"
        icon="i-ph-minus"
        aria-label="Kurangkan markah kendiri"
        class="min-h-11 min-w-11 justify-center"
        :disabled="draft <= lo"
        data-testid="selfmark-dec"
        @click="step(-1)"
      />
      <output
        class="tabular min-w-20 text-center text-heading text-highlighted"
        aria-live="polite"
        data-testid="selfmark-value"
        >{{ draft }} / {{ max }}</output
      >
      <UButton
        color="neutral"
        variant="outline"
        icon="i-ph-plus"
        aria-label="Tambah markah kendiri"
        class="min-h-11 min-w-11 justify-center"
        :disabled="draft >= hi"
        data-testid="selfmark-inc"
        @click="step(1)"
      />
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      :title="error"
      role="alert"
      data-testid="selfmark-error"
    />

    <UButton
      class="min-h-11 justify-center"
      :loading="saving"
      :disabled="saving || confirmed"
      data-testid="selfmark-save"
      @click="commit"
      >Simpan markah</UButton
    >
  </div>
</template>
