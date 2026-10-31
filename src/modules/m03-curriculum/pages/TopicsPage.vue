<script setup lang="ts">
/**
 * S12 `/topics` "Topik - PRESTASIPLUS" (M03-T4; FR-M03-69..74, BR-13). Grade (Tingkatan 4 / 5, D54) and
 * subject chips (each keeps the other filter), then every matching topic on one page in a 1 / 2 (`sm`) / 3 (`lg`)
 * column grid. No loading state: the content area stays empty until the data is ready (SRS §8).
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { DsEmptyState, DsIconChip, DsPage } from '@/ds'
import { LOWER_FORM_COPY, useIsLowerForm } from '@/lib/lower-form'
import { useSessionStore } from '@/stores/session'

import { topicAccent, topicGlyph } from '../lib/topic-accent'
import { fetchTopics } from '../api/student-curriculum'
import {
  ALL_GRADES,
  EMPTY_TOPICS,
  GRADE_CHIPS,
  LOAD_ERROR,
  SUBJECT_CHIPS,
  effectiveTopicGrade,
  moreSubtopics,
  readFilter,
  topicPath,
  topicsTo,
} from '../lib/student-catalogue'

const route = useRoute()
const session = useSessionStore()
const lowerForm = useIsLowerForm()
/** D54: Tingkatan 4 / 5 / "Semua" (`SEMUA`); a bare URL opens the student's form (4 by default). */
const grade = computed(() =>
  effectiveTopicGrade(readFilter(route.query.grade_level), session.user?.grade),
)
const subject = computed(() => readFilter(route.query.subject))

const { data, error } = useApi(
  (signal) => fetchTopics({ gradeLevel: grade.value === ALL_GRADES ? null : grade.value, subject: subject.value, signal }),
  [grade, subject],
)
const topics = computed(() => data.value?.data ?? [])
const loaded = computed(() => data.value !== null)
</script>

<template>
  <DsPage data-testid="topics-page">
    <DsEmptyState
      v-if="lowerForm"
      icon="books"
      :title="LOWER_FORM_COPY.title"
      :description="LOWER_FORM_COPY.description"
      data-testid="lower-form-empty"
    />
    <template v-else>
    <section class="flex flex-col gap-3 rounded-card bg-default p-4 shadow-lift sm:p-5">
      <nav class="flex flex-wrap gap-2" aria-label="Tingkatan" data-testid="grade-chips">
        <UButton
          v-for="chip in GRADE_CHIPS"
          :key="chip.label"
          :to="topicsTo(chip.code, subject)"
          size="lg"
          :color="chip.code === grade ? 'primary' : 'neutral'"
          :variant="chip.code === grade ? 'solid' : 'soft'"
          class="min-h-11 rounded-full"
          :data-active="chip.code === grade ? 'true' : 'false'"
          data-testid="grade-chip"
        >
          {{ chip.label }}
        </UButton>
      </nav>
      <nav class="flex flex-wrap gap-2" aria-label="Subjek" data-testid="subject-chips">
        <UButton
          v-for="chip in SUBJECT_CHIPS"
          :key="chip.label"
          :to="topicsTo(grade, chip.code)"
          size="lg"
          :color="chip.code === subject ? 'primary' : 'neutral'"
          :variant="chip.code === subject ? 'solid' : 'soft'"
          class="min-h-11 rounded-full"
          :data-active="chip.code === subject ? 'true' : 'false'"
          data-testid="subject-chip"
        >
          {{ chip.label }}
        </UButton>
      </nav>
    </section>

    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-ph-warning-circle-duotone"
      :title="LOAD_ERROR"
      data-testid="topics-error"
    />

    <template v-else-if="loaded">
      <div
        v-if="topics.length === 0"
        class="rounded-card bg-default p-6 shadow-lift"
        data-testid="topics-empty"
      >
        <DsEmptyState icon="books" :title="EMPTY_TOPICS" />
      </div>

      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        data-testid="topic-grid"
      >
        <RouterLink
          v-for="t in topics"
          :key="t.id"
          :to="topicPath(t.id)"
          class="flex min-w-0 flex-col gap-3 rounded-card bg-default p-4 shadow-lift hover:bg-elevated"
          data-testid="topic-card"
          :data-topic-id="t.id"
        >
          <div class="flex items-start justify-between gap-2">
            <DsIconChip :icon="topicGlyph(t.subject)" :accent="topicAccent(t.subject)" size="lg" />
            <span
              class="rounded-full bg-elevated px-3 py-1 text-caption font-bold text-default"
              data-testid="topic-subtopic-count"
            >
              {{ t.subtopicCount }} Subtopik
            </span>
          </div>
          <div class="min-w-0">
            <h3 class="text-subheading break-words text-highlighted" data-testid="topic-name">
              {{ t.name }}
            </h3>
            <p class="text-caption font-semibold text-muted" data-testid="topic-subject">
              {{ t.subjectLabel }}
            </p>
          </div>
          <p
            v-if="t.description"
            class="line-clamp-2 text-body text-muted"
            data-testid="topic-description"
          >
            {{ t.description }}
          </p>
          <div class="flex-1">
            <p class="text-overline text-muted">Subtopik:</p>
            <ul class="mt-1 flex flex-col gap-1">
              <li
                v-for="name in t.subtopicsPreview"
                :key="name"
                class="flex items-start gap-2 text-body text-default"
                data-testid="topic-subtopic"
              >
                <UIcon
                  name="i-ph-check-circle-duotone"
                  class="mt-0.5 size-4 shrink-0 text-success"
                  aria-hidden="true"
                />
                <span class="min-w-0 break-words">{{ name }}</span>
              </li>
              <li
                v-if="moreSubtopics(t.subtopicCount, 3)"
                class="text-body text-muted"
                data-testid="topic-more"
              >
                {{ moreSubtopics(t.subtopicCount, 3) }}
              </li>
            </ul>
          </div>
          <span
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-chip bg-primary px-4 py-2 text-label font-bold text-primary-on"
          >
            <UIcon name="i-ph-eye-duotone" class="size-4" aria-hidden="true" />
            Lihat Topik
          </span>
        </RouterLink>
      </div>
    </template>
    </template>
  </DsPage>
</template>
