<script setup lang="ts">
/**
 * V2 `/cikgu/essay/:id` essay marking view (PROPOSED, FR-M13-56, 48; URS FN-M13-4.3.2). Own records
 * only: a foreign or unknown id is the standard 404. The comment is text with its line breaks kept.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { DsPage, DsPanel, DsLoadError, DsStack, DsHeading, DsText } from '@/ds'

import { fetchEssay } from '../api'
import { ESSAY_COPY as C } from '../components/teacher/copy'
import { orDash, rubricShort } from '../components/teacher/lib'

const props = defineProps<{ id: number }>()

const { data, error, reload } = useApi(
  (signal) => fetchEssay(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(notFound, (is404) => {
  if (is404) setRouteOutcome(404)
})
</script>

<template>
  <DsPage class="max-w-4xl" data-testid="essay-view-page">
    <div>
      <UButton
        to="/cikgu/essay"
        color="neutral"
        variant="ghost"
        class="min-h-11"
        data-testid="essay-back"
        >{{ C.back }}</UButton
      >
    </div>
    <DsLoadError
      v-if="error !== null && !notFound"
      :message="C.loadFailed"
      :retry-label="C.retry"
      testid="page-error"
      retry-testid="page-retry"
      @retry="reload"
    />
    <DsStack
      v-else-if="!(data !== null || notFound)"
      gap="sm"
      aria-busy="true"
      data-testid="page-loading"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-16 w-full" />
    </DsStack>
    <template v-else>
      <DsPanel v-if="data" class="flex flex-col gap-4">
        <DsHeading :level="1" variant="heading">{{ C.title }}</DsHeading>
        <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="min-w-0">
            <DsText variant="overline" as="dt">{{ C.viewLabels.student }}</DsText>
            <DsText variant="body" as="dd" tone="highlighted" data-testid="essay-view-student">
              {{ orDash(data.studentName) }}
            </DsText>
          </div>
          <div class="min-w-0">
            <DsText variant="overline" as="dt">{{ C.viewLabels.subject }}</DsText>
            <DsText variant="body" as="dd" tone="highlighted" data-testid="essay-view-subject">
              {{ orDash(data.subjectName) }} / {{ rubricShort(data.rubricKey) }}
            </DsText>
          </div>
          <div class="min-w-0">
            <DsText variant="overline" as="dt">{{ C.viewLabels.tajuk }}</DsText>
            <DsText
              variant="body"
              as="dd"
              tone="highlighted"
              wrap="anywhere"
              data-testid="essay-view-tajuk"
            >
              {{ orDash(data.essayTitle) }}
            </DsText>
          </div>
          <div class="min-w-0">
            <DsText variant="overline" as="dt">{{ C.viewLabels.marks }}</DsText>
            <DsText variant="body" as="dd" tone="highlighted" data-testid="essay-view-marks">
              {{ data.marks }}/{{ data.maxMarks }}
            </DsText>
          </div>
        </dl>
        <DsPanel
          tone="inset"
          class="text-body break-words whitespace-pre-line text-default"
          data-testid="essay-view-comment"
        >
          {{ data.comment }}
        </DsPanel>
      </DsPanel>
    </template>
  </DsPage>
</template>
