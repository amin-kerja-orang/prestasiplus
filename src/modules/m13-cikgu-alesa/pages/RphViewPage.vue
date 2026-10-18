<script setup lang="ts">
/**
 * V1 `/cikgu/rph/:id` RPH view (PROPOSED, FR-M13-47, 48; URS FN-M13-3.3.2). Own records only: a
 * foreign or unknown id is the standard 404. Content is text with its line breaks kept.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { DsPage, DsPanel } from '@/ds'

import { fetchRph } from '../api'
import { RPH_COPY as C } from '../components/teacher/copy'
import { dmy } from '../components/teacher/lib'
import PageState from '../components/teacher/PageState.vue'

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
    <PageState
      :loaded="data !== null || notFound"
      :error="error !== null && !notFound"
      :message="C.loadFailed"
      :retry-label="C.retry"
      @retry="reload"
    >
      <DsPanel v-if="data" class="flex flex-col gap-4">
        <h1 class="text-heading text-highlighted">{{ C.title }}</h1>
        <dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="min-w-0">
            <dt class="text-overline text-muted">{{ C.viewLabels.date }}</dt>
            <dd class="text-body text-highlighted" data-testid="rph-view-date">
              {{ dmy(data.lessonDate) }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-overline text-muted">{{ C.viewLabels.subject }}</dt>
            <dd class="text-body text-highlighted" data-testid="rph-view-subject">
              {{ data.subjectName }} / {{ data.level }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-overline text-muted">{{ C.viewLabels.tajuk }}</dt>
            <dd class="text-body break-words text-highlighted" data-testid="rph-view-tajuk">
              {{ data.tajuk }}
            </dd>
          </div>
          <div class="min-w-0">
            <dt class="text-overline text-muted">{{ C.viewLabels.status }}</dt>
            <dd class="text-body text-highlighted" data-testid="rph-view-status">
              {{ C.statusGenerated }}
            </dd>
          </div>
        </dl>
        <div
          class="rounded-card bg-soft p-4 text-body break-words whitespace-pre-line text-default"
          data-testid="rph-view-content"
        >
          {{ data.content }}
        </div>
      </DsPanel>
    </PageState>
  </DsPage>
</template>
