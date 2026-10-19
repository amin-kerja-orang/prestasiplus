<script setup lang="ts">
/**
 * Q4 read-only preview for the test's teacher and an admin (FR-M05-141, SRS §8.3 "Q4 teacher/admin
 * preview", PROPOSED; BR-32), restyled for v2 (staff density, no win screen). Loads
 * `GET /api/remedial-tests/:id`: the banner "Pratonton — jawapan tidak direkodkan.", then per
 * question the text, options A–D and the correct option in green with a tick. No timer, no
 * buttons, nothing is written. Any other viewer gets a 404 from the API, which is the global 404
 * page. The header card (subject, student, counts) is INFERRED.
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'

import { fetchRemedialPreview } from '../../api/practice'
import { DsLoadError, DsStack, DsHeading, DsText } from '@/ds'

const props = defineProps<{ id: number }>()

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi(
  (signal) => fetchRemedialPreview(props.id, { signal }),
  [() => props.id],
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)
</script>

<template>
  <DsStack class="mx-auto w-full max-w-2xl" data-testid="remedial-preview">
    <template v-if="data">
      <UButton
        to="/remedial/saya"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left-bold"
        class="min-h-11 self-start"
        data-testid="preview-back"
        >Kembali</UButton
      >

      <UCard data-testid="preview-header">
        <DsStack gap="2xs">
          <DsHeading :level="1" variant="heading" wrap="anywhere" data-testid="preview-title">
            Ujian Remedial — {{ data.subjectName }}
          </DsHeading>
          <DsText variant="body" tone="muted" data-testid="preview-meta">
            {{ data.studentName }} · {{ data.totalQuestions }} soalan
          </DsText>
        </DsStack>
      </UCard>

      <UAlert
        color="neutral"
        variant="soft"
        icon="i-ph-eye-duotone"
        title="Pratonton — jawapan tidak direkodkan."
        data-testid="preview-banner"
      />

      <UCard
        v-for="(q, i) in data.questions"
        :key="q.id"
        :data-testid="`preview-q-${String(i + 1)}`"
      >
        <DsStack as="article" gap="sm">
          <DsText variant="caption">Soalan {{ i + 1 }}</DsText>
          <DsText
            variant="body"
            tone="highlighted"
            wrap="anywhere"
            class="whitespace-pre-line"
            :dir="q.textDirection"
            data-testid="preview-text"
          >
            {{ q.questionText }}
          </DsText>
          <DsStack as="ul" gap="xs">
            <li
              v-for="o in q.options"
              :key="o.id"
              class="flex items-start gap-3 text-body text-default"
              :data-correct="o.id === q.correctOptionId ? 'true' : 'false'"
              data-testid="preview-option"
            >
              <UBadge
                :color="o.id === q.correctOptionId ? 'success' : 'neutral'"
                :variant="o.id === q.correctOptionId ? 'solid' : 'soft'"
                >{{ o.label }}.</UBadge
              >
              <span class="min-w-0 flex-1 break-words">{{ o.text }}</span>
              <template v-if="o.id === q.correctOptionId">
                <UIcon
                  name="i-ph-check-circle-duotone"
                  class="size-5 shrink-0 text-success"
                  aria-hidden="true"
                />
                <span class="sr-only">(jawapan betul)</span>
              </template>
            </li>
          </DsStack>
        </DsStack>
      </UCard>
    </template>

    <DsLoadError
      v-else-if="error && !notFound"
      :message="LOAD_ERROR"
      retry-testid="preview-retry"
      testid="preview-error"
      @retry="reload()"
    />
  </DsStack>
</template>
