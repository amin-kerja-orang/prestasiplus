<script setup lang="ts">
/**
 * S3 `/practice/:code` "{subject} - Latihan" — pre-start configuration (M05-T4; FR-M05-35…50, BR-11,
 * BR-12, DV-M05-01, DV-M05-11), restyled for v2 (AR-CFG, batch B01).
 *
 * - Back link, trial notice, subject card, three option cards (level, difficulty, count) and the
 *   "Ringkasan" with the availability check; "Mula Kuiz" is a link to Q1.
 * - Availability and the Q1 href follow the live `subjectConfig()` script (`practice-config.ts`).
 * - An unknown code (404) is the global 404 page. `?level=` is ignored: the page always opens with
 *   "Semua Tahap" (FR-M05-34).
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta, usePrototypeScope } from '@/composables'
import { DsIconChip } from '@/ds'
import { formatCount } from '@/lib/number'

import { fetchSubjectConfig } from '../api/practice'
import LoadError from '../components/quiz/LoadError.vue'
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
import { subjectGlyph } from '../components/quiz/subject-glyph'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()
const router = useRouter()
// Prototype scope (D43): "Langgan" (/pricing) is outside the matrix.
const { allows } = usePrototypeScope()
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

const TIPS = [
  'Mulakan dengan tahap mudah untuk biasakan diri',
  'Campurkan kesukaran untuk latihan menyeluruh',
  'Ambil masa untuk faham setiap soalan',
  'Ulang kaji soalan yang salah',
] as const

/** A choice card is a solid primary button when picked, a tonal one otherwise. */
const pick = (on: boolean) => ({ color: on ? 'primary' : 'neutral', variant: on ? 'solid' : 'soft' }) as const
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="practice-config-page">
    <template v-if="config">
      <UButton
        to="/practice"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left-bold"
        class="min-h-11 self-start"
        data-testid="config-back"
        >Kembali ke Senarai Subjek</UButton
      >

      <UAlert
        v-if="config.trial.active"
        color="info"
        variant="soft"
        icon="i-ph-info-duotone"
        data-testid="config-trial"
      >
        <template #description>
          Baki percubaan percuma: <strong>{{ config.trial.remaining }}</strong> soalan lagi.
          <ULink v-if="allows('/pricing')" to="/pricing" class="text-highlighted"
            >Langgan untuk akses tanpa had</ULink
          >
        </template>
      </UAlert>

      <UCard data-testid="config-hero">
        <div class="flex items-center gap-4">
          <DsIconChip
            :icon="subjectGlyph(config.subject.icon)"
            size="lg"
            data-testid="config-icon"
          />
          <div class="flex min-w-0 flex-col gap-1">
            <h1 class="text-title break-words text-highlighted" data-testid="config-name">
              {{ config.subject.name }}
            </h1>
            <p class="text-body text-muted" data-testid="config-total">
              <span class="tabular text-highlighted">{{ formatCount(config.total) }}</span>
              soalan tersedia
            </p>
          </div>
        </div>
      </UCard>

      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-12">
        <div class="flex min-w-0 flex-col gap-4 md:gap-6 lg:col-span-8">
          <!-- Level -->
          <UCard data-testid="config-levels">
            <div class="flex flex-col gap-3">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-graduation-cap-duotone" class="size-6 text-primary" aria-hidden="true" />
                Pilih Tahap Pendidikan
              </h2>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                <UButton
                  v-bind="pick(selectedLevel === null)"
                  class="h-auto min-h-14 justify-start py-2 text-start"
                  :data-selected="selectedLevel === null ? 'true' : 'false'"
                  :aria-pressed="selectedLevel === null"
                  data-testid="level-all"
                  @click="selectedLevel = null"
                >
                  <span class="flex min-w-0 flex-col">
                    <span class="text-label">Semua Tahap</span>
                    <span class="text-caption">{{ formatCount(config.total) }} soalan</span>
                  </span>
                </UButton>
                <UButton
                  v-for="l in config.levels"
                  :key="l.id"
                  v-bind="pick(selectedLevel === l.id)"
                  class="h-auto min-h-14 justify-start py-2 text-start"
                  :data-selected="selectedLevel === l.id ? 'true' : 'false'"
                  :aria-pressed="selectedLevel === l.id"
                  :data-testid="`level-${l.id}`"
                  @click="selectedLevel = l.id"
                >
                  <span class="flex min-w-0 flex-col">
                    <span class="text-label">{{ l.name }}</span>
                    <span class="text-caption">{{ formatCount(l.count) }} soalan</span>
                  </span>
                </UButton>
              </div>
            </div>
          </UCard>

          <!-- Difficulty -->
          <UCard data-testid="config-difficulties">
            <div class="flex flex-col gap-3">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-chart-bar-duotone" class="size-6 text-primary" aria-hidden="true" />
                Pilih Tahap Kesukaran
              </h2>
              <div class="grid grid-cols-2 gap-2 sm:gap-3">
                <UButton
                  v-bind="pick(selectedDifficulty === null)"
                  class="h-auto min-h-14 justify-between py-2 text-start"
                  :data-selected="selectedDifficulty === null ? 'true' : 'false'"
                  :aria-pressed="selectedDifficulty === null"
                  data-testid="difficulty-all"
                  @click="selectedDifficulty = null"
                >
                  <span class="flex min-w-0 flex-col">
                    <span class="text-label">Semua</span>
                    <span class="text-caption">Campuran</span>
                  </span>
                  <span class="tabular text-label" data-testid="difficulty-count">
                    {{ formatCount(currentTotal(config, selectedLevel)) }}
                  </span>
                </UButton>
                <UButton
                  v-for="d in DIFFICULTY_OPTIONS"
                  :key="d.value"
                  v-bind="pick(selectedDifficulty === d.value)"
                  class="h-auto min-h-14 justify-between py-2 text-start"
                  :data-selected="selectedDifficulty === d.value ? 'true' : 'false'"
                  :aria-pressed="selectedDifficulty === d.value"
                  :data-testid="`difficulty-${d.value}`"
                  @click="selectedDifficulty = d.value"
                >
                  <span class="flex min-w-0 flex-col">
                    <span class="text-label">{{ d.label }}</span>
                    <span class="text-caption">Level {{ d.value }}</span>
                  </span>
                  <span class="tabular text-label" data-testid="difficulty-count">
                    {{ formatCount(diffCount(config, selectedLevel, d.value)) }}
                  </span>
                </UButton>
              </div>
            </div>
          </UCard>

          <!-- Count -->
          <UCard data-testid="config-counts">
            <div class="flex flex-col gap-3">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-list-numbers-duotone" class="size-6 text-primary" aria-hidden="true" />
                Bilangan Soalan
              </h2>
              <div class="grid grid-cols-4 gap-2 sm:gap-3">
                <UButton
                  v-for="n in COUNT_OPTIONS"
                  :key="n"
                  v-bind="pick(questionCount === n)"
                  class="h-auto min-h-14 flex-col justify-center gap-0 py-2"
                  :data-selected="questionCount === n ? 'true' : 'false'"
                  :aria-pressed="questionCount === n"
                  :data-testid="`count-${n}`"
                  @click="questionCount = n"
                >
                  <span class="tabular text-heading">{{ n }}</span>
                  <span class="text-caption">soalan</span>
                </UButton>
              </div>
            </div>
          </UCard>
        </div>

        <!-- Summary and tips -->
        <div class="flex min-w-0 flex-col gap-4 md:gap-6 lg:col-span-4">
          <UCard data-testid="config-summary">
            <div class="flex flex-col gap-4">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-info-duotone" class="size-6 text-primary" aria-hidden="true" />
                Ringkasan
              </h2>
              <dl class="flex flex-col gap-2">
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-label text-muted">Tahap Pendidikan:</dt>
                  <dd class="text-end text-label text-highlighted" data-testid="summary-level">
                    {{ levelName(config, selectedLevel) }}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-label text-muted">Kesukaran:</dt>
                  <dd class="text-end text-label text-highlighted" data-testid="summary-difficulty">
                    {{ selectedDifficulty ? DIFFICULTY_NAMES[selectedDifficulty] : 'Semua Tahap' }}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-label text-muted">Bilangan Soalan:</dt>
                  <dd class="tabular text-label text-highlighted" data-testid="summary-count">
                    {{ questionCount }}
                  </dd>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <dt class="text-label text-muted">Soalan Tersedia:</dt>
                  <dd class="tabular text-heading text-primary" data-testid="summary-available">
                    {{ formatCount(available) }}
                  </dd>
                </div>
              </dl>

              <UAlert
                v-if="!canStart"
                color="warning"
                variant="soft"
                icon="i-ph-warning-duotone"
                title="Soalan Tidak Mencukupi"
                description="Kurangkan bilangan soalan atau tukar tetapan penapisan."
                data-testid="config-insufficient"
              />

              <UButton
                :to="href"
                size="lg"
                block
                class="min-h-14"
                :color="canStart ? 'primary' : 'neutral'"
                :variant="canStart ? 'solid' : 'soft'"
                :aria-disabled="canStart ? undefined : 'true'"
                icon="i-ph-play-circle-bold"
                :data-startable="canStart ? 'true' : 'false'"
                data-testid="config-start"
                @click="start"
                >Mula Kuiz</UButton
              >

              <UButton
                v-if="subjectiveCount > 0"
                :to="`/practice/${config.subject.code}/subjektif`"
                color="neutral"
                variant="soft"
                size="lg"
                block
                class="min-h-11"
                icon="i-ph-pencil-simple-line-duotone"
                data-testid="config-subjective"
                >Latihan Subjektif ({{ subjectiveCount }} soalan)</UButton
              >

              <p
                v-if="canStart"
                class="flex items-center justify-center gap-2 text-label text-success"
                data-testid="config-ready"
              >
                <UIcon name="i-ph-check-circle-duotone" class="size-5" aria-hidden="true" />
                <span>Bersedia untuk bermula!</span>
              </p>
            </div>
          </UCard>

          <UCard data-testid="config-tips">
            <div class="flex flex-col gap-3">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-lightbulb-duotone" class="size-6 text-warning" aria-hidden="true" />
                Tips
              </h2>
              <ul class="flex flex-col gap-2">
                <li v-for="tip in TIPS" :key="tip" class="flex items-start gap-3 text-body text-default">
                  <UIcon name="i-ph-check-circle-duotone" class="mt-1 size-5 shrink-0 text-success" aria-hidden="true" />
                  <span>{{ tip }}</span>
                </li>
              </ul>
            </div>
          </UCard>
        </div>
      </div>
    </template>

    <LoadError
      v-else-if="error && !notFound"
      :message="LOAD_ERROR"
      retry-testid="config-retry"
      data-testid="config-error"
      @retry="reload()"
    />
  </div>
</template>
