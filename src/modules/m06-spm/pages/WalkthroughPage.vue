<script setup lang="ts">
/**
 * S13 `/pusat-ai/spm` "SPM Walkthrough — Cikgu Alesa" (M06-T4; FR-M06-80…85, FR-M06-88, BR-M06-28;
 * L-11 SOURCE-DERIVED from the live inline script).
 *
 * Form `#spmForm`: `subject` with native `required` (an empty subject is stopped by the browser before
 * the handler runs: no busy label, request or alert), `year` (`maxlength` 8), `question_text`, and an
 * image picker whose label becomes "📎 {file}". A valid submit disables the button with "AI sedang
 * fikir... (mungkin 15-30s)", hides the result card, posts FormData to `/api/spm-walkthrough/solve`
 * (D4: canned, simulated), then shows the text in a `<pre>` (as text, never HTML) and scrolls to it, or
 * `alert`s the error ("Ralat" without one, "Ralat: {message}" on a network error). The button is
 * restored in `finally`. Subjek / Tahun side by side from 640 px, stacked below (DV-M06-08).
 */
import { nextTick, ref } from 'vue'

import { alertNative } from '@/composables'
import { DsFormField, DsNativeSelect, DsPage, DsPanel, DsStack, DsGrid } from '@/ds'

import { solveWalkthrough } from '../api'
import DutaBlock from '../components/DutaBlock.vue'
import { WALKTHROUGH_SUBJECT_OPTIONS } from '../components/mock-lib'

const IMAGE_LABEL = '📷 Klik atau drag gambar soalan SPM (auto-extract via AI Vision)'

const subject = ref('')
const year = ref('')
const questionText = ref('')
const file = ref<File | null>(null)
const imageLabel = ref(IMAGE_LABEL)
const busy = ref(false)
const result = ref<string | null>(null)
const resultEl = ref<HTMLElement | null>(null)

function onFile(e: Event): void {
  const f = (e.target as HTMLInputElement).files?.[0] ?? null
  file.value = f
  imageLabel.value = f ? `📎 ${f.name}` : IMAGE_LABEL
}

async function solve(): Promise<void> {
  if (busy.value) return
  busy.value = true
  result.value = null
  try {
    const form = new FormData()
    form.append('subject', subject.value)
    form.append('year', year.value)
    form.append('question_text', questionText.value)
    if (file.value) form.append('image', file.value)
    const d = await solveWalkthrough(form)
    if (d.ok) {
      result.value = d.walkthrough || ''
      await nextTick()
      resultEl.value?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
    } else {
      alertNative(d.error || 'Ralat')
    }
  } catch (err) {
    alertNative('Ralat: ' + (err instanceof Error ? err.message : String(err)))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsPage
    title="📝 SPM Walkthrough"
    subtitle="Snap soalan SPM, AI walk-through step-by-step dengan mark scheme + sebutan buku teks. Faham bukan hafal."
    :show-title="true"
    data-testid="walk-page"
  >
    <DsPanel title="Soalan SPM" icon="i-ph-camera-duotone" accent="friend">
      <DsStack id="spmForm" as="form" data-testid="walk-form" @submit.prevent="solve">
        <DsGrid :cols="{ base: 1, sm: 2 }" gap="sm">
          <DsFormField label="Subjek" native>
            <template #default="{ id }">
              <DsNativeSelect
                :id="id"
                v-model="subject"
                name="subject"
                required
                placeholder="Pilih"
                data-testid="walk-subject"
              >
                <option v-for="s in WALKTHROUGH_SUBJECT_OPTIONS" :key="s" :value="s">
                  {{ s }}
                </option>
              </DsNativeSelect>
            </template>
          </DsFormField>
          <DsFormField label="Tahun (opsyen)" native>
            <template #default="{ id }">
              <UInput
                :id="id"
                v-model="year"
                name="year"
                :maxlength="8"
                placeholder="Cth: 2023"
                class="w-full"
                data-testid="walk-year"
              />
            </template>
          </DsFormField>
        </DsGrid>

        <DsFormField label="Soalan (taip atau snap)" native>
          <template #default="{ id }">
            <UTextarea
              :id="id"
              v-model="questionText"
              name="question_text"
              :rows="5"
              placeholder="Salin soalan SPM di sini, atau upload gambar di bawah..."
              class="w-full"
              data-testid="walk-question"
            />
          </template>
        </DsFormField>

        <UCard variant="subtle" :ui="{ body: 'p-3' }">
          <label
            for="imgInput"
            class="flex min-h-11 cursor-pointer items-center justify-center text-center text-label break-words text-muted"
            data-testid="walk-image-label"
            >{{ imageLabel }}</label
          >
        </UCard>
        <!-- Native file input behind the label above; the browser picker needs it. -->
        <!-- eslint-disable-next-line vue/no-restricted-html-elements -->
        <input
          id="imgInput"
          type="file"
          name="image"
          accept="image/*"
          class="sr-only"
          data-testid="walk-image"
          @change="onFile"
        />

        <UButton
          id="solveBtn"
          type="submit"
          size="lg"
          :disabled="busy"
          :loading="busy"
          class="min-h-11 self-start max-sm:w-full max-sm:justify-center"
          data-testid="walk-submit"
          >{{ busy ? 'AI sedang fikir... (mungkin 15-30s)' : 'Bagi Walkthrough' }}</UButton
        >
      </DsStack>
    </DsPanel>

    <div v-if="result !== null" ref="resultEl" class="min-w-0">
      <DsPanel id="result" title="✨ Walkthrough Cikgu Alesa" data-testid="walk-result">
        <pre
          id="walkBody"
          class="text-body break-words whitespace-pre-wrap text-default"
          data-testid="walk-body"
          >{{ result }}</pre>
      </DsPanel>
    </div>

    <DutaBlock
      title="🎓 Cikgu Maestro SPM"
      text="Setelah baca walkthrough, tonton video penjelasan dari Duta SPM."
    />
  </DsPage>
</template>
