<script setup lang="ts">
/**
 * Q2 `/practice/chapter/:code/:chapterId/quiz?count=` — the chapter quiz (M05-T5; FR-M05-52, 66, 67,
 * LS-3; provisional: live never opened it). The page resolves the chapter's level first (#8: it also
 * answers the global 404 page for an unknown code or a chapter that is not the subject's), then starts
 * the session through `QuizRunner` (mode `chapter`) with the Q1/Q2 labels (§8.3 PROPOSED COPY):
 *
 * - 409 `CHAPTER_LOCKED` → `/practice/chapter/{code}?level={levelId}` without a message;
 * - 402 → `/pricing` (the runner); header card title "Bab {n}: {chapter}" (INFERRED);
 * - shell header "Soalan Mengikut Bab" / "{subject}", tab title "Chapter {subject} - PRESTASIPLUS" (UNVERIFIED);
 * - results "Keputusan Latihan", "Ulang Lagi" (a new session with the same parameters) and "Kembali" → S5.
 */
import { computed, onScopeDispose, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { usePageMeta } from '@/composables'

import { fetchChapterSubject } from '../api/practice'
import type { StartSessionRequest, StartSessionResponse } from '../api/types'
import { chapterListHref, chapterQuizTitle } from '../components/chapter/chapter-lib'
import { parseQuizQuery } from '../components/quiz/practice-config'
import QuizLoading from '../components/quiz/QuizLoading.vue'
import QuizRunner from '../components/quiz/QuizRunner.vue'
import { PRACTICE_LABELS } from '../components/quiz/quiz-labels'
import { DsLoadError } from '@/ds'

const route = useRoute()
const pageMeta = usePageMeta()

const code = computed(() => String(route.params.code ?? ''))
const chapterId = computed(() => Number.parseInt(String(route.params.chapterId ?? ''), 10))
const count = computed(() => parseQuizQuery(route.query).count)

const resolved = ref<{ key: string; levelId: number; subjectName: string } | null>(null)
const failed = ref(false)
const attempt = ref(0)
const key = computed(() => `${code.value}/${String(chapterId.value)}`)

/** Finds the level whose chapter list holds the chapter; `null` when the subject has no such chapter. */
async function resolveLevel(
  subject: string,
  id: number,
  token: { cancelled: boolean; controller: AbortController },
): Promise<{ levelId: number; subjectName: string } | null> {
  const signal = token.controller.signal
  const first = await fetchChapterSubject(subject, {}, { signal })
  if (token.cancelled) return null
  const inLevel = (d: typeof first): boolean => d.chapters.some((c) => c.id === id)
  if (first.levelId !== null && inLevel(first)) {
    return { levelId: first.levelId, subjectName: first.subject.name }
  }
  for (const l of first.levels) {
    if (l.id === first.levelId) continue
    const d = await fetchChapterSubject(subject, { levelId: l.id }, { signal })
    if (token.cancelled) return null
    if (d.levelId !== null && inLevel(d)) return { levelId: d.levelId, subjectName: d.subject.name }
  }
  return null
}

interface Token {
  cancelled: boolean
  controller: AbortController
}
let current: Token = { cancelled: false, controller: new AbortController() }
function cancelCurrent(): void {
  current.cancelled = true
  current.controller.abort()
}
// A resolve still running when the page goes away must not touch the next page (route outcome, title, header).
onScopeDispose(cancelCurrent)

watch(
  [key, attempt],
  async ([k]) => {
    cancelCurrent()
    const mine: Token = { cancelled: false, controller: new AbortController() }
    current = mine
    resolved.value = null
    failed.value = false
    if (!Number.isInteger(chapterId.value) || chapterId.value <= 0) {
      setRouteOutcome(404)
      return
    }
    try {
      const hit = await resolveLevel(code.value, chapterId.value, mine)
      if (mine.cancelled) return
      if (!hit) {
        setRouteOutcome(404)
        return
      }
      pageMeta.setTitle(`Bab ${hit.subjectName} - PRESTASIPLUS`)
      pageMeta.setHeader({ title: 'Soalan Mengikut Bab', subtitle: hit.subjectName })
      resolved.value = { key: k, ...hit }
    } catch (err) {
      if (mine.cancelled) return
      if (isApiError(err) && err.status === 404) setRouteOutcome(404)
      else failed.value = true
    }
  },
  { immediate: true },
)

const start = computed<StartSessionRequest>(() => ({
  mode: 'chapter',
  chapterId: chapterId.value,
  count: count.value,
}))
const listUrl = computed(() =>
  chapterListHref(code.value, resolved.value ? resolved.value.levelId : null),
)

const headerTitle = (s: StartSessionResponse): string => chapterQuizTitle(s.chapter)
</script>

<template>
  <QuizRunner
    v-if="resolved"
    :key="`${resolved.key}?${String(count)}`"
    :start="start"
    :header-title="headerTitle"
    :back-url="listUrl"
    :locked-url="listUrl"
    retry="restart"
    :report="{ source: 'latihan' }"
  />
  <!-- The same loading look as the runner while the level is looked up (no blank page). -->
  <QuizLoading
    v-else-if="!failed"
    :title="PRACTICE_LABELS.loadingTitle"
    :text="PRACTICE_LABELS.loadingText"
    data-testid="chapter-quiz-resolving"
  />
  <DsLoadError
    v-else
    message="Maaf, berlaku ralat. Sila cuba semula."
    retry-testid="chapter-quiz-retry"
    testid="chapter-quiz-error"
    @retry="attempt += 1"
  />
</template>
