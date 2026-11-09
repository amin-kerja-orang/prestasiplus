<script setup lang="ts">
/**
 * "Tanda Karangan (semakan AI)" (V2 Panel `/spm/tanda-karangan`, `essay-review.tsx`). The AI proposes a mark for an
 * essay answer; school staff confirm or adjust it ("Sahkan"). The mark counts only once a person confirmed it. One
 * card per proposal: pupil and question, the stem, the scheme, the pupil's answer, the AI rationale, then the final
 * mark field and the button. Everything is printed as escaped text (the essay is the pupil's own input). The school
 * admin sees the own school, Admin Pusat (`/admin/spm/tanda-karangan`) every school; the page is the same.
 */
import { computed, reactive } from 'vue'
import { useRoute } from 'vue-router'

import { ESSAY_REVIEW_COPY } from '@pp/contract'

import { isApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import { DsCallout, DsCluster, DsLoadError, DsPage, DsPanel, DsStack, DsText } from '@/ds'

import { confirmEssayMark, fetchEssayReview, type EssayReviewRow } from '../api/essay-review'

const route = useRoute()
const flash = useFlash()
const central = computed(() => route.path.startsWith('/admin/spm/'))

const { data, error, reload } = useApi((signal: AbortSignal) => fetchEssayReview(central.value, signal), [])

const firstLoad = computed(() => data.value === null && error.value === null)
const rows = computed<EssayReviewRow[]>(() => data.value?.data ?? [])
const waiting = computed(() => data.value?.meta.totalItems ?? 0)

/** Marks typed per proposal (string, as typed); a proposal not typed on starts at the AI proposal. */
const typed = reactive<Record<string, string>>({})
const saving = reactive<Record<string, boolean>>({})

const marksOf = (p: EssayReviewRow): string => typed[p.id] ?? (p.proposed !== null ? String(p.proposed) : '')

function messageOf(err: unknown): string {
  return isApiError(err) && err.message ? err.message : 'Tindakan tidak berjaya. Sila cuba lagi.'
}

async function confirm(p: EssayReviewRow): Promise<void> {
  if (saving[p.id]) return
  saving[p.id] = true
  try {
    const raw = marksOf(p)
    const result = await confirmEssayMark(central.value, p.id, raw === '' ? 0 : Number(raw))
    flash.show({ type: 'success', message: result.status })
    await reload()
  } catch (err) {
    flash.show({ type: 'error', message: messageOf(err) })
  } finally {
    saving[p.id] = false
  }
}
</script>

<template>
  <DsPage data-testid="tk-page">
    <DsStack gap="lg">
      <DsPanel :title="ESSAY_REVIEW_COPY.heading" data-testid="tk-head">
        <template #actions>
          <UBadge color="neutral" variant="outline" data-testid="tk-count">{{ waiting }} menunggu</UBadge>
        </template>
        <DsText variant="body" tone="muted" data-testid="tk-intro">{{ ESSAY_REVIEW_COPY.intro }}</DsText>
      </DsPanel>

      <USkeleton v-if="firstLoad" class="h-40" data-testid="tk-loading" />

      <DsLoadError v-else-if="error" :message="messageOf(error)" testid="tk-error" @retry="reload" />

      <DsPanel v-else-if="rows.length === 0" data-testid="tk-empty">
        <DsText variant="body" tone="muted" class="block text-center">{{ ESSAY_REVIEW_COPY.empty }}</DsText>
      </DsPanel>

      <template v-else>
        <DsPanel v-for="p in rows" :key="p.id" as="article" data-testid="tk-card" :data-proposal-id="p.id">
          <DsStack gap="md">
            <DsCluster justify="between" align="start" gap="sm">
              <DsText variant="heading" as="h2" wrap="anywhere" data-testid="tk-student">
                {{ p.student }}
                <DsText v-if="p.questionNo" variant="body" tone="muted" as="span" data-testid="tk-question"
                  >· Soalan {{ p.questionNo }}</DsText
                >
              </DsText>
              <UBadge color="info" variant="subtle" data-testid="tk-proposed"
                >Cadangan AI: {{ p.proposed ?? '—' }} / {{ p.marks }}</UBadge
              >
            </DsCluster>

            <DsText v-if="p.stem" variant="body-strong" wrap="anywhere" class="whitespace-pre-line" data-testid="tk-stem">{{
              p.stem
            }}</DsText>

            <DsStack v-if="p.scheme.length > 0" gap="xs" data-testid="tk-scheme">
              <DsText variant="overline" tone="primary">Skema</DsText>
              <ul class="flex flex-col gap-1">
                <li v-for="(s, i) in p.scheme" :key="i">
                  <DsText variant="body" tone="muted" as="span" wrap="anywhere">• {{ s }}</DsText>
                </li>
              </ul>
            </DsStack>

            <DsStack gap="xs">
              <DsText variant="overline" tone="muted">Jawapan pelajar</DsText>
              <DsPanel tone="inset">
                <DsText variant="body" wrap="anywhere" class="whitespace-pre-line" data-testid="tk-essay">{{
                  p.essay
                }}</DsText>
              </DsPanel>
            </DsStack>

            <DsCallout
              v-if="p.rationale"
              tone="info"
              :description="'Justifikasi AI: ' + p.rationale"
              data-testid="tk-rationale"
            />

            <DsCluster gap="sm" align="center">
              <label :for="`marks-${p.id}`"><DsText variant="label" tone="muted" as="span">Markah muktamad</DsText></label>
              <UInput
                :id="`marks-${p.id}`"
                :model-value="marksOf(p)"
                type="number"
                min="0"
                :max="p.marks"
                class="w-24"
                data-testid="tk-marks"
                @update:model-value="(v: string | number) => (typed[p.id] = String(v))"
              />
              <DsText variant="body" tone="muted" as="span">/ {{ p.marks }}</DsText>
              <UButton
                type="button"
                icon="i-ph-check"
                class="ms-auto min-h-11"
                :loading="saving[p.id]"
                :disabled="saving[p.id]"
                data-testid="tk-confirm"
                @click="confirm(p)"
                >{{ saving[p.id] ? 'Menyimpan…' : 'Sahkan' }}</UButton
              >
            </DsCluster>
          </DsStack>
        </DsPanel>
      </template>
    </DsStack>
  </DsPage>
</template>
