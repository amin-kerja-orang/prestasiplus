<script setup lang="ts">
/**
 * S12 `/spm-mock/:id/result` "Result Mock SPM — {Subjek}" (M06-T4; FR-M06-75…79, BR-M06-24/26,
 * DV-M06-05).
 *
 * Hero by grade band (green / `mid` yellow / `bad` red), the subject-matched Duta block, "Topik Lemah"
 * (hidden without a wrong item), "Review Setiap Soalan" and the two actions. Unknown or foreign id: the
 * global 404; a mock not yet submitted goes back to Q4. Max width 880 px, single column.
 */
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { AlertBox } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'

import { fetchMockResult } from '../api'
import DutaBlock from '../components/DutaBlock.vue'
import { HERO_CLASS, isCorrect, itemHeader, percentLabel, wrongLabel } from '../components/mock-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()
const id = computed(() => Number(route.params.id))
const { data, error, loading, reload } = useApi(
  (signal) => fetchMockResult(id.value, { signal }),
  id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
const notSubmitted = computed(() => isApiError(error.value) && error.value.status === 409)
watch(
  notFound,
  (yes) => {
    if (yes) setRouteOutcome(404)
  },
  { immediate: true },
)
watch(
  notSubmitted,
  (yes) => {
    if (yes) void router.replace(`/spm-mock/${String(id.value)}`)
  },
  { immediate: true },
)
watch(
  data,
  (d) => {
    if (!d) return
    const title = `Result Mock SPM — ${d.subject}`
    pageMeta.setTitle(title)
    pageMeta.setHeader({ title })
  },
  { immediate: true },
)
</script>

<template>
  <div class="px-2 py-4 sm:px-6 sm:py-8" data-testid="result-page">
    <div class="mx-auto max-w-[880px] space-y-4">
      <div v-if="loading && !data" class="space-y-2" data-testid="result-skeleton">
        <div class="h-40 animate-pulse rounded-2xl bg-slate-100"></div>
        <div v-for="n in 3" :key="n" class="h-20 animate-pulse rounded-xl bg-slate-100"></div>
      </div>
      <div
        v-else-if="error && !notFound && !notSubmitted"
        class="space-y-3"
        data-testid="result-error"
      >
        <AlertBox :messages="LOAD_ERROR" />
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
          data-testid="result-retry"
          @click="reload()"
        >
          Cuba Semula
        </button>
      </div>

      <template v-else-if="data">
        <header
          class="mr-hero rounded-2xl p-5 text-center shadow sm:p-8"
          :class="[HERO_CLASS[data.heroClass], data.heroClass]"
          :data-hero="data.heroClass"
          data-testid="result-hero"
        >
          <h1
            class="font-heading text-lg font-bold break-words sm:text-xl"
            data-testid="result-title"
          >
            {{ data.subject }} · Paper {{ data.paperNumber }}
          </h1>
          <p class="mt-2 text-6xl font-extrabold" data-testid="result-grade">{{ data.grade }}</p>
          <p class="mt-1 text-xl font-bold" data-testid="result-percent">
            {{ percentLabel(data.percent) }}
          </p>
          <p class="text-sm" data-testid="result-score">
            {{ data.score }} / {{ data.maxScore }} markah
          </p>
        </header>

        <DutaBlock
          :title="`🎓 Cikgu Pakar ${data.subject}`"
          text="Lemah dlm topik tertentu? Cikgu pakar ni boleh bantu anda naik ke A+ next round."
          :subject="data.subject"
        />

        <section
          v-if="data.weakTopics.length > 0"
          class="rounded-2xl bg-white p-4 shadow-sm sm:p-6"
          data-testid="result-weak"
        >
          <h2 class="font-heading text-base font-bold text-slate-900">
            📉 Topik Lemah — Fokus Belajar Ke Sini
          </h2>
          <ul class="mt-3 space-y-2">
            <li
              v-for="w in data.weakTopics"
              :key="w.topic"
              class="weak-item flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm"
              data-testid="weak-item"
            >
              <span
                class="min-w-0 font-semibold break-words text-slate-900"
                data-testid="weak-topic"
                >{{ w.topic }}</span
              >
              <span class="text-xs font-semibold text-red-700" data-testid="weak-count">{{
                wrongLabel(w.wrongCount)
              }}</span>
            </li>
          </ul>
          <p class="mt-3 text-sm text-slate-600" data-testid="result-tip">
            💡 Cikgu Alesa cadang anda fokus belajar topik atas dulu. Boleh start dengan
            <RouterLink to="/pusat-nota-ringkas" class="font-semibold text-indigo-600 underline"
              >jana nota ringkas</RouterLink
            >
            untuk topik tersebut.
          </p>
        </section>

        <section class="rounded-2xl bg-white p-4 shadow-sm sm:p-6" data-testid="result-review">
          <h2 class="font-heading text-base font-bold text-slate-900">📋 Review Setiap Soalan</h2>
          <ul class="mt-3 space-y-2">
            <li
              v-for="it in data.items"
              :key="it.no"
              class="q-review rounded-lg border-l-4 p-3 text-sm"
              :class="
                isCorrect(it)
                  ? 'correct border-emerald-500 bg-emerald-50'
                  : 'wrong border-red-500 bg-red-50'
              "
              :data-testid="`review-item-${String(it.no)}`"
            >
              <p class="num text-xs font-bold tracking-wide uppercase" data-testid="review-header">
                {{ isCorrect(it) ? '✓' : '✗' }} {{ itemHeader(it) }}
              </p>
              <p
                class="mt-1 break-words whitespace-pre-line text-slate-900"
                data-testid="review-text"
              >
                {{ it.text }}
              </p>
              <p class="mt-1 break-words text-slate-700" data-testid="review-answer">
                <b>Anda:</b> {{ it.studentAnswer ?? '(tiada jawapan)' }}
              </p>
              <p class="break-words whitespace-pre-line text-slate-700" data-testid="review-key">
                <b>Jawapan:</b> {{ it.modelAnswer }}
              </p>
              <p
                v-if="it.feedback"
                class="mt-1 break-words text-slate-600 italic"
                data-testid="review-feedback"
              >
                {{ it.feedback }}
              </p>
            </li>
          </ul>
        </section>

        <div class="flex flex-wrap gap-3" data-testid="result-actions">
          <RouterLink
            to="/spm-mock"
            class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-orange-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-orange-700 sm:flex-none"
            >📝 Mock Lain</RouterLink
          >
          <RouterLink
            to="/pusat-nota-ringkas"
            class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-indigo-700 sm:flex-none"
            >📚 Belajar Topik Lemah</RouterLink
          >
        </div>
      </template>
    </div>
  </div>
</template>
