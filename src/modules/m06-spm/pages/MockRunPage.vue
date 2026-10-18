<script setup lang="ts">
/**
 * Q4 `/spm-mock/:id` in-exam page (M06-T4; FR-M06-72/73, BR-M06-23/26): PROVISIONAL, UNVERIFIED (L-8).
 *
 * A neutral placeholder: the title "{Subjek} · Paper {n}", a timer element counting up from the mock's
 * `createdAt` (direction, time limit and auto-submit are not specified, URS OQ-M06-05; there is no
 * pause control), every item with an answer input (Paper 1 objective: option radios; Paper 2: a
 * textarea) and one submit button with PROPOSED COPY "Hantar". Submit calls #15 and goes to S12.
 * A submitted mock redirects to S12; an unknown or foreign id is the global 404.
 */
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useApi } from '@/composables'
import { DsPage } from '@/ds'
import { clock } from '@/lib/time'

import { fetchMock, submitMock } from '../api'
import { elapsedLabel, optionLetter } from '../components/mock-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const SUBMIT_ERROR = 'Gagal menghantar jawapan. Sila cuba semula.'

const route = useRoute()
const router = useRouter()
const id = computed(() => Number(route.params.id))
const { data, error, loading, reload } = useApi((signal) => fetchMock(id.value, { signal }), id)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (yes) => {
    if (yes) setRouteOutcome(404)
  },
  { immediate: true },
)
watch(
  data,
  (d) => {
    if (d?.status === 'submitted') void router.replace(`/spm-mock/${String(d.id)}/result`)
  },
  { immediate: true },
)

const answers = reactive<Record<number, string>>({})
const submitting = ref(false)
const submitError = ref<string | null>(null)

const nowMs = ref(clock.now())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => {
    nowMs.value = clock.now()
  }, 1000)
})
onBeforeUnmount(() => {
  if (timer !== undefined) clearInterval(timer)
})
const elapsed = computed(() =>
  data.value ? elapsedLabel(data.value.createdAt, nowMs.value) : '00:00',
)

async function submit(): Promise<void> {
  if (!data.value || submitting.value) return
  submitting.value = true
  submitError.value = null
  try {
    await submitMock(
      data.value.id,
      data.value.items.map((it) => ({ no: it.no, answer: answers[it.no] ?? '' })),
    )
    await router.push(`/spm-mock/${String(data.value.id)}/result`)
  } catch (e) {
    if (isApiError(e) && e.status === 409) {
      await router.replace(`/spm-mock/${String(data.value.id)}/result`)
      return
    }
    submitError.value = SUBMIT_ERROR
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <DsPage :show-title="false" data-testid="run-page" data-provisional="true">
    <div v-if="loading && !data" class="flex flex-col gap-2" data-testid="run-skeleton">
      <USkeleton v-for="n in 3" :key="n" class="h-20" />
    </div>
    <div
      v-else-if="error && !notFound"
      class="flex max-w-xl flex-col gap-3"
      data-testid="run-error"
    >
      <UAlert color="error" variant="soft" icon="i-ph-warning-circle-duotone" :title="LOAD_ERROR" />
      <UButton size="lg" class="min-h-11 self-start" data-testid="run-retry" @click="reload()"
        >Cuba Semula</UButton
      >
    </div>

    <form
      v-else-if="data && data.status === 'in_progress'"
      class="flex min-w-0 flex-col gap-4"
      data-testid="run-form"
      @submit.prevent="submit"
    >
      <UCard>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-heading break-words text-highlighted" data-testid="run-title">
            {{ data.subject }} · Paper {{ data.paperNumber }}
          </h1>
          <UBadge
            color="neutral"
            variant="soft"
            size="lg"
            class="tabular"
            icon="i-ph-timer-duotone"
            data-testid="mock-timer"
            >{{ elapsed }}</UBadge
          >
        </div>
      </UCard>

      <UAlert
        v-if="submitError"
        color="error"
        variant="soft"
        icon="i-ph-warning-circle-duotone"
        :title="submitError"
        data-testid="run-submit-error"
      />

      <ol class="flex flex-col gap-3" data-testid="run-items">
        <li v-for="it in data.items" :key="it.no" :data-testid="`run-item-${String(it.no)}`">
          <UCard>
            <div class="flex flex-col gap-2">
              <p class="text-label break-words text-highlighted">
                Soalan {{ it.no }}
                <span class="text-caption text-muted">({{ it.maxMarks }} markah)</span>
              </p>
              <p class="text-body break-words whitespace-pre-line text-default">{{ it.text }}</p>
              <fieldset v-if="it.options" class="flex flex-col gap-2">
                <UCard v-for="(opt, i) in it.options" :key="i" variant="subtle" :ui="{ body: 'p-3' }">
                  <label class="flex min-h-11 cursor-pointer items-start gap-3 text-body text-default">
                    <!-- Native radio: the browser keeps arrow-key grouping and the `name`. -->
                    <!-- eslint-disable-next-line vue/no-restricted-html-elements -->
                    <input
                      v-model="answers[it.no]"
                      type="radio"
                      :name="`answer-${String(it.no)}`"
                      :value="optionLetter(i)"
                      class="mt-1 size-4 shrink-0"
                      data-testid="run-option"
                    />
                    <span class="min-w-0 break-words"
                      ><b>{{ optionLetter(i) }}.</b> {{ opt }}</span
                    >
                  </label>
                </UCard>
              </fieldset>
              <UTextarea
                v-else
                v-model="answers[it.no]"
                :rows="4"
                class="w-full"
                data-testid="run-answer"
              />
            </div>
          </UCard>
        </li>
      </ol>

      <UButton
        type="submit"
        size="lg"
        :loading="submitting"
        :disabled="submitting"
        class="min-h-11 self-start max-sm:w-full max-sm:justify-center"
        data-testid="run-submit"
        >Hantar</UButton
      >
    </form>
  </DsPage>
</template>
