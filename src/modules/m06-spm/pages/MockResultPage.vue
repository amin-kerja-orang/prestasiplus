<script setup lang="ts">
/**
 * S12 `/spm-mock/:id/result` "Result Mock SPM — {Subjek}" (M06-T4; FR-M06-75…79, BR-M06-24/26,
 * DV-M06-05).
 *
 * Hero by grade band (green / `mid` yellow / `bad` red), the subject-matched Duta block, "Topik Lemah"
 * (hidden without a wrong item), "Review Setiap Soalan" and the two actions. Unknown or foreign id: the
 * global 404; a mock not yet submitted goes back to Q4. Max width 880 px, single column.
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useApi, usePageMeta } from '@/composables'
import { DsArt3D, DsPage, DsPanel, DsLoadError } from '@/ds'

import { fetchMockResult } from '../api'
import DutaBlock from '../components/DutaBlock.vue'
import { isCorrect, itemHeader, percentLabel, wrongLabel } from '../components/mock-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()
const id = computed(() => Number(route.params.id))
const { data, error, loading, reload } = useApi(
  (signal) => fetchMockResult(id.value, { signal }),
  id,
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
const notSubmitted = computed(() => isApiError(error.value) && error.value.status === 409)
watch(
  notFound,
  (yes) => {
    if (yes) setRouteOutcome(404)
  },
  { immediate: true },
)
watch(
  notSubmitted,
  (yes) => {
    if (yes) void router.replace(`/spm-mock/${String(id.value)}`)
  },
  { immediate: true },
)
watch(
  data,
  (d) => {
    if (!d) return
    const title = `Result Mock SPM — ${d.subject}`
    pageMeta.setTitle(title)
    pageMeta.setHeader({ title })
  },
  { immediate: true },
)
</script>

<template>
  <DsPage :show-title="false" data-testid="result-page">
    <div v-if="loading && !data" class="flex flex-col gap-2" data-testid="result-skeleton">
      <USkeleton class="h-40" />
      <USkeleton v-for="n in 3" :key="n" class="h-20" />
    </div>
    <DsLoadError
      v-else-if="error && !notFound && !notSubmitted"
      :message="LOAD_ERROR"
      testid="result-error"
      retry-testid="result-retry"
      @retry="reload()"
    />

    <template v-else-if="data">
      <UCard :data-hero="data.heroClass" data-testid="result-hero">
        <div class="flex flex-col items-center gap-2 text-center">
          <DsArt3D :name="data.heroClass === 'good' ? 'trophy' : 'books'" size="xl" float />
          <h1 class="text-subheading break-words text-highlighted" data-testid="result-title">
            {{ data.subject }} · Paper {{ data.paperNumber }}
          </h1>
          <p
class="text-display" :class="
              data.heroClass === 'good'
                ? 'text-success'
                : data.heroClass === 'mid'
                  ? 'text-warning'
                  : 'text-error'
            " data-testid="result-grade">
            {{ data.grade }}
          </p>
          <p class="tabular text-heading text-highlighted" data-testid="result-percent">
            {{ percentLabel(data.percent) }}
          </p>
          <p class="tabular text-label text-muted" data-testid="result-score">
            {{ data.score }} / {{ data.maxScore }} markah
          </p>
        </div>
      </UCard>

      <DutaBlock
        :title="`🎓 Cikgu Pakar ${data.subject}`"
        text="Lemah dlm topik tertentu? Cikgu pakar ni boleh bantu anda naik ke A+ next round."
        :subject="data.subject"
      />

      <DsPanel
        v-if="data.weakTopics.length > 0"
        title="📉 Topik Lemah — Fokus Belajar Ke Sini"
        icon="i-ph-trend-down-duotone"
        accent="heat"
        data-testid="result-weak"
      >
        <div class="flex flex-col gap-3">
          <ul class="flex flex-col gap-2">
            <li v-for="w in data.weakTopics" :key="w.topic" data-testid="weak-item">
              <UCard variant="subtle" :ui="{ body: 'p-3' }">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="min-w-0 text-label break-words text-highlighted" data-testid="weak-topic">{{
                    w.topic
                  }}</span>
                  <span class="text-caption text-error" data-testid="weak-count">{{
                    wrongLabel(w.wrongCount)
                  }}</span>
                </div>
              </UCard>
            </li>
          </ul>
          <p class="text-body text-muted" data-testid="result-tip">
            💡 Cikgu Alesa cadang anda fokus belajar topik atas dulu. Boleh start dengan
            <ULink to="/pusat-nota-ringkas" class="text-primary-t">jana nota ringkas</ULink>
            untuk topik tersebut.
          </p>
        </div>
      </DsPanel>

      <DsPanel title="📋 Review Setiap Soalan" icon="i-ph-list-checks-duotone" data-testid="result-review">
        <ul class="flex flex-col gap-2">
          <li
            v-for="it in data.items"
            :key="it.no"
            :data-correct="isCorrect(it) ? 'true' : 'false'"
            :data-testid="`review-item-${String(it.no)}`"
          >
            <UCard variant="subtle" :ui="{ body: 'flex flex-col gap-1 p-3' }">
              <p
                class="text-overline"
                :class="isCorrect(it) ? 'text-success' : 'text-error'"
                data-testid="review-header"
              >
                {{ isCorrect(it) ? '✓' : '✗' }} {{ itemHeader(it) }}
              </p>
              <p class="text-body break-words whitespace-pre-line text-highlighted" data-testid="review-text">
                {{ it.text }}
              </p>
              <p class="text-body break-words text-default" data-testid="review-answer">
                <b>Anda:</b> {{ it.studentAnswer ?? '(tiada jawapan)' }}
              </p>
              <p class="text-body break-words whitespace-pre-line text-default" data-testid="review-key">
                <b>Jawapan:</b> {{ it.modelAnswer }}
              </p>
              <p v-if="it.feedback" class="text-body break-words text-muted" data-testid="review-feedback">
                {{ it.feedback }}
              </p>
            </UCard>
          </li>
        </ul>
      </DsPanel>

      <div class="flex flex-wrap gap-3" data-testid="result-actions">
        <UButton to="/spm-mock" size="lg" class="min-h-11 max-sm:flex-1 max-sm:justify-center"
          >📝 Mock Lain</UButton
        >
        <UButton
          to="/pusat-nota-ringkas"
          size="lg"
          color="neutral"
          variant="soft"
          class="min-h-11 max-sm:flex-1 max-sm:justify-center"
          >📚 Belajar Topik Lemah</UButton
        >
      </div>
    </template>
  </DsPage>
</template>
