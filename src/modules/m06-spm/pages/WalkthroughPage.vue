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
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from '@/components/form'

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
  <div class="px-2 py-4 sm:px-6 sm:py-8" data-testid="walk-page">
    <div class="mx-auto max-w-[880px] space-y-4">
      <header class="rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h1 class="font-heading text-xl font-bold break-words text-slate-900">
          📝 SPM Walkthrough
        </h1>
        <p class="mt-1 text-sm text-slate-600">
          Snap soalan SPM, AI walk-through step-by-step dengan mark scheme + sebutan buku teks.
          Faham bukan hafal.
        </p>
      </header>

      <form
        id="spmForm"
        class="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6"
        data-testid="walk-form"
        @submit.prevent="solve"
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="min-w-0">
            <label
              for="walk-subject"
              class="mb-1 block text-xs font-bold tracking-wide text-slate-600 uppercase"
              >Subjek</label
            >
            <select
              id="walk-subject"
              v-model="subject"
              name="subject"
              required
              :class="FORM_SELECT_CLASS"
              class="min-h-11"
              data-testid="walk-subject"
            >
              <option value="">Pilih</option>
              <option v-for="s in WALKTHROUGH_SUBJECT_OPTIONS" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="min-w-0">
            <label
              for="walk-year"
              class="mb-1 block text-xs font-bold tracking-wide text-slate-600 uppercase"
              >Tahun (opsyen)</label
            >
            <input
              id="walk-year"
              v-model="year"
              type="text"
              name="year"
              maxlength="8"
              placeholder="Cth: 2023"
              :class="FORM_INPUT_CLASS"
              class="min-h-11"
              data-testid="walk-year"
            />
          </div>
        </div>

        <div>
          <label
            for="walk-question"
            class="mb-1 block text-xs font-bold tracking-wide text-slate-600 uppercase"
            >Soalan (taip atau snap)</label
          >
          <textarea
            id="walk-question"
            v-model="questionText"
            name="question_text"
            rows="5"
            placeholder="Salin soalan SPM di sini, atau upload gambar di bawah..."
            :class="FORM_TEXTAREA_CLASS"
            data-testid="walk-question"
          ></textarea>
        </div>

        <label
          for="imgInput"
          class="flex min-h-11 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 px-3 py-4 text-center text-sm break-words text-slate-600 hover:border-amber-400 hover:bg-amber-50"
          data-testid="walk-image-label"
          >{{ imageLabel }}</label
        >
        <input
          id="imgInput"
          type="file"
          name="image"
          accept="image/*"
          class="hidden"
          data-testid="walk-image"
          @change="onFile"
        />

        <button
          id="solveBtn"
          type="submit"
          :disabled="busy"
          class="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-orange-700 disabled:opacity-60 sm:w-auto"
          data-testid="walk-submit"
        >
          {{ busy ? 'AI sedang fikir... (mungkin 15-30s)' : 'Bagi Walkthrough' }}
        </button>
      </form>

      <section
        v-if="result !== null"
        id="result"
        ref="resultEl"
        class="rounded-2xl bg-white p-4 shadow-sm sm:p-6"
        data-testid="walk-result"
      >
        <h2 class="font-heading text-base font-bold text-slate-900">✨ Walkthrough Cikgu Alesa</h2>
        <pre
          id="walkBody"
          class="mt-3 font-sans text-sm break-words whitespace-pre-wrap text-slate-700"
          data-testid="walk-body"
          >{{ result }}</pre>
      </section>

      <DutaBlock
        title="🎓 Cikgu Maestro SPM"
        text="Setelah baca walkthrough, tonton video penjelasan dari Duta SPM."
      />
    </div>
  </div>
</template>
