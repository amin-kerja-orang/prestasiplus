<script setup lang="ts">
/**
 * S11 `/spm-mock` "SPM Mock Exam" (M06-T4; FR-M06-67…71, BR-M06-29, DV-M06-06/08).
 *
 * Hero, Duta block, warning box, the "Jana Mock SPM" form (native `required` on both selects: an empty
 * subject never sends a request) and the "Mock Sebelum Ini" list, newest first. Generating calls
 * `POST /api/spm-mocks` and goes to Q4 `/spm-mock/{id}`. Below 640 px the fields stack and the chip and
 * link of each row sit on their own line (DV-M06-08).
 */
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { AlertBox } from '@/components/feedback'
import { FORM_SELECT_CLASS } from '@/components/form'
import { useApi } from '@/composables'
import { diffForHumans } from '@/lib/time'

import { createMock, fetchMocks } from '../api'
import DutaBlock from '../components/DutaBlock.vue'
import { GRADE_CHIP_CLASS, MOCK_SUBJECT_OPTIONS, scoreLabel } from '../components/mock-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const router = useRouter()
const { data, error, loading, reload } = useApi((signal) => fetchMocks({ signal }))
const mocks = computed(() => data.value ?? [])

const subject = ref('')
const paper = ref<'1' | '2'>('1')
const busy = ref(false)
const formError = ref<string | null>(null)

async function generate(): Promise<void> {
  if (busy.value) return
  busy.value = true
  formError.value = null
  try {
    const res = await createMock({
      subject: subject.value,
      paperNumber: paper.value === '2' ? 2 : 1,
    })
    await router.push(`/spm-mock/${String(res.id)}`)
  } catch (err) {
    formError.value = isApiError(err) && err.fields?.subject ? err.fields.subject : LOAD_ERROR
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="px-2 py-4 sm:px-6 sm:py-8" data-testid="mock-page">
    <div class="mx-auto max-w-4xl space-y-4">
      <header
        class="rounded-2xl bg-gradient-to-br from-amber-700 to-orange-500 p-5 text-white shadow sm:p-8"
        data-testid="mock-hero"
      >
        <h1 class="font-heading text-2xl font-bold break-words text-white">📝 SPM Mock Exam</h1>
        <p class="mt-2 text-sm text-orange-50">
          Mock SPM penuh dengan timer + auto-grade + weakness analysis. Boleh attempt setiap bulan.
        </p>
      </header>

      <DutaBlock
        title="⭐ Maestro SPM Untuk Anda"
        text="Cikgu pakar yg dah bantu pelajar score A+ — tonton video mereka sebelum mula mock."
      />

      <p
        class="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        data-testid="mock-warning"
      >
        ⚠️ <b>Persediaan sebelum mula:</b> Pastikan masa anda cukup. Setelah klik "Mula", timer akan
        jalan dan tak boleh stop. Kalau pause, score akan jejas.
      </p>

      <form
        class="rounded-2xl bg-white p-4 shadow-sm sm:p-6"
        data-testid="mock-form"
        @submit.prevent="generate"
      >
        <AlertBox v-if="formError" :messages="formError" data-testid="mock-form-error" />
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-[2fr_1fr]">
          <div class="min-w-0">
            <label
              for="mock-subject"
              class="mb-1 block text-xs font-bold tracking-wide text-slate-600 uppercase"
              >Subjek</label
            >
            <select
              id="mock-subject"
              v-model="subject"
              name="subject"
              required
              :class="FORM_SELECT_CLASS"
              class="min-h-11"
              data-testid="mock-subject"
            >
              <option value="">Pilih subjek</option>
              <option v-for="s in MOCK_SUBJECT_OPTIONS" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="min-w-0">
            <label
              for="mock-paper"
              class="mb-1 block text-xs font-bold tracking-wide text-slate-600 uppercase"
              >Paper</label
            >
            <select
              id="mock-paper"
              v-model="paper"
              name="paper_number"
              required
              :class="FORM_SELECT_CLASS"
              class="min-h-11"
              data-testid="mock-paper"
            >
              <option value="1">Paper 1 (Objektif)</option>
              <option value="2">Paper 2 (Esei/Struktur)</option>
            </select>
          </div>
        </div>
        <button
          type="submit"
          :disabled="busy"
          class="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-orange-700 disabled:opacity-60 sm:w-auto"
          data-testid="mock-generate"
        >
          🎯 Jana Mock SPM
        </button>
      </form>

      <section class="rounded-2xl bg-white p-4 shadow-sm sm:p-6" data-testid="mock-history">
        <h2 class="font-heading text-base font-bold text-slate-900">📚 Mock Sebelum Ini</h2>

        <div v-if="loading && !data" class="mt-3 space-y-2" data-testid="mock-skeleton">
          <div v-for="n in 3" :key="n" class="h-16 animate-pulse rounded-xl bg-slate-100"></div>
        </div>
        <div v-else-if="error" class="mt-3 space-y-3" data-testid="mock-error">
          <AlertBox :messages="LOAD_ERROR" />
          <button
            type="button"
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
            data-testid="mock-retry"
            @click="reload()"
          >
            Cuba Semula
          </button>
        </div>
        <ul v-else class="mt-3 space-y-2" data-testid="mock-list">
          <li
            v-for="m in mocks"
            :key="m.id"
            class="sm-card flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-slate-200 p-3"
            :data-testid="`mock-row-${String(m.id)}`"
          >
            <div class="min-w-0 basis-full sm:flex-1 sm:basis-auto">
              <p class="text-sm font-bold break-words text-slate-900" data-testid="mock-row-title">
                {{ m.subject }} · Paper {{ m.paperNumber }}
              </p>
              <p class="text-xs text-slate-600" data-testid="mock-row-meta">
                {{ diffForHumans(m.createdAt) }} ·
                <span v-if="m.status === 'in_progress'" class="font-semibold text-red-600"
                  >Belum submit</span
                >
                <template v-else>{{
                  scoreLabel(m.score ?? 0, m.maxScore, m.percent ?? 0)
                }}</template>
              </p>
            </div>
            <span
              class="grade rounded-full px-3 py-1 font-bold"
              :class="[
                m.status === 'in_progress' ? 'text-[0.85rem]' : 'text-2xl',
                GRADE_CHIP_CLASS[m.status === 'in_progress' ? 'pending' : (m.grade ?? 'G')],
              ]"
              data-testid="mock-row-grade"
              >{{ m.status === 'in_progress' ? 'Belum' : m.grade }}</span
            >
            <RouterLink
              :to="
                m.status === 'in_progress'
                  ? `/spm-mock/${String(m.id)}`
                  : `/spm-mock/${String(m.id)}/result`
              "
              class="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
              data-testid="mock-row-link"
              >{{ m.status === 'in_progress' ? 'Sambung →' : 'Lihat →' }}</RouterLink
            >
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
