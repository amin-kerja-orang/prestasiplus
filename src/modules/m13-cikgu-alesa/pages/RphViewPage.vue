<script setup lang="ts">
/**
 * V1 `/cikgu/rph/:id` RPH view (PROPOSED, FR-M13-47, 48; URS FN-M13-3.3.2). Own records only: a
 * foreign or unknown id is the standard 404. Content is text with its line breaks kept.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { DsPage, DsPanel, DsLoadError, DsStack, DsHeading, DsText } from '@/ds'

import { fetchRph } from '../api'
import { RPH_COPY as C } from '../components/teacher/copy'
import { dmy } from '../components/teacher/lib'

const props = defineProps<{ id: number }>()

const { data, error, reload } = useApi(
  (signal) => fetchRph(props.id, { signal }),
  () => props.id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(notFound, (is404) => {
  if (is404) setRouteOutcome(404)
})
</script>

<template>
  <DsPage class="max-w-4xl" data-testid="rph-view-page">
    <div>
      <UButton
        to="/cikgu/rph"
        color="neutral"
        variant="ghost"
        class="min-h-11"
        data-testid="rph-back"
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
            <DsText variant="overline" as="dt">{{ C.viewLabels.date }}</DsText>
            <DsText variant="body" as="dd" tone="highlighted" data-testid="rph-view-date">
              {{ dmy(data.lessonDate) }}
            </DsText>
          </div>
          <div class="min-w-0">
            <DsText variant="overline" as="dt">{{ C.viewLabels.subject }}</DsText>
            <DsText variant="body" as="dd" tone="highlighted" data-testid="rph-view-subject">
              {{ data.subjectName }} / {{ data.level }}
            </DsText>
          </div>
          <div class="min-w-0">
            <DsText variant="overline" as="dt">{{ C.viewLabels.tajuk }}</DsText>
            <DsText
              variant="body"
              as="dd"
              tone="highlighted"
              wrap="anywhere"
              data-testid="rph-view-tajuk"
            >
              {{ data.tajuk }}
            </DsText>
          </div>
          <div class="min-w-0">
            <DsText variant="overline" as="dt">{{ C.viewLabels.status }}</DsText>
            <DsText variant="body" as="dd" tone="highlighted" data-testid="rph-view-status">
              {{ C.statusGenerated }}
            </DsText>
          </div>
        </dl>
        <DsPanel
          tone="inset"
          class="text-body break-words whitespace-pre-line text-default"
          data-testid="rph-view-content"
        >
          {{ data.content }}
        </DsPanel>
      </DsPanel>
    </template>
  </DsPage>
</template>
