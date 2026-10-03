<script setup lang="ts">
/**
 * S12 `/topics` "Topik - PRESTASIPLUS" (M03-T4; FR-M03-69..74, BR-13). Grade and subject chips (each
 * keeps the other filter), then every matching topic on one page in a 1 / 2 (`sm`) / 3 (`lg`)
 * column grid. No loading state: the content area stays empty until the data is ready (SRS §8).
 */
import { BookOpen, CircleCheck, Eye } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchTopics } from '../api/student-curriculum'
import {
  EMPTY_TOPICS,
  GRADE_CHIPS,
  LOAD_ERROR,
  SUBJECT_CHIPS,
  moreSubtopics,
  readFilter,
  topicPath,
  topicsTo,
} from '../lib/student-catalogue'

const route = useRoute()
const grade = computed(() => readFilter(route.query.grade_level))
const subject = computed(() => readFilter(route.query.subject))

const { data, error } = useApi(
  (signal) => fetchTopics({ gradeLevel: grade.value, subject: subject.value, signal }),
  [grade, subject],
)
const topics = computed(() => data.value?.data ?? [])
const loaded = computed(() => data.value !== null)

const CHIP =
  'inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm font-semibold transition'
</script>

<template>
  <div class="space-y-5" data-testid="topics-page">
    <section class="space-y-3 rounded-2xl bg-white p-4 shadow sm:p-5">
      <nav class="flex flex-wrap gap-2" aria-label="Darjah" data-testid="grade-chips">
        <RouterLink
          v-for="chip in GRADE_CHIPS"
          :key="chip.label"
          :to="topicsTo(chip.code, subject)"
          :class="[
            CHIP,
            chip.code === grade
              ? 'border-green-600 bg-green-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-green-500 hover:bg-green-50',
          ]"
          :data-active="chip.code === grade ? 'true' : 'false'"
          data-testid="grade-chip"
        >
          {{ chip.label }}
        </RouterLink>
      </nav>
      <nav class="flex flex-wrap gap-2" aria-label="Subjek" data-testid="subject-chips">
        <RouterLink
          v-for="chip in SUBJECT_CHIPS"
          :key="chip.label"
          :to="topicsTo(grade, chip.code)"
          :class="[
            CHIP,
            chip.code === subject
              ? 'border-purple-600 bg-purple-600 text-white'
              : 'border-slate-200 bg-white text-slate-700 hover:border-purple-500 hover:bg-purple-50',
          ]"
          :data-active="chip.code === subject ? 'true' : 'false'"
          data-testid="subject-chip"
        >
          {{ chip.label }}
        </RouterLink>
      </nav>
    </section>

    <AlertBox v-if="error" :messages="LOAD_ERROR" data-testid="topics-error" />

    <template v-else-if="loaded">
      <div
        v-if="topics.length === 0"
        class="rounded-2xl bg-white p-10 text-center shadow"
        data-testid="topics-empty"
      >
        <BookOpen class="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
        <p class="mt-3 text-slate-500">{{ EMPTY_TOPICS }}</p>
      </div>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="topic-grid">
        <RouterLink
          v-for="t in topics"
          :key="t.id"
          :to="topicPath(t.id)"
          class="group flex flex-col overflow-hidden rounded-2xl bg-white shadow transition hover:shadow-lg"
          data-testid="topic-card"
          :data-topic-id="t.id"
        >
          <div class="bg-gradient-to-r from-purple-500 to-pink-500 p-4 text-white">
            <div class="flex items-start justify-between gap-2">
              <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white">
                <BookOpen class="h-6 w-6 text-purple-600" aria-hidden="true" />
              </span>
              <span
                class="rounded-full bg-white/20 px-3 py-1 text-xs font-bold"
                data-testid="topic-subtopic-count"
              >
                {{ t.subtopicCount }} Subtopik
              </span>
            </div>
            <h3 class="mt-3 font-heading text-lg font-bold" data-testid="topic-name">
              {{ t.name }}
            </h3>
            <p class="text-xs font-semibold text-white/80" data-testid="topic-subject">
              {{ t.subjectLabel }}
            </p>
          </div>
          <div class="flex flex-1 flex-col p-4">
            <p
              v-if="t.description"
              class="line-clamp-2 text-sm text-slate-600"
              data-testid="topic-description"
            >
              {{ t.description }}
            </p>
            <p class="mt-3 text-xs font-bold tracking-wide text-slate-500 uppercase">Subtopik:</p>
            <ul class="mt-1 space-y-1">
              <li
                v-for="name in t.subtopicsPreview"
                :key="name"
                class="flex items-start gap-2 text-sm text-slate-700"
                data-testid="topic-subtopic"
              >
                <CircleCheck class="mt-0.5 h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
                <span>{{ name }}</span>
              </li>
              <li
                v-if="moreSubtopics(t.subtopicCount, 3)"
                class="text-sm text-slate-500"
                data-testid="topic-more"
              >
                {{ moreSubtopics(t.subtopicCount, 3) }}
              </li>
            </ul>
            <span
              class="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 text-sm font-bold text-white"
            >
              <Eye class="h-4 w-4" aria-hidden="true" />
              Lihat Topik
            </span>
          </div>
        </RouterLink>
      </div>
    </template>
  </div>
</template>
