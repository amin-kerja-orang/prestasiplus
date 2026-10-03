<script setup lang="ts">
/**
 * S4 `/spm/latih-tubi/:code` "Tetapan Kuiz" (M06-T2; FR-M06-25…31, BR-M06-03/04/07, DV-M06-01/03/08).
 *
 * Tingkatan (10 / 11, click again clears), "Tahap Kesukaran" (keys 2–5 as live; 2 per row below 640px,
 * DV-M06-08), "Bilangan Soalan" (the target option, or 5–60) and "Mula Kuiz", a link whose href follows
 * every change. An unknown code (404) is the global 404 page. BA stays reachable although S3 locks it.
 */
import { ArrowLeft, Cog, PlayCircle } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchLatihTubiConfig } from '../api'
import LoadError from '../components/LoadError.vue'
import SubjectIcon from '../components/SubjectIcon.vue'
import {
  DIFFICULTY_OPTIONS,
  LEVEL_OPTIONS,
  diffCount,
  quizHref,
  targetName,
  type DifficultyKey,
  type LevelKey,
} from '../lib/latih-tubi'

const route = useRoute()
const pageMeta = usePageMeta()

const code = computed(() => String(route.params.code ?? ''))
const {
  data: config,
  error,
  reload,
} = useApi((signal) => fetchLatihTubiConfig(code.value, { signal }), code)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

// DV-M06-07: tab title and header "Latih Tubi SPM — {Subjek}", no subtitle.
watch(
  config,
  (c) => {
    if (!c) return
    pageMeta.setTitle(`Latih Tubi SPM — ${c.name}`)
    pageMeta.setHeader({ title: `Latih Tubi SPM — ${c.name}` })
  },
  { immediate: true },
)

const selectedLevel = ref<LevelKey | null>(null)
const selectedDifficulty = ref<DifficultyKey | null>(null)
const questionCount = ref(10)

// A new subject starts from its defaults.
watch(
  config,
  (c) => {
    selectedLevel.value = null
    selectedDifficulty.value = null
    questionCount.value = c?.defaultCount ?? 10
  },
  { immediate: true },
)

const toggleLevel = (k: LevelKey) => {
  selectedLevel.value = selectedLevel.value === k ? null : k
}
const toggleDifficulty = (k: DifficultyKey) => {
  selectedDifficulty.value = selectedDifficulty.value === k ? null : k
}

const href = computed(() =>
  config.value
    ? quizHref(
        config.value.code,
        questionCount.value,
        selectedLevel.value,
        selectedDifficulty.value,
      )
    : '#',
)

const hasTarget = computed(
  () => config.value?.targetType != null && config.value.targetSize != null,
)
const typeName = computed(() =>
  config.value?.targetType ? targetName(config.value.targetType) : '',
)

const CARD = 'rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6'
const LABEL = 'mb-3 text-sm font-bold text-slate-700'
const OPTION = 'min-h-11 rounded-xl border-2 p-3 text-center transition'
const OFF = 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
const ON = 'border-blue-500 bg-blue-50 shadow-md'
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="spm-config-page">
    <div v-if="config" class="mx-auto max-w-3xl">
      <RouterLink
        to="/spm/latih-tubi"
        class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        data-testid="spm-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali
      </RouterLink>

      <div class="mb-5 flex items-center gap-3 sm:mb-6">
        <div
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
          :style="{ background: `${config.color}22`, color: config.color }"
          data-testid="config-icon"
        >
          <SubjectIcon :icon="config.icon" class="h-7 w-7" />
        </div>
        <div class="min-w-0">
          <h1
            class="font-heading text-2xl font-extrabold break-words text-slate-800"
            data-testid="config-title"
          >
            {{ config.name }}
          </h1>
          <p class="text-sm text-slate-600" data-testid="config-sub">
            {{ formatCount(config.total) }} soalan tersedia<template v-if="hasTarget">
              · Target {{ typeName }} set: {{ config.targetSize }} soalan</template
            >
          </p>
        </div>
      </div>

      <div :class="CARD" data-testid="config-card">
        <h2 class="mb-5 flex items-center gap-2 font-heading text-lg font-extrabold text-slate-800">
          <Cog class="h-5 w-5 text-slate-500" aria-hidden="true" />
          Tetapan Kuiz
        </h2>

        <!-- Tingkatan -->
        <div class="mb-6">
          <h3 :class="LABEL">Tingkatan</h3>
          <div class="grid grid-cols-2 gap-3" data-testid="config-levels">
            <button
              v-for="l in LEVEL_OPTIONS"
              :key="l.key"
              type="button"
              :class="[OPTION, selectedLevel === l.key ? ON : OFF]"
              :aria-pressed="selectedLevel === l.key"
              :data-testid="`level-${String(l.key)}`"
              @click="toggleLevel(l.key)"
            >
              <span class="block text-sm font-bold">{{ l.label }}</span>
              <span class="block text-xs text-slate-500" data-testid="level-count">
                {{ formatCount(config.levelCounts[String(l.key) as '10' | '11']) }} soalan
              </span>
            </button>
          </div>
        </div>

        <!-- Tahap Kesukaran -->
        <div class="mb-6">
          <h3 :class="LABEL">Tahap Kesukaran</h3>
          <div class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="config-difficulties">
            <button
              v-for="d in DIFFICULTY_OPTIONS"
              :key="d.key"
              type="button"
              :class="[OPTION, 'min-w-0 break-words', selectedDifficulty === d.key ? d.on : OFF]"
              :aria-pressed="selectedDifficulty === d.key"
              :data-testid="`difficulty-${String(d.key)}`"
              @click="toggleDifficulty(d.key)"
            >
              <span class="block text-sm font-bold">{{ d.label }}</span>
              <span class="block text-xs" data-testid="difficulty-count">
                {{ diffCount(config, selectedLevel, d.key) }} soalan
              </span>
            </button>
          </div>
          <p class="mt-2 text-xs text-slate-500">Biarkan kosong untuk campuran semua tahap</p>
        </div>

        <!-- Bilangan Soalan -->
        <div class="mb-6">
          <h3 :class="LABEL">Bilangan Soalan</h3>
          <div class="flex flex-wrap gap-2" data-testid="config-counts">
            <button
              v-for="o in config.countOptions"
              :key="o.value"
              type="button"
              :class="[
                'min-h-11 rounded-xl border-2 px-4 py-2 text-sm font-bold transition',
                questionCount === o.value
                  ? 'border-blue-500 bg-blue-500 text-white shadow-md'
                  : o.isTarget
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                    : OFF,
              ]"
              :data-testid="`count-${String(o.value)}`"
              @click="questionCount = o.value"
            >
              {{ o.label }}
            </button>
          </div>
          <p v-if="hasTarget" class="mt-2 text-xs text-slate-500" data-testid="config-helper">
            Set penuh target {{ config.targetType }} untuk {{ config.name }} disasar pada
            {{ config.targetSize }} soalan.
          </p>
          <p v-else class="mt-2 text-xs text-slate-500" data-testid="config-helper">
            Pilih bilangan soalan ikut keperluan latihan anda.
          </p>
        </div>

        <RouterLink
          :to="href"
          class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:from-blue-700 hover:to-indigo-700"
          data-testid="config-start"
        >
          <PlayCircle class="h-5 w-5" aria-hidden="true" />
          Mula Kuiz
        </RouterLink>
      </div>
    </div>
    <LoadError v-else-if="error && !notFound" @retry="reload()" />
    <div
      v-else-if="!error"
      class="mx-auto max-w-3xl space-y-3"
      aria-busy="true"
      data-testid="spm-skeleton"
    >
      <div class="h-20 animate-pulse rounded-2xl bg-slate-100"></div>
      <div class="h-96 animate-pulse rounded-2xl bg-slate-100"></div>
    </div>
  </div>
</template>
