<script setup lang="ts">
/**
 * S9 `/admin/structured-questions/:id` "Detail Soalan Berstruktur" (M04-T7; FR-M04-88..90,
 * FN-M04-4.2.1..4.2.6). Read-only: back link, header card (pills, "ID: #n", stimulus box with line
 * breaks kept, meta line), "Bahagian Soalan (n sub-soalan)" with one card per sub-question and the
 * "Edit Soalan" (M10 teacher form) / "Balik ke Senarai" actions. An unknown id is the standard 404.
 */
import { computed, watch } from 'vue'

import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { DsBackLink, DsLoadError, DsPage, DsPanel, DsStatusBadge } from '@/ds'

import { fetchStructuredQuestion } from '../api/structured'
import { formatEnDate } from '../lib/audit-format'
import { STRUCTURED_LIST_PATH, structuredEditPath } from '../lib/audit-routes'
import { kbatLabel, partLabelText } from '../lib/structured-options'
import { LOAD_ERROR, isNotFound } from '../lib/ui-errors'

const props = defineProps<{ id: number }>()

const {
  data: question,
  error,
  reload,
} = useApi(
  (signal) => fetchStructuredQuestion(props.id, { signal }),
  () => props.id,
)

/** An unknown id is the standard 404 page; other load failures keep the red box. */
const notFound = computed(() => isNotFound(error.value))
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

</script>

<template>
  <DsPage class="max-w-5xl" data-testid="structured-detail">
    <template #breadcrumb>
      <DsBackLink
        :to="STRUCTURED_LIST_PATH"
        label="Kembali ke senarai"
        data-testid="structured-back"
      />
    </template>

    <DsLoadError
      v-if="error && !notFound"
      :message="LOAD_ERROR"
      testid="structured-detail-error"
      retry-testid="structured-detail-retry"
      @retry="reload()"
    />

    <div v-else-if="!question" class="flex flex-col gap-4" data-testid="structured-detail-skeleton">
      <USkeleton class="h-56 w-full" />
      <USkeleton class="h-32 w-full" />
    </div>

    <template v-else>
      <DsPanel data-testid="structured-header">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex flex-wrap gap-2">
            <UBadge
              v-if="question.subject"
              color="primary"
              variant="subtle"
              :label="question.subject.name"
              data-testid="structured-pill-subject"
            />
            <UBadge
              v-if="question.level"
              color="neutral"
              variant="subtle"
              :label="question.level.name"
              data-testid="structured-pill-level"
            />
            <UBadge
              color="info"
              variant="subtle"
              :label="`KBAT: ${kbatLabel(question.kbatLevel)}`"
              data-testid="structured-pill-kbat"
            />
            <UBadge
              color="success"
              variant="subtle"
              :label="`${question.totalMarks} Markah`"
              data-testid="structured-pill-marks"
            />
          </div>
          <span class="tabular text-caption text-muted" data-testid="structured-id"
            >ID: #{{ question.id }}</span
          >
        </div>

        <UCard variant="subtle" class="mt-4">
          <p class="mb-1 text-overline text-muted">Stimulus / Konteks Soalan</p>
          <p
            class="text-body break-words whitespace-pre-line text-highlighted"
            data-testid="structured-stimulus"
          >
            {{ question.stimulus }}
          </p>
        </UCard>

        <div
          class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-caption text-muted"
          data-testid="structured-meta"
        >
          <span class="inline-flex items-center gap-2">
            <UIcon name="i-ph-user" class="size-4" />
            Dicipta oleh: {{ question.createdBy.name ?? '—' }}
          </span>
          <span class="inline-flex items-center gap-2">
            <UIcon name="i-ph-calendar" class="size-4" />
            {{ formatEnDate(question.createdAt) }}
          </span>
          <span class="inline-flex items-center gap-2">
            <UIcon name="i-ph-eye" class="size-4" />
            Visibiliti: Public
          </span>
          <DsStatusBadge
            :status="question.status === 'published' ? 'published' : 'draft'"
            :label="question.status === 'published' ? 'Published' : 'Draft'"
            size="sm"
            data-testid="structured-status"
          />
        </div>
      </DsPanel>

      <h2 class="text-subheading text-highlighted" data-testid="structured-subs-heading">
        Bahagian Soalan ({{ question.subQuestions.length }} sub-soalan)
      </h2>

      <DsPanel v-for="sub in question.subQuestions" :key="sub.id" data-testid="structured-sub">
        <div class="flex items-start gap-3">
          <UBadge
            color="primary"
            variant="solid"
            size="lg"
            :label="partLabelText(question.questionNumber, sub.partLabel)"
            class="shrink-0"
            data-testid="structured-sub-label"
          />
          <p class="min-w-0 flex-1 text-body break-words text-highlighted">
            {{ sub.questionText }}
          </p>
          <UBadge
            color="neutral"
            variant="subtle"
            :label="`${sub.marks}m`"
            class="shrink-0"
            data-testid="structured-sub-marks"
          />
        </div>
        <UCard variant="subtle" class="mt-3">
          <p class="mb-1 text-overline text-success">Jawapan Model</p>
          <p class="text-body break-words whitespace-pre-line text-default">
            {{ sub.modelAnswer }}
          </p>
        </UCard>
      </DsPanel>

      <div class="flex flex-wrap gap-3">
        <UButton
          :to="structuredEditPath(question.id)"
          icon="i-ph-pencil-simple"
          class="min-h-11"
          data-testid="structured-edit"
        >
          Edit Soalan
        </UButton>
        <UButton
          :to="STRUCTURED_LIST_PATH"
          color="neutral"
          variant="soft"
          icon="i-ph-list"
          class="min-h-11"
          data-testid="structured-back-list"
        >
          Balik ke Senarai
        </UButton>
      </div>
    </template>
  </DsPage>
</template>
