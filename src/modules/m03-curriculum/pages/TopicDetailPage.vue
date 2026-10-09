<script setup lang="ts">
/**
 * S13 `/topics/:id` "{name} - PRESTASIPLUS" (M03-T4; FR-M03-75..79, BR-16, BR-19). Header "{name}" /
 * "{subject label}", back link, hero, 3 stat cards (3 columns at every width) and one card per
 * subtopic. An unknown topic id renders the global 404 page in place (FR-M03-79).
 */
import {
  ArrowLeft,
  BookOpen,
  ChartLine,
  Circle,
  CircleQuestionMark,
  List,
  Play,
} from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'

import { fetchTopic } from '../api/student-curriculum'
import { LOAD_ERROR, TOPICS_PATH } from '../lib/student-catalogue'

const props = defineProps<{ id: number }>()
const pageMeta = usePageMeta()

const { data: topic, error } = useApi(
  (signal) => fetchTopic(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
    else if (useRouteOutcome().value === 404) setRouteOutcome(null)
  },
  { immediate: true },
)
const loadFailed = computed(() => error.value !== null && !notFound.value)

watch(
  topic,
  (t) => {
    if (!t) return
    pageMeta.setHeader({ title: t.name, subtitle: t.subjectLabel })
    pageMeta.setTitle(`${t.name} - PRESTASIPLUS`)
  },
  { immediate: true },
)

const BADGES = [
  { label: 'Level 1', cls: 'bg-green-100 text-green-700' },
  { label: 'Level 2', cls: 'bg-yellow-100 text-yellow-700' },
  { label: 'Level 3', cls: 'bg-red-100 text-red-700' },
]
</script>

<template>
  <div class="space-y-5" data-testid="topic-detail-page">
    <RouterLink
      :to="TOPICS_PATH"
      class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-purple-600 hover:text-purple-800"
      data-testid="topic-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      Kembali ke Senarai Topik
    </RouterLink>

    <AlertBox v-if="loadFailed" :messages="LOAD_ERROR" data-testid="topic-error" />

    <template v-else-if="topic">
      <section
        class="relative overflow-hidden rounded-3xl bg-gradient-to-r from-purple-500 to-pink-500 p-5 text-white shadow-lg sm:p-8"
        data-testid="topic-hero"
      >
        <div class="flex items-start gap-4">
          <div class="min-w-0 flex-1">
            <h1 class="font-heading text-2xl font-bold break-words sm:text-3xl">{{ topic.name }}</h1>
            <p class="mt-1 text-sm font-semibold text-white/80" data-testid="topic-hero-subject">
              {{ topic.subjectLabel }}
            </p>
            <p
              v-if="topic.description"
              class="mt-3 line-clamp-3 text-sm text-white/90"
              data-testid="topic-hero-description"
            >
              {{ topic.description }}
            </p>
          </div>
          <!-- INFERRED from screenshot (no live classes in inventory): filled bg-white/20 circle, white icon, all widths -->
          <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white/20 sm:h-16 sm:w-16">
            <BookOpen class="h-7 w-7 text-white sm:h-8 sm:w-8" aria-hidden="true" />
          </div>
        </div>
      </section>

      <div class="grid grid-cols-3 gap-3 sm:gap-4" data-testid="topic-stats">
        <div class="rounded-2xl bg-white p-3 text-center shadow sm:p-4">
          <List class="mx-auto h-6 w-6 text-purple-600" aria-hidden="true" data-testid="stat-icon-subtopik" />
          <div class="mt-1 font-heading text-2xl font-bold text-slate-800" data-testid="stat-subtopik">
            {{ topic.subtopics.length }}
          </div>
          <div class="text-xs text-slate-500 sm:text-sm">Subtopik</div>
        </div>
        <div class="rounded-2xl bg-white p-3 text-center shadow sm:p-4">
          <CircleQuestionMark
            class="mx-auto h-6 w-6 text-green-600"
            aria-hidden="true"
            data-testid="stat-icon-dijawab"
          />
          <div class="mt-1 font-heading text-2xl font-bold text-slate-800" data-testid="stat-dijawab">
            {{ topic.progress.questionsAnswered }}
          </div>
          <div class="text-xs text-slate-500 sm:text-sm">Dijawab</div>
        </div>
        <div class="rounded-2xl bg-white p-3 text-center shadow sm:p-4">
          <ChartLine class="mx-auto h-6 w-6 text-amber-600" aria-hidden="true" data-testid="stat-icon-kemajuan" />
          <div class="mt-1 font-heading text-2xl font-bold text-slate-800" data-testid="stat-kemajuan">
            {{ topic.progress.progress }}%
          </div>
          <div class="text-xs text-slate-500 sm:text-sm">Kemajuan</div>
        </div>
      </div>

      <section class="space-y-3">
        <h2 class="font-heading text-xl font-bold text-slate-800">Subtopik</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="subtopic-grid">
          <article
            v-for="(s, i) in topic.subtopics"
            :key="s.id"
            class="flex flex-col rounded-2xl bg-white p-4 shadow"
            data-testid="subtopic-card"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-purple-500 to-pink-500 font-bold text-white"
                data-testid="subtopic-number"
              >
                {{ i + 1 }}
              </span>
              <div class="min-w-0">
                <h3 class="font-heading text-base font-bold break-words text-slate-800" data-testid="subtopic-name">
                  {{ s.name }}
                </h3>
                <p v-if="s.description" class="mt-1 text-sm text-slate-600" data-testid="subtopic-description">
                  {{ s.description }}
                </p>
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <span
                v-for="b in BADGES"
                :key="b.label"
                :class="['inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', b.cls]"
                data-testid="subtopic-badge"
              >
                <Circle class="h-2 w-2 fill-current" aria-hidden="true" />
                {{ b.label }}
              </span>
            </div>
            <div class="mt-3">
              <div class="flex items-center justify-between text-sm">
                <span class="text-slate-600">Kemajuan</span>
                <span class="font-bold text-purple-600" data-testid="subtopic-progress">{{ s.progress }}%</span>
              </div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  class="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                  :style="{ width: `${String(s.progress)}%` }"
                  data-testid="subtopic-bar"
                ></div>
              </div>
            </div>
            <RouterLink
              :to="`/practice/${topic.practiceCode}`"
              class="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-bold text-white"
              data-testid="subtopic-practice"
            >
              <Play class="h-4 w-4" aria-hidden="true" />
              Mula Berlatih
            </RouterLink>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
