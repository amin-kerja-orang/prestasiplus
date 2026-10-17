<script setup lang="ts">
/**
 * S13 `/topics/:id` "{name} - PRESTASIPLUS" (M03-T4; FR-M03-75..79, BR-16, BR-19). Header "{name}" /
 * "{subject label}", back link, hero, 3 stat cards (3 columns at every width) and one card per
 * subtopic. An unknown topic id renders the global 404 page in place (FR-M03-79).
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'
import { DsIconChip, DsPage } from '@/ds'

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
  { label: 'Level 1', color: 'success' },
  { label: 'Level 2', color: 'warning' },
  { label: 'Level 3', color: 'error' },
] as const
</script>

<template>
  <DsPage data-testid="topic-detail-page">
    <UButton
      :to="TOPICS_PATH"
      color="neutral"
      variant="link"
      icon="i-ph-arrow-left-duotone"
      class="min-h-11 self-start"
      data-testid="topic-back"
    >
      Kembali ke Senarai Topik
    </UButton>

    <UAlert
      v-if="loadFailed"
      color="error"
      variant="soft"
      icon="i-ph-warning-circle-duotone"
      :title="LOAD_ERROR"
      data-testid="topic-error"
    />

    <template v-else-if="topic">
      <section
        class="rounded-3xl bg-gradient-primary p-5 text-primary-on shadow-hero sm:p-8"
        data-testid="topic-hero"
      >
        <div class="flex items-start gap-4">
          <div class="min-w-0 flex-1">
            <h1 class="font-display text-title font-extrabold break-words">{{ topic.name }}</h1>
            <p class="mt-1 text-label" data-testid="topic-hero-subject">
              {{ topic.subjectLabel }}
            </p>
            <p
              v-if="topic.description"
              class="mt-3 line-clamp-3 text-body"
              data-testid="topic-hero-description"
            >
              {{ topic.description }}
            </p>
          </div>
          <DsIconChip icon="i-ph-books-duotone" accent="win" size="lg" />
        </div>
      </section>

      <div class="grid grid-cols-3 gap-3 sm:gap-4" data-testid="topic-stats">
        <div class="rounded-card bg-default p-3 text-center shadow-lift sm:p-4">
          <UIcon
            name="i-ph-list-bullets-duotone"
            class="mx-auto size-6 text-primary"
            aria-hidden="true"
            data-testid="stat-icon-subtopik"
          />
          <div class="mt-1 text-title font-extrabold text-highlighted" data-testid="stat-subtopik">
            {{ topic.subtopics.length }}
          </div>
          <div class="text-caption text-muted">Subtopik</div>
        </div>
        <div class="rounded-card bg-default p-3 text-center shadow-lift sm:p-4">
          <UIcon
            name="i-ph-question-duotone"
            class="mx-auto size-6 text-success"
            aria-hidden="true"
            data-testid="stat-icon-dijawab"
          />
          <div class="mt-1 text-title font-extrabold text-highlighted" data-testid="stat-dijawab">
            {{ topic.progress.questionsAnswered }}
          </div>
          <div class="text-caption text-muted">Dijawab</div>
        </div>
        <div class="rounded-card bg-default p-3 text-center shadow-lift sm:p-4">
          <UIcon
            name="i-ph-chart-line-up-duotone"
            class="mx-auto size-6 text-heat"
            aria-hidden="true"
            data-testid="stat-icon-kemajuan"
          />
          <div class="mt-1 text-title font-extrabold text-highlighted" data-testid="stat-kemajuan">
            {{ topic.progress.progress }}%
          </div>
          <div class="text-caption text-muted">Kemajuan</div>
        </div>
      </div>

      <section class="flex flex-col gap-3">
        <h2 class="text-heading text-highlighted">Subtopik</h2>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2" data-testid="subtopic-grid">
          <article
            v-for="(s, i) in topic.subtopics"
            :key="s.id"
            class="flex min-w-0 flex-col rounded-card bg-default p-4 shadow-lift"
            data-testid="subtopic-card"
          >
            <div class="flex items-start gap-3">
              <span
                class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-primary-on"
                data-testid="subtopic-number"
              >
                {{ i + 1 }}
              </span>
              <div class="min-w-0">
                <h3
                  class="text-subheading break-words text-highlighted"
                  data-testid="subtopic-name"
                >
                  {{ s.name }}
                </h3>
                <p
                  v-if="s.description"
                  class="mt-1 text-body text-muted"
                  data-testid="subtopic-description"
                >
                  {{ s.description }}
                </p>
              </div>
            </div>
            <div class="mt-3 flex flex-wrap gap-2">
              <UBadge
                v-for="b in BADGES"
                :key="b.label"
                :color="b.color"
                variant="soft"
                icon="i-ph-circle-fill"
                data-testid="subtopic-badge"
              >
                {{ b.label }}
              </UBadge>
            </div>
            <div class="mt-3">
              <div class="flex items-center justify-between text-label">
                <span class="text-muted">Kemajuan</span>
                <span class="font-bold text-primary" data-testid="subtopic-progress"
                  >{{ s.progress }}%</span
                >
              </div>
              <UProgress
                :model-value="s.progress"
                size="sm"
                class="mt-1"
                data-testid="subtopic-bar"
              />
            </div>
            <UButton
              :to="`/practice/${topic.practiceCode}`"
              size="xl"
              icon="i-ph-play-duotone"
              class="mt-4 min-h-11 justify-center"
              data-testid="subtopic-practice"
            >
              Mula Berlatih
            </UButton>
          </article>
        </div>
      </section>
    </template>
  </DsPage>
</template>
