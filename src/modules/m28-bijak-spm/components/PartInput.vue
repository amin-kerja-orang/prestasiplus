<script setup lang="ts">
/**
 * The answer controls of one leaf part (US-08, US-09):
 *  - working: "Jalan kerja" step lines + "Jawapan akhir" (+ unit) + optional photo of the working;
 *  - numeric: "Jawapan akhir" (+ unit);
 *  - short_text: a text area.
 * Every change emits a whole new answer; the page autosaves it.
 */
import { computed, ref } from 'vue'

import { latexToPlain } from '../domain/math-expr'
import type { Leaf } from '../domain/paper-model'
import type { McqOption, PartAnswer } from '../domain/types'
import { checkPhoto, photoUrl, putPhoto, removePhoto } from '../lib/photo-store'
import MathField from './MathField.vue'
import { DsCluster, DsStack, DsText } from '@/ds'

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
  <DsStack :data-testid="`part-input-${leaf.id}`">
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
      <DsText v-if="leaf.kind === 'essay'" variant="caption" role="status" data-testid="word-count">
        {{ words }} patah perkataan<template v-if="leaf.wordRange">
          · sasaran {{ leaf.wordRange.min }}–{{ leaf.wordRange.max }}</template
        >. Guru akan menilai esei ini mengikut band.
      </DsText>
    </template>

    <template v-else-if="leaf.kind === 'match_letter'">
      <DsStack gap="xs" role="group" aria-label="Pilih huruf" data-testid="match-bank">
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
      </DsStack>
    </template>

    <template v-else-if="leaf.kind === 'drawing'">
      <DsText variant="body" tone="toned">
        Lukis jawapan anda pada kertas, kemudian ambil gambarnya. Guru menyemak senarai semak (garis
        lurus, titik betul, bentuk lengkung).
      </DsText>
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

      <MathField
        :model-value="answer.final ?? ''"
        label="Jawapan akhir"
        placeholder="cth. 13"
        :disabled="disabled"
        @update:model-value="update({ final: $event })"
      />

      <UFormField v-if="leaf.unit" label="Unit" class="w-full sm:w-1/2">
        <UInput
          :model-value="answer.unit ?? ''"
          :disabled="disabled"
          placeholder="cth. cm"
          size="xl"
          autocomplete="off"
          class="w-full"
          data-testid="unit-input"
          @update:model-value="update({ unit: String($event ?? '') })"
        />
      </UFormField>
    </template>

    <DsStack v-if="leaf.kind === 'working' || leaf.kind === 'drawing'" gap="xs">
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
      <DsText v-if="photoError" variant="caption" tone="error" role="alert">{{
        photoError
      }}</DsText>
      <DsCluster
        v-if="answer.photos?.length"
        as="ul"
        gap="xs"
        align="stretch"
        aria-label="Gambar jalan kerja"
      >
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
          <DsText variant="caption" as="span" tone="toned">{{ p.name }}</DsText>
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
      </DsCluster>
    </DsStack>
  </DsStack>
</template>
