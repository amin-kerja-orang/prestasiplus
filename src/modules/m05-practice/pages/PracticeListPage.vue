<script setup lang="ts">
/**
 * S2 `/practice` "Latih Tubi" (M05-T4; FR-M05-29…34, BR-28, DV-M05-03, DV-M05-11).
 *
 * - Hero "Latih Tubi 🎯" with four bouncing circles, the "Soalan by Chapter" banner → `/practice/chapter`.
 * - One card per practice subject (#2; grid 1 / `md` 2 / `lg` 3), each a link to `/practice/{CODE}`.
 *   The "Mula Latihan" element is a `<button>` inside the link with no handler of its own, as live
 *   (D-14 replicated, D10): a click follows the card link.
 * - `?subject={CODE}` and `?topic_id={id}` replace the URL with the subject's S3; `?level=` is ignored.
 */
import {
  ArrowRight,
  Brain,
  Crown,
  GraduationCap,
  PlayCircle,
  Rocket,
  Star,
  Trophy,
} from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchPracticeSubjects } from '../api/practice'
import { entryTarget } from '../components/quiz/entry-params'
import SubjectIcon from '../components/quiz/SubjectIcon.vue'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()
const router = useRouter()

const { data, error, reload } = useApi((signal) => fetchPracticeSubjects({ signal }))
const subjects = computed(() => data.value?.data ?? [])

// FR-M05-33: replace the URL when the entry parameter names a known subject.
watch(
  [() => data.value, () => route.query],
  async ([loaded, query]) => {
    if (!loaded) return
    const codes = loaded.data.map((s) => s.code)
    const target = await entryTarget(query, codes)
    if (target && route.path === '/practice') void router.replace(target)
  },
  { immediate: true },
)

const HERO_CIRCLES = [
  { icon: GraduationCap, from: 'from-pink-400', to: 'to-pink-500', delay: '0s' },
  { icon: Star, from: 'from-yellow-400', to: 'to-yellow-500', delay: '0.2s' },
  { icon: Trophy, from: 'from-green-400', to: 'to-green-500', delay: '0.4s' },
  { icon: Rocket, from: 'from-blue-400', to: 'to-blue-500', delay: '0.6s' },
] as const
</script>

<template>
  <div
    class="m05-practice-list min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8"
    data-testid="practice-list-page"
  >
    <div class="mx-auto">
      <!-- Hero -->
      <div class="relative mx-auto mb-4 text-center sm:mb-8" data-testid="practice-hero">
        <div
          class="m05-float absolute top-0 left-0 -z-10 h-32 w-32 rounded-full bg-gradient-to-br from-pink-200 to-pink-300 opacity-20 blur-2xl"
        ></div>
        <div
          class="m05-float-delayed absolute top-0 right-0 -z-10 h-40 w-40 rounded-full bg-gradient-to-br from-blue-200 to-blue-300 opacity-20 blur-2xl"
        ></div>

        <h1
          class="m05-gradient-flow mb-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 bg-clip-text font-heading text-2xl font-extrabold text-transparent sm:mb-3 sm:text-5xl"
          data-testid="practice-title"
        >
          Latih Tubi 🎯
        </h1>
        <p class="mb-2 text-sm font-semibold text-slate-600 sm:mb-4 sm:text-base md:text-lg">
          Pilih subjek dan mula berlatih!
        </p>

        <div class="mt-2 flex justify-center gap-2 sm:mt-4 sm:gap-3" data-testid="practice-circles">
          <div
            v-for="c in HERO_CIRCLES"
            :key="c.delay"
            :class="[
              'm05-bounce-slow flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br shadow-lg sm:h-10 sm:w-10',
              c.from,
              c.to,
            ]"
            :style="{ animationDelay: c.delay }"
          >
            <component :is="c.icon" class="h-4 w-4 text-white sm:h-5 sm:w-5" />
          </div>
        </div>
      </div>

      <template v-if="data">
        <!-- Chapter banner -->
        <div class="mx-auto mb-5 sm:mb-8">
          <RouterLink
            to="/practice/chapter"
            class="block rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-5 text-white shadow-xl transition hover:-translate-y-1 hover:shadow-2xl sm:p-6"
            data-testid="chapter-banner"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p class="text-xs font-black tracking-[0.25em] text-cyan-100 uppercase">
                  Mode Baru
                </p>
                <h2 class="mt-1 font-heading text-xl font-black text-white sm:text-2xl">
                  Soalan by Chapter
                </h2>
                <p class="mt-2 text-sm text-cyan-50">
                  Jawab bab demi bab ikut buku teks dan DSKP. Bab seterusnya terkunci sehingga bab
                  semasa lengkap.
                </p>
              </div>
              <div
                class="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/15 px-4 py-2.5 text-sm font-black"
              >
                Mula <ArrowRight class="ml-2 h-4 w-4" />
              </div>
            </div>
          </RouterLink>
        </div>

        <!-- Subject cards -->
        <div class="mx-auto">
          <div
            class="grid grid-cols-1 gap-3 sm:gap-5 md:grid-cols-2 lg:grid-cols-3"
            data-testid="subject-grid"
          >
            <RouterLink
              v-for="s in subjects"
              :key="s.code"
              :to="`/practice/${s.code}`"
              class="group block"
              :data-testid="`subject-card-${s.code}`"
            >
              <div
                class="relative transform overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:scale-105"
              >
                <div
                  class="absolute inset-0 -z-10 rounded-2xl opacity-0 blur-md transition-opacity duration-300 group-hover:opacity-100"
                  :style="{ background: s.color }"
                ></div>

                <div
                  class="relative rounded-2xl border-2 bg-white p-4 shadow-xl transition-all duration-300 sm:p-6"
                  :style="{ borderColor: s.color }"
                >
                  <div class="mb-2 flex items-start justify-between sm:mb-4">
                    <div class="relative">
                      <div
                        class="flex h-12 w-12 transform items-center justify-center rounded-full shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:rotate-6 sm:h-16 sm:w-16"
                        :style="{
                          background: `linear-gradient(135deg, ${s.color}20, ${s.color}40)`,
                        }"
                        data-testid="subject-icon"
                      >
                        <SubjectIcon
                          :icon="s.icon"
                          class="h-6 w-6 text-xl sm:h-8 sm:w-8 sm:text-3xl"
                          :style="{ color: s.color }"
                        />
                      </div>
                    </div>

                    <span
                      v-if="s.isCore"
                      class="inline-flex items-center rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-3 py-1.5 text-xs font-bold text-white shadow-md"
                      data-testid="subject-core"
                    >
                      <Crown class="mr-1 h-3 w-3" />
                      Teras
                    </span>
                  </div>

                  <div class="mb-3">
                    <h3
                      class="mb-1 font-heading text-sm font-extrabold break-words text-slate-800 sm:text-2xl"
                      data-testid="subject-name"
                    >
                      {{ s.name }}
                    </h3>
                    <p class="text-xs font-medium text-slate-500">{{ s.nameEn }}</p>
                  </div>

                  <div class="mb-2 sm:mb-4">
                    <div
                      class="inline-flex items-center rounded-xl border-2 border-slate-200 bg-gradient-to-r from-slate-50 to-slate-100 px-3 py-2 shadow-sm"
                    >
                      <Brain class="mr-2 h-4 w-4 text-slate-500" />
                      <span class="text-sm text-slate-700" data-testid="subject-count">
                        <span class="font-extrabold text-slate-900">{{
                          formatCount(s.approvedCount)
                        }}</span>
                        soalan
                      </span>
                    </div>
                  </div>

                  <div class="relative overflow-hidden rounded-xl">
                    <button
                      type="button"
                      class="relative min-h-11 w-full overflow-hidden rounded-xl px-4 py-2.5 font-bold text-white shadow-lg transition-all duration-300 sm:px-6 sm:py-3.5"
                      :style="{ background: s.color }"
                      data-testid="subject-start"
                    >
                      <span
                        class="relative z-10 flex items-center justify-center text-sm sm:text-base"
                      >
                        <PlayCircle class="mr-2 h-5 w-5" />
                        Mula Latihan
                        <ArrowRight
                          class="ml-2 h-4 w-4 transform transition-transform duration-300 group-hover:translate-x-2"
                        />
                      </span>
                    </button>
                  </div>
                </div>
              </div>
            </RouterLink>
          </div>
        </div>
      </template>

      <div v-else-if="error" class="mx-auto max-w-xl space-y-3" data-testid="practice-error">
        <AlertBox :messages="LOAD_ERROR" />
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
          data-testid="practice-retry"
          @click="reload()"
        >
          Cuba Semula
        </button>
      </div>
    </div>
  </div>
</template>

<style>
/* S2 hero animations (live `animate-bounce-slow`, `animate-float`, gradient flow). */
:where(.m05-practice-list) .m05-bounce-slow {
  animation: m05-bounce-slow 2s ease-in-out infinite;
}
:where(.m05-practice-list) .m05-float {
  animation: m05-float 6s ease-in-out infinite;
}
:where(.m05-practice-list) .m05-float-delayed {
  animation: m05-float 6s ease-in-out infinite;
  animation-delay: 1s;
}
:where(.m05-practice-list) .m05-gradient-flow {
  background-size: 200% auto;
  animation: m05-gradient-flow 6s ease infinite;
}

@keyframes m05-bounce-slow {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}
@keyframes m05-float {
  0%,
  100% {
    transform: translateY(0) translateX(0);
  }
  50% {
    transform: translateY(-20px) translateX(10px);
  }
}
@keyframes m05-gradient-flow {
  0%,
  100% {
    background-position: 0% center;
  }
  50% {
    background-position: 100% center;
  }
}
</style>
