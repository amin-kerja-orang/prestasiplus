<script setup lang="ts">
/**
 * S3 `/practice/:code` "{subject} - Latihan" — pre-start configuration (M05-T4; FR-M05-35…50, BR-11,
 * BR-12, DV-M05-01, DV-M05-11).
 *
 * - Back link, trial notice, subject hero, three option cards (level, difficulty, count) and the
 *   sticky "Ringkasan" with the availability check; "Mula Kuiz" is a link to Q1.
 * - Availability and the Q1 href follow the live `subjectConfig()` script (`practice-config.ts`).
 * - An unknown code (404) is the global 404 page. `?level=` is ignored: the page always opens with
 *   "Semua Tahap" (FR-M05-34).
 * - DV-M05-11: the live 10/11 px texts are 12 px (`text-xs`).
 */
import {
  ArrowLeft,
  Check,
  CircleCheck,
  CircleQuestionMark,
  GraduationCap,
  Info,
  Infinity as InfinityIcon,
  Lightbulb,
  ListOrdered,
  Pen,
  PlayCircle,
  Signal,
  Star,
  TriangleAlert,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchSubjectConfig } from '../api/practice'
import {
  availableQuestions,
  COUNT_OPTIONS,
  currentTotal,
  DEFAULT_COUNT,
  DIFFICULTY_NAMES,
  DIFFICULTY_OPTIONS,
  diffCount,
  levelName,
  quizUrl,
} from '../components/quiz/practice-config'
import SubjectIcon from '../components/quiz/SubjectIcon.vue'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const code = computed(() => String(route.params.code ?? ''))
const {
  data: config,
  error,
  reload,
} = useApi((signal) => fetchSubjectConfig(code.value, { signal }), code)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

// FR-M05-35: the tab title is "{subject name} - Latihan" (the shell header comes from the route).
watch(
  config,
  (c) => {
    if (c) pageMeta.setTitle(`${c.subject.name} - Latihan`)
  },
  { immediate: true },
)

const selectedLevel = ref<number | null>(null)
const selectedDifficulty = ref<number | null>(null)
const questionCount = ref<number>(DEFAULT_COUNT)

// A new subject starts from the defaults again.
watch(code, () => {
  selectedLevel.value = null
  selectedDifficulty.value = null
  questionCount.value = DEFAULT_COUNT
})

const available = computed(() =>
  config.value
    ? availableQuestions(config.value, selectedLevel.value, selectedDifficulty.value)
    : 0,
)
const canStart = computed(() => available.value >= questionCount.value)
const href = computed(() =>
  config.value
    ? quizUrl(
        config.value.subject.code,
        selectedLevel.value,
        selectedDifficulty.value,
        questionCount.value,
      )
    : '#',
)
const subjectiveCount = computed(() =>
  config.value && selectedLevel.value !== null
    ? (config.value.subjectiveCounts[String(selectedLevel.value)] ?? 0)
    : 0,
)

/** `window.location.href = quizUrl` on live, only when startable (FR-M05-45/46). */
function start(event: MouseEvent): void {
  if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return
  event.preventDefault()
  if (canStart.value) void router.push(href.value)
}

const SELECT_BASE = 'rounded-xl p-2.5 text-left transition-all duration-300 sm:p-4'
const OPTION_ON = 'bg-indigo-600 text-white ring-2 ring-indigo-300 shadow-md'
const OPTION_OFF =
  'border-2 border-slate-200 bg-white text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'
const CARD = 'rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:rounded-2xl sm:p-6'
const CARD_TITLE =
  'mb-3 flex items-center gap-2 text-xs font-bold text-slate-800 sm:mb-4 sm:gap-3 sm:text-lg'
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="practice-config-page">
    <div v-if="config" class="mx-auto">
      <!-- Back -->
      <div class="mb-3 sm:mb-6">
        <RouterLink
          to="/practice"
          class="group inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-800 sm:text-sm"
          data-testid="config-back"
        >
          <ArrowLeft class="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          <span>Kembali ke Senarai Subjek</span>
        </RouterLink>
      </div>

      <!-- Trial -->
      <div
        v-if="config.trial.active"
        class="mb-6 rounded-xl border border-blue-200 bg-blue-50 p-3"
        data-testid="config-trial"
      >
        <div class="flex flex-wrap items-center gap-2 text-sm text-blue-700">
          <Info class="h-4 w-4 shrink-0" />
          <span
            >Baki percubaan percuma: <strong>{{ config.trial.remaining }}</strong> soalan
            lagi.</span
          >
          <RouterLink to="/pricing" class="font-semibold underline hover:text-blue-900"
            >Langgan untuk akses tanpa had</RouterLink
          >
        </div>
      </div>

      <!-- Hero -->
      <div
        class="relative mb-3 overflow-hidden rounded-xl border border-slate-100 bg-white p-3 shadow-sm sm:mb-8 sm:rounded-2xl sm:p-8"
        data-testid="config-hero"
      >
        <div
          class="absolute top-0 right-0 h-40 w-40 rounded-full opacity-20 blur-3xl sm:h-64 sm:w-64"
          :style="{ background: `radial-gradient(circle, ${config.subject.color}, transparent)` }"
        ></div>
        <div class="relative flex items-center gap-3 sm:gap-6">
          <div
            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl text-xl shadow-md sm:h-24 sm:w-24 sm:rounded-2xl sm:text-5xl"
            :style="{
              background: `linear-gradient(135deg, ${config.subject.color}20, ${config.subject.color}05)`,
              color: config.subject.color,
            }"
            data-testid="config-icon"
          >
            <SubjectIcon :icon="config.subject.icon" class="h-6 w-6 sm:h-12 sm:w-12" />
          </div>
          <div class="min-w-0">
            <h1
              class="mb-1 text-base leading-tight font-bold break-words text-slate-800 sm:mb-2 sm:text-3xl"
              data-testid="config-name"
            >
              {{ config.subject.name }}
            </h1>
            <div
              class="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-1 text-indigo-700 sm:gap-2 sm:px-4 sm:py-2"
              data-testid="config-total"
            >
              <CircleQuestionMark class="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span class="text-xs font-semibold sm:text-base">{{
                formatCount(config.total)
              }}</span>
              <span class="text-xs sm:text-sm">soalan tersedia</span>
            </div>
          </div>
        </div>
      </div>

      <div class="grid gap-3 sm:gap-6 lg:grid-cols-3">
        <!-- Left: options -->
        <div class="min-w-0 space-y-6 lg:col-span-2">
          <!-- Level -->
          <div :class="CARD" data-testid="config-levels">
            <h2 :class="CARD_TITLE">
              <GraduationCap class="h-4 w-4 text-indigo-600 sm:h-5 sm:w-5" />
              Pilih Tahap Pendidikan
            </h2>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              <button
                type="button"
                :class="[SELECT_BASE, selectedLevel === null ? OPTION_ON : OPTION_OFF]"
                :data-selected="selectedLevel === null ? 'true' : 'false'"
                data-testid="level-all"
                @click="selectedLevel = null"
              >
                <div class="flex items-center gap-2 sm:gap-3">
                  <div
                    :class="[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10',
                      selectedLevel === null ? 'bg-white/20' : 'bg-indigo-100',
                    ]"
                  >
                    <InfinityIcon
                      :class="[
                        'h-4 w-4',
                        selectedLevel === null ? 'text-white' : 'text-indigo-600',
                      ]"
                    />
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs leading-tight font-semibold sm:text-sm">Semua Tahap</div>
                    <div class="text-xs opacity-75">{{ formatCount(config.total) }} soalan</div>
                  </div>
                </div>
              </button>

              <button
                v-for="l in config.levels"
                :key="l.id"
                type="button"
                :class="[SELECT_BASE, selectedLevel === l.id ? OPTION_ON : OPTION_OFF]"
                :data-selected="selectedLevel === l.id ? 'true' : 'false'"
                :data-testid="`level-${l.id}`"
                @click="selectedLevel = l.id"
              >
                <div class="flex items-center gap-2 sm:gap-3">
                  <div
                    :class="[
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold sm:h-10 sm:w-10 sm:text-sm',
                      selectedLevel === l.id
                        ? 'bg-white/20 text-white'
                        : 'bg-purple-100 text-purple-700',
                    ]"
                  >
                    {{ l.code }}
                  </div>
                  <div class="min-w-0">
                    <div class="text-xs leading-tight font-semibold sm:text-sm">{{ l.name }}</div>
                    <div class="text-xs opacity-75">{{ formatCount(l.count) }} soalan</div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Difficulty -->
          <div :class="CARD" data-testid="config-difficulties">
            <h2 :class="CARD_TITLE">
              <Signal class="h-4 w-4 text-indigo-600 sm:h-5 sm:w-5" />
              Pilih Tahap Kesukaran
            </h2>
            <div class="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                :class="[
                  SELECT_BASE,
                  selectedDifficulty === null
                    ? 'bg-slate-600 text-white shadow-md ring-2 ring-slate-300'
                    : 'border-2 border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                ]"
                :data-selected="selectedDifficulty === null ? 'true' : 'false'"
                data-testid="difficulty-all"
                @click="selectedDifficulty = null"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div
                      :class="[
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10',
                        selectedDifficulty === null ? 'bg-white/20' : 'bg-slate-100',
                      ]"
                    >
                      <InfinityIcon
                        :class="[
                          'h-4 w-4',
                          selectedDifficulty === null ? 'text-white' : 'text-slate-600',
                        ]"
                      />
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs leading-tight font-semibold sm:text-sm">Semua</div>
                      <div class="text-xs opacity-75">Campuran</div>
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="text-xs font-bold sm:text-sm" data-testid="difficulty-count">
                      {{ formatCount(currentTotal(config, selectedLevel)) }}
                    </div>
                  </div>
                </div>
              </button>

              <button
                v-for="d in DIFFICULTY_OPTIONS"
                :key="d.value"
                type="button"
                :class="[
                  SELECT_BASE,
                  selectedDifficulty === d.value
                    ? d.selected
                    : `border-2 border-slate-200 bg-white text-slate-700 ${d.hover}`,
                ]"
                :data-selected="selectedDifficulty === d.value ? 'true' : 'false'"
                :data-testid="`difficulty-${d.value}`"
                @click="selectedDifficulty = d.value"
              >
                <div class="flex items-center justify-between gap-2">
                  <div class="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div
                      :class="[
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-10 sm:w-10',
                        selectedDifficulty === d.value ? 'bg-white/20' : d.tile,
                      ]"
                    >
                      <Star
                        :class="['h-4 w-4', selectedDifficulty === d.value ? 'text-white' : d.icon]"
                      />
                    </div>
                    <div class="min-w-0">
                      <div class="text-xs leading-tight font-semibold sm:text-sm">
                        {{ d.label }}
                      </div>
                      <div
                        :class="[
                          'text-xs font-medium',
                          selectedDifficulty === d.value ? 'text-white/80' : d.sub,
                        ]"
                      >
                        Level {{ d.value }}
                      </div>
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="text-xs font-bold sm:text-sm" data-testid="difficulty-count">
                      {{ formatCount(diffCount(config, selectedLevel, d.value)) }}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Count -->
          <div :class="CARD" data-testid="config-counts">
            <h2 :class="CARD_TITLE">
              <ListOrdered class="h-4 w-4 text-indigo-600 sm:h-5 sm:w-5" />
              Bilangan Soalan
            </h2>
            <div class="grid grid-cols-4 gap-2 sm:gap-3">
              <button
                v-for="n in COUNT_OPTIONS"
                :key="n"
                type="button"
                :class="[
                  'rounded-xl p-2.5 transition-all duration-300 sm:p-4',
                  questionCount === n ? OPTION_ON : OPTION_OFF,
                ]"
                :data-selected="questionCount === n ? 'true' : 'false'"
                :data-testid="`count-${n}`"
                @click="questionCount = n"
              >
                <div class="text-lg font-bold sm:text-3xl">{{ n }}</div>
                <div class="mt-0.5 text-xs opacity-75">soalan</div>
              </button>
            </div>
          </div>
        </div>

        <!-- Right: summary and tips -->
        <div class="min-w-0 space-y-3 sm:space-y-6">
          <div
            class="sticky top-6 rounded-xl border border-slate-100 bg-white p-3 shadow-lg sm:rounded-2xl sm:p-6"
            data-testid="config-summary"
          >
            <h3
              class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 sm:mb-4 sm:text-lg"
            >
              <Info class="h-4 w-4 text-indigo-600 sm:h-5 sm:w-5" />
              Ringkasan
            </h3>

            <div class="mb-3 space-y-2 sm:mb-6 sm:space-y-3">
              <div
                class="flex items-center justify-between gap-3 border-b border-slate-100 py-2 sm:py-3"
              >
                <span class="text-xs font-medium text-slate-500 sm:text-sm">Tahap Pendidikan:</span>
                <span
                  class="text-right text-xs font-semibold text-slate-800 sm:text-sm"
                  data-testid="summary-level"
                  >{{ levelName(config, selectedLevel) }}</span
                >
              </div>
              <div
                class="flex items-center justify-between gap-3 border-b border-slate-100 py-2 sm:py-3"
              >
                <span class="text-xs font-medium text-slate-500 sm:text-sm">Kesukaran:</span>
                <span
                  class="text-right text-xs font-semibold text-slate-800 sm:text-sm"
                  data-testid="summary-difficulty"
                  >{{
                    selectedDifficulty ? DIFFICULTY_NAMES[selectedDifficulty] : 'Semua Tahap'
                  }}</span
                >
              </div>
              <div
                class="flex items-center justify-between gap-3 border-b border-slate-100 py-2 sm:py-3"
              >
                <span class="text-xs font-medium text-slate-500 sm:text-sm">Bilangan Soalan:</span>
                <span
                  class="text-xs font-semibold text-slate-800 sm:text-sm"
                  data-testid="summary-count"
                  >{{ questionCount }}</span
                >
              </div>
              <div class="flex items-center justify-between gap-3 py-2 sm:py-3">
                <span class="text-xs font-medium text-slate-500 sm:text-sm">Soalan Tersedia:</span>
                <span
                  class="text-sm font-bold text-indigo-600 sm:text-xl"
                  data-testid="summary-available"
                  >{{ formatCount(available) }}</span
                >
              </div>
            </div>

            <div
              v-if="!canStart"
              class="mb-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-4"
              data-testid="config-insufficient"
            >
              <div class="flex items-start gap-3">
                <TriangleAlert class="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                <div class="text-sm text-amber-800">
                  <div class="mb-1 font-bold">Soalan Tidak Mencukupi</div>
                  <div class="text-amber-700">
                    Kurangkan bilangan soalan atau tukar tetapan penapisan.
                  </div>
                </div>
              </div>
            </div>

            <a
              :href="href"
              :class="[
                'group relative block min-h-11 w-full overflow-hidden rounded-xl py-3 text-center text-sm font-bold text-white transition-all duration-300 sm:py-4 sm:text-lg',
                canStart
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg hover:scale-105 hover:from-green-600 hover:to-emerald-600 hover:shadow-xl'
                  : 'cursor-not-allowed bg-slate-300',
              ]"
              :data-startable="canStart ? 'true' : 'false'"
              data-testid="config-start"
              @click="start"
            >
              <span class="relative flex items-center justify-center gap-2">
                <PlayCircle class="h-5 w-5" />
                <span>Mula Kuiz</span>
              </span>
            </a>

            <RouterLink
              v-if="subjectiveCount > 0"
              :to="`/practice/${config.subject.code}/subjektif`"
              class="mt-3 flex min-h-11 w-full items-center justify-center rounded-xl border-2 border-indigo-300 bg-indigo-50 py-3 text-center font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              data-testid="config-subjective"
            >
              <Pen class="mr-2 h-4 w-4" />
              Latihan Subjektif ({{ subjectiveCount }} soalan)
            </RouterLink>

            <div v-if="canStart" class="mt-4 text-center" data-testid="config-ready">
              <div
                class="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600"
              >
                <CircleCheck class="h-4 w-4" />
                <span>Bersedia untuk bermula!</span>
              </div>
            </div>
          </div>

          <div :class="CARD" data-testid="config-tips">
            <h3
              class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800 sm:mb-4 sm:text-lg"
            >
              <Lightbulb class="h-4 w-4 text-yellow-500 sm:h-5 sm:w-5" />
              Tips
            </h3>
            <ul class="space-y-2 text-xs text-slate-600 sm:space-y-3 sm:text-sm">
              <li class="flex items-start gap-3">
                <Check class="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                <span>Mulakan dengan tahap mudah untuk biasakan diri</span>
              </li>
              <li class="flex items-start gap-3">
                <Check class="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                <span>Campurkan kesukaran untuk latihan menyeluruh</span>
              </li>
              <li class="flex items-start gap-3">
                <Check class="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                <span>Ambil masa untuk faham setiap soalan</span>
              </li>
              <li class="flex items-start gap-3">
                <Check class="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
                <span>Ulang kaji soalan yang salah</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="error && !notFound"
      class="mx-auto max-w-xl space-y-3"
      data-testid="config-error"
    >
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        data-testid="config-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>
  </div>
</template>
