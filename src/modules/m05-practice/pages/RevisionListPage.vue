<script setup lang="ts">
/**
 * S6 `/practice/revision` "Soalan Aku Salah" (M05-T5; FR-M05-68…73, BR-14; DV-M05-01, DV-M05-15).
 *
 * - Red banner with the total of queued questions, one card per subject with queued questions
 *   (grid 1 / `sm` 2 / `lg` 3) linking to S7, the amber "Tips Ulang Kaji" box and "Kembali ke Latihan".
 * - The info flash "Tiada soalan salah untuk subjek ini. Tahniah!" (set by S7 for a subject with no
 *   queued question) shows once, between the banner and the cards as on live, and is gone on reload.
 * - No queued question at all: the banner reads "0 soalan perlu diulang kaji" and no card shows (INFERRED, LS-11).
 */
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  CircleCheck,
  CircleX,
  Lightbulb,
  RotateCw,
} from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchRevisionOverview } from '../api/practice'
import SubjectIcon from '../components/quiz/SubjectIcon.vue'
import { takeRevisionFlash } from '../components/revision/revision-flash'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

// Read once when the page opens: the flash is shown once and cleared (FR-M05-72).
const flash = ref<string | null>(takeRevisionFlash())

const { data, error, reload } = useApi((signal) => fetchRevisionOverview({ signal }))
const subjects = computed(() => data.value?.subjects ?? [])
</script>

<template>
  <div class="px-2 py-4 sm:px-4 sm:py-8" data-testid="revision-list-page">
    <div class="mx-auto max-w-4xl">
      <div
        class="relative mb-3 overflow-hidden rounded-2xl bg-gradient-to-r from-red-500 via-orange-500 to-amber-500 p-4 text-white shadow-lg sm:mb-6 sm:p-6"
        data-testid="revision-banner"
      >
        <div
          class="absolute top-0 right-0 h-40 w-40 translate-x-1/2 -translate-y-1/2 rounded-full bg-white/10"
        ></div>
        <div class="relative">
          <div class="mb-2 flex items-center gap-3">
            <div
              class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/20"
            >
              <RotateCw class="h-6 w-6" />
            </div>
            <div>
              <h1 class="font-heading text-sm font-black text-white sm:text-2xl">
                Soalan Aku Salah
              </h1>
              <p class="text-sm text-white/80">Ulang kaji soalan yang pernah dijawab salah</p>
            </div>
          </div>
          <div
            v-if="data"
            class="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-bold"
            data-testid="revision-total"
          >
            <CircleAlert class="h-4 w-4 shrink-0" />
            {{ data.total }} soalan perlu diulang kaji
          </div>
        </div>
      </div>

      <template v-if="data">
        <div
          v-if="flash"
          class="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"
          data-testid="revision-flash"
        >
          <CircleCheck class="mr-1 inline h-4 w-4 align-text-bottom" />
          {{ flash }}
        </div>

        <div
          v-if="subjects.length > 0"
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
          data-testid="revision-grid"
        >
          <RouterLink
            v-for="s in subjects"
            :key="s.code"
            :to="`/practice/revision/${s.code}`"
            class="group rounded-2xl border-2 border-slate-100 bg-white p-5 shadow-sm transition-all hover:border-orange-200 hover:shadow-md"
            :data-testid="`revision-subject-${s.code}`"
          >
            <div class="mb-3 flex items-center gap-3">
              <div
                class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                :style="{ background: `linear-gradient(135deg, ${s.color}66, ${s.color}33)` }"
                data-testid="revision-subject-icon"
              >
                <SubjectIcon :icon="s.icon" class="h-6 w-6 text-xl" :style="{ color: s.color }" />
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="truncate font-bold text-slate-800" data-testid="revision-subject-name">
                  {{ s.name }}
                </h3>
                <p class="text-xs text-slate-500">{{ s.nameEn }}</p>
              </div>
            </div>
            <div class="flex items-center justify-between">
              <span
                class="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700"
                data-testid="revision-subject-count"
              >
                <CircleX class="h-3 w-3" />
                {{ s.count }} soalan salah
              </span>
              <span class="text-orange-500 transition-transform group-hover:translate-x-1">
                <ArrowRight class="h-4 w-4" />
              </span>
            </div>
          </RouterLink>
        </div>

        <div
          class="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"
          data-testid="revision-tips"
        >
          <p class="mb-1 text-sm font-semibold text-amber-800">
            <Lightbulb class="mr-1 inline h-4 w-4 align-text-bottom" /> Tips Ulang Kaji
          </p>
          <ul class="space-y-1 text-sm text-amber-700">
            <li>Soalan yang paling kerap dijawab salah akan dipaparkan dahulu</li>
            <li>Apabila anda jawab betul, soalan itu akan dikeluarkan dari senarai ini</li>
            <li>Anda tetap mendapat syiling dan coin seperti latihan biasa</li>
          </ul>
        </div>

        <div class="mt-6 text-center">
          <RouterLink
            to="/practice"
            class="inline-flex items-center text-sm font-semibold text-slate-500 hover:text-slate-700 max-lg:min-h-11"
            data-testid="revision-back"
          >
            <ArrowLeft class="mr-1 h-4 w-4" /> Kembali ke Latihan
          </RouterLink>
        </div>
      </template>

      <div v-else-if="error" class="max-w-xl space-y-3" data-testid="revision-error">
        <AlertBox :messages="LOAD_ERROR" />
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
          data-testid="revision-retry"
          @click="reload()"
        >
          Cuba Semula
        </button>
      </div>
    </div>
  </div>
</template>
