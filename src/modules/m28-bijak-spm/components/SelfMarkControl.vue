<script setup lang="ts">
/**
 * Markah kendiri (R1-B12, V2 Semakan; 46 section 3.4): a stepper 0..max with a numeric input for one part a person marks,
 * with a band picker for rubric parts. Choosing a band presets the stepper to the band midpoint and narrows it to the
 * band range. The stepper starts at the awarded mark (the keyword suggestion when there is one) and stays "Belum disahkan"
 * until it is saved. S3-T06 (46 section 3.4 items 6-7): a typed value rounds half up, a negative becomes 0 and a value over
 * the maximum becomes the maximum; every change by the pupil is saved 500 ms after the last one ("menyimpan…", then
 * "disimpan"), with no save button. The server clamps the mark again, so this only guides. Shared by S5-T11.
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

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
const saved = ref(false)
const error = ref('')
/** 46 section 3.4 item 7: the save waits this long after the last change. */
const AUTOSAVE_MS = 500
let timer: ReturnType<typeof setTimeout> | undefined
let again = false
/** Set on unmount: nothing is saved after it (the page may already show another sitting). */
let unmounted = false
/** A change waits for its 500 ms (reactive twin of `timer`). */
const pending = ref(false)

const selected = computed(() => bands.value.find((b) => b.name === band.value))
const lo = computed(() => selected.value?.from ?? 0)
const hi = computed(() => selected.value?.to ?? max.value)

watch(
  [() => props.part.awarded, () => props.part.band, () => props.part.selfMarked],
  () => {
    // A newer change of the pupil (waiting, or queued behind a save in flight) wins over a refreshed part.
    if (pending.value || again) return
    draft.value = props.part.awarded
    band.value = initialBand()
  },
)

/** A change by the pupil: (re)starts the 500 ms autosave. */
function changed(): void {
  saved.value = false
  error.value = ''
  if (timer) clearTimeout(timer)
  pending.value = true
  timer = setTimeout(() => {
    timer = undefined
    pending.value = false
    void commit()
  }, AUTOSAVE_MS)
}

/** Sets the draft; arms the autosave only when the value really changed. */
function setDraft(value: number): void {
  if (value === draft.value) return
  draft.value = value
  changed()
}

function step(by: number): void {
  setDraft(clampMark(draft.value + by, hi.value, lo.value))
}

/** A typed value: round half up, negative to 0 (or the band floor), over the maximum to the maximum (AC-MUR-13-22). */
function normalise(raw: string): number {
  const n = raw.trim() === '' ? Number.NaN : Number(raw.replace(',', '.'))
  return clampMark(Number.isFinite(n) ? Math.floor(n + 0.5) : lo.value, hi.value, lo.value)
}

/** While typing: a number counts as a change (500 ms autosave); the field is left as typed. */
function typing(event: Event): void {
  const raw = (event.target as HTMLInputElement).value
  if (raw.trim() !== '' && Number.isFinite(Number(raw.replace(',', '.')))) setDraft(normalise(raw))
}

/** On Enter or leaving the field: the stored value is written back into the field (9 over a maximum of 4 shows 4). */
function typed(event: Event): void {
  const input = event.target as HTMLInputElement
  setDraft(normalise(input.value))
  input.value = String(draft.value)
}

function pickBand(name: string | undefined): void {
  if (name === band.value) return
  band.value = name
  const b = bands.value.find((x) => x.name === name)
  if (b) draft.value = bandMidpoint(b)
  changed()
}

const dirty = computed(
  () =>
    draft.value !== props.part.awarded ||
    (bands.value.length > 0 && !!band.value && band.value !== initialBand()),
)
/** Tells the page about an unsaved change so it can warn before leaving (and clears it on unmount). */
const emit = defineEmits<{ dirty: [partId: string, dirty: boolean] }>()
watch(dirty, (d) => emit('dirty', props.part.partId, d))
onBeforeUnmount(() => {
  unmounted = true
  again = false
  // A change still waiting for its 500 ms is dropped: by now the page may show another sitting, and the page's leave guard
  // already warned about the unsaved change (`dirty`).
  if (timer) clearTimeout(timer)
  timer = undefined
  emit('dirty', props.part.partId, false)
})

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
    label: `Band ${b.name}${b.label ? ` · ${b.label}` : ''} (${b.from}-${b.to})`,
    description: b.descriptor,
  })),
)

async function commit(): Promise<void> {
  if (unmounted) return
  // A change made while a save is in flight is saved right after it.
  if (saving.value) {
    again = true
    return
  }
  saving.value = true
  error.value = ''
  try {
    await props.save({
      partId: props.part.partId,
      mark: clampMark(draft.value, hi.value, lo.value),
      ...(bands.value.length && band.value ? { band: band.value } : {}),
    })
    // A save can answer with the same values, so the watcher above stays quiet: show what the server holds.
    await nextTick()
    if (!again && !timer) {
      draft.value = props.part.awarded
      band.value = initialBand()
      saved.value = true
    }
  } catch (e) {
    error.value =
      e instanceof Error && e.message ? e.message : 'Markah tidak dapat disimpan. Cuba lagi.'
  } finally {
    saving.value = false
  }
  if (again) {
    again = false
    if (!timer && !unmounted) void commit()
  }
}

/** 46 section 3.4 item 7. */
const saveState = computed(() => (saving.value || pending.value ? 'menyimpan…' : saved.value ? 'disimpan' : ''))

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

    <div role="group" :aria-labelledby="labelId" class="flex flex-wrap items-center gap-3">
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
      <UInput
        type="number"
        inputmode="numeric"
        :model-value="draft"
        :min="lo"
        :max="hi"
        step="1"
        class="w-20"
        :ui="{ base: 'tabular text-center' }"
        aria-label="Markah (nombor)"
        data-testid="selfmark-input"
        @input="typing"
        @change="typed"
      />
      <output
        class="tabular min-w-12 text-heading text-highlighted"
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

    <p
      v-if="saveState"
      class="text-caption text-muted"
      data-testid="selfmark-save-state"
    >
      {{ saveState }}
    </p>
  </div>
</template>
