<script setup lang="ts">
/**
 * The answer controls of one leaf part (US-08, US-09):
 *  - working: "Jalan kerja" step lines + "Jawapan akhir" (+ unit) + optional photo of the working;
 *  - numeric: "Jawapan akhir" (+ unit);
 *  - short_text: a text area.
 * Every change emits a whole new answer; the page autosaves it.
 */
import { computed, ref, type Directive } from 'vue'

import { isReadableNumber, latexToPlain } from '../domain/math-expr'
import type { Leaf } from '../domain/paper-model'
import type { McqOption, PartAnswer } from '../domain/types'
import { checkPhoto, photoUrl, putPhoto, removePhoto } from '../lib/photo-store'
import MathField from './MathField.vue'

const props = defineProps<{
  leaf: Leaf
  modelValue: PartAnswer | undefined
  attemptId: string
  disabled?: boolean
  /** Shared lettered bank of the question's group (match_letter). */
  optionBank?: McqOption[]
}>()
const emit = defineEmits<{ 'update:modelValue': [PartAnswer] }>()

const answer = computed<PartAnswer>(() => props.modelValue ?? {})
const steps = computed(() => (answer.value.steps?.length ? answer.value.steps : ['']))
const words = computed(() =>
  (answer.value.text ?? '').trim() ? (answer.value.text ?? '').trim().split(/\s+/).length : 0,
)
/** Numeric leaf: the final answer must be something the marker can read (FB-050). */
// The hint shows once the field was left, or at once for a stored answer that cannot be read.
const finalTouched = ref(!isReadableNumber(props.modelValue?.final ?? ''))
const finalInvalid = computed(
  () =>
    props.leaf.kind === 'numeric' &&
    finalTouched.value &&
    !isReadableNumber(answer.value.final ?? ''),
)
/**
 * Numeric leaves ask the phone for the decimal keypad. The maths field owns its `inputmode` (it is
 * `none` while its on-screen keypad is open, `text` otherwise), so this directive turns `text` into
 * `decimal` on the field inside the wrapper and keeps doing so after every change.
 */
type WithObserver = HTMLElement & { __decimalObserver?: MutationObserver }
const vDecimalInputmode: Directive<WithObserver, boolean> = {
  mounted(el, { value }) {
    const input = el.querySelector('input')
    if (!value || !input) return
    const apply = (): void => {
      if (input.getAttribute('inputmode') === 'text') input.setAttribute('inputmode', 'decimal')
    }
    apply()
    el.__decimalObserver = new MutationObserver(apply)
    el.__decimalObserver.observe(input, { attributes: true, attributeFilter: ['inputmode'] })
  },
  unmounted(el) {
    el.__decimalObserver?.disconnect()
  },
}

const photoError = ref('')
const urls = ref<Record<string, string>>({})
const fileInput = ref<{ $el: HTMLElement } | null>(null)

function update(patch: Partial<PartAnswer>): void {
  const next: PartAnswer = { ...answer.value, ...patch }
  next.plain = {
    steps: (next.steps ?? []).map((s) => latexToPlain(s)),
    final: latexToPlain(next.final ?? ''),
  }
  emit('update:modelValue', next)
}

function pickPhoto(): void {
  fileInput.value?.$el.querySelector('input')?.click()
}

function setStep(i: number, v: string): void {
  const next = [...steps.value]
  next[i] = v
  update({ steps: next })
}
function addStep(): void {
  update({ steps: [...steps.value, ''] })
}
function removeStep(i: number): void {
  update({ steps: steps.value.filter((_, k) => k !== i) })
}

async function onFiles(ev: Event): Promise<void> {
  const input = ev.target as HTMLInputElement
  photoError.value = ''
  let photos = [...(answer.value.photos ?? [])]
  for (const file of Array.from(input.files ?? [])) {
    const ok = checkPhoto(file, photos.length)
    if (!ok.ok) {
      photoError.value = ok.message
      break
    }
    const meta = await putPhoto(props.attemptId, props.leaf.id, file, photos.length)
    photos = [...photos, meta]
    const u = await photoUrl(meta.key)
    if (u) urls.value = { ...urls.value, [meta.key]: u }
  }
  input.value = ''
  update({ photos })
}
async function dropPhoto(key: string): Promise<void> {
  await removePhoto(key)
  update({ photos: (answer.value.photos ?? []).filter((p) => p.key !== key) })
}
</script>

<template>
  <div class="flex flex-col gap-4" :data-testid="`part-input-${leaf.id}`">
    <template v-if="leaf.kind === 'short_text' || leaf.kind === 'essay'">
      <UFormField :label="`Jawapan ${leaf.label}`.trim()" class="w-full">
        <UTextarea
          :model-value="answer.text ?? ''"
          :disabled="disabled"
          :rows="leaf.kind === 'essay' ? 10 : 4"
          autoresize
          :placeholder="leaf.kind === 'essay' ? 'Tulis jawapan anda di sini…' : 'Tulis jawapan…'"
          class="w-full"
          data-testid="short-text-input"
          @update:model-value="update({ text: String($event ?? '') })"
        />
      </UFormField>
      <p
        v-if="leaf.kind === 'essay'"
        class="text-caption text-muted"
        role="status"
        data-testid="word-count"
      >
        {{ words }} patah perkataan<template v-if="leaf.wordRange">
          · sasaran {{ leaf.wordRange.min }}–{{ leaf.wordRange.max }}</template
        >. Guru akan menilai esei ini mengikut band.
      </p>
    </template>

    <template v-else-if="leaf.kind === 'match_letter'">
      <div
        class="flex flex-col gap-2"
        role="group"
        aria-label="Pilih huruf"
        data-testid="match-bank"
      >
        <UButton
          v-for="o in optionBank ?? []"
          :key="o.id"
          type="button"
          color="neutral"
          :variant="answer.choice === o.id ? 'solid' : 'soft'"
          :aria-pressed="answer.choice === o.id"
          :disabled="disabled"
          class="min-h-11 justify-start"
          :data-testid="`match-${o.id}`"
          @click="update({ choice: answer.choice === o.id ? undefined : o.id })"
          >{{ o.id }} — {{ o.text }}</UButton
        >
      </div>
    </template>

    <template v-else-if="leaf.kind === 'drawing'">
      <p class="text-body text-toned">
        Lukis jawapan anda pada kertas, kemudian ambil gambarnya. Guru menyemak senarai semak (garis
        lurus, titik betul, bentuk lengkung).
      </p>
    </template>

    <template v-else-if="leaf.kind === 'table_fill'">
      <UAlert
        color="info"
        variant="soft"
        title="Jenis jawapan ini akan tersedia tidak lama lagi."
      />
    </template>

    <template v-else>
      <fieldset v-if="leaf.kind === 'working'" class="flex flex-col gap-3" :disabled="disabled">
        <legend class="mb-1 text-label text-toned">Jalan kerja</legend>
        <MathField
          v-for="(s, i) in steps"
          :key="i"
          :model-value="s"
          :label="`Langkah ${i + 1}`"
          :removable="steps.length > 1"
          :disabled="disabled"
          @update:model-value="setStep(i, $event)"
          @remove="removeStep(i)"
        />
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          icon="i-ph-plus"
          class="min-h-11 self-start rounded-2xl"
          :disabled="disabled"
          data-testid="add-step"
          @click="addStep"
          >Tambah langkah</UButton
        >
      </fieldset>

      <div
        v-decimal-inputmode="leaf.kind === 'numeric'"
        class="flex flex-col gap-2"
        @focusout="finalTouched = true"
      >
        <MathField
          :model-value="answer.final ?? ''"
          label="Jawapan akhir"
          placeholder="cth. 13"
          :disabled="disabled"
          @update:model-value="update({ final: $event })"
        />
        <p
          v-if="finalInvalid"
          class="text-caption text-error"
          role="status"
          data-testid="final-hint"
        >
          Masukkan nombor sahaja, cth. 13 atau 3.5. Pecahan dan tanda tolak ada pada papan kekunci.
        </p>
      </div>

      <UFormField v-if="leaf.unit" label="Unit" class="w-full sm:w-1/2">
        <UInput
          :model-value="answer.unit ?? ''"
          :disabled="disabled"
          placeholder="Tulis unit"
          size="xl"
          autocomplete="off"
          class="w-full"
          :ui="{ base: 'min-h-11' }"
          data-testid="unit-input"
          @update:model-value="update({ unit: String($event ?? '') })"
        />
      </UFormField>
    </template>

    <div v-if="leaf.kind === 'working' || leaf.kind === 'drawing'" class="flex flex-col gap-2">
      <UInput
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png"
        capture="environment"
        multiple
        class="sr-only"
        tabindex="-1"
        aria-hidden="true"
        data-testid="photo-file"
        @change="onFiles"
      />
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-camera"
        class="min-h-11 self-start rounded-2xl"
        :disabled="disabled"
        data-testid="photo-button"
        @click="pickPhoto"
        >{{
          leaf.kind === 'drawing' ? 'Ambil gambar jawapan lukisan' : 'Ambil gambar jalan kerja'
        }}</UButton
      >
      <p v-if="photoError" class="text-caption text-error" role="alert">{{ photoError }}</p>
      <ul v-if="answer.photos?.length" class="flex flex-wrap gap-2" aria-label="Gambar jalan kerja">
        <li
          v-for="p in answer.photos"
          :key="p.key"
          class="flex items-center gap-2 rounded-xl bg-muted p-2"
        >
          <img
            v-if="urls[p.key]"
            :src="urls[p.key]"
            :alt="`Gambar ${p.name}`"
            class="size-12 rounded-lg object-cover"
          />
          <span class="text-caption text-toned">{{ p.name }}</span>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            icon="i-ph-trash"
            class="size-11 justify-center rounded-2xl"
            :aria-label="`Buang gambar ${p.name}`"
            :disabled="disabled"
            @click="dropPhoto(p.key)"
          />
        </li>
      </ul>
    </div>
  </div>
</template>
