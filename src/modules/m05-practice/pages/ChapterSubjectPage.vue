<script setup lang="ts">
/**
 * S5 `/practice/chapter/:code` (`?level=`) "Chapter {subject} - PRESTASIPLUS" (M05-T5; FR-M05-59…65,
 * 67, 132; BR-11, BR-15, BR-16; DV-M05-07, DV-M05-09, DV-M05-15), restyled for v2 (batch B01).
 *
 * - Title block: "Semua Subjek" → S4, "Progressive Unlock", the subject and the level select; a change
 *   navigates to `?level={id}`. With no offered level the select is not rendered (DV-M05-07).
 * - One card per chapter of the level: open (count links to Q2) or locked, from the API (BR-16);
 *   no chapter → `Tiada bab tersedia untuk tahap ini.`.
 * - The shell subtitle is the subject name (FR-M05-59). An unknown code is the global 404 page.
 *   The page reads the API on every visit, so the stats and unlock state are fresh after a session
 *   (FR-M05-67).
 */
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'
import { DsEmptyState, DsLoadError } from '@/ds'
import { formatCount } from '@/lib/number'

import { fetchChapterSubject } from '../api/practice'
import { chapterListHref, parseLevelParam } from '../components/chapter/chapter-lib'
import ChapterCardItem from '../components/chapter/ChapterCardItem.vue'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const code = computed(() => String(route.params.code ?? ''))
const levelParam = computed(() => parseLevelParam(route.query.level))

const { data, error, reload } = useApi(
  (signal) => fetchChapterSubject(code.value, { levelId: levelParam.value }, { signal }),
  [code, levelParam],
)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

// FR-M05-59: tab title "Chapter {subject} - PRESTASIPLUS"; shell subtitle "{subject}".
watch(
  data,
  (d) => {
    if (!d) return
    pageMeta.setTitle(`Chapter ${d.subject.name} - PRESTASIPLUS`)
    pageMeta.setHeader({ title: 'Soalan by Chapter', subtitle: d.subject.name })
  },
  { immediate: true },
)

const levelItems = computed(() =>
  (data.value?.levels ?? []).map((l) => ({
    label: `${l.name} — ${formatCount(l.count)} soalan`,
    value: l.id,
  })),
)

/** The select value is a number in mock mode and a digit string (the API id) in http mode. */
function onLevelChange(id: unknown): void {
  const level =
    typeof id === 'number' ? id : typeof id === 'string' && /^\d+$/.test(id) ? Number(id) : Number.NaN
  if (Number.isNaN(level)) return
  void router.push(chapterListHref(code.value, level))
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="chapter-subject-page">
    <h1 v-if="!data" class="sr-only">Soalan by Chapter</h1>
    <template v-if="data">
      <div class="flex flex-col gap-3" data-testid="chapter-subject-hero">
        <UButton
          to="/practice/chapter"
          color="neutral"
          variant="ghost"
          icon="i-ph-arrow-left-bold"
          class="min-h-11 self-start"
          data-testid="chapter-all-subjects"
          >Semua Subjek</UButton
        >
        <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div class="flex min-w-0 flex-col gap-1">
            <p class="text-overline text-primary-t">Progressive Unlock</p>
            <h1 class="text-title text-highlighted" data-testid="chapter-subject-name">
              {{ data.subject.name }}
            </h1>
            <p class="max-w-prose text-body text-muted">
              Lengkapkan semua soalan bab semasa dan capai 70% untuk buka bab seterusnya.
            </p>
          </div>
          <USelect
            v-if="data.levels.length > 0"
            :model-value="data.levelId ?? undefined"
            :items="levelItems"
            size="xl"
            class="w-full lg:w-80"
            aria-label="Tahap pendidikan"
            data-testid="chapter-level-select"
            @update:model-value="onLevelChange"
          />
        </div>
      </div>

      <div class="flex flex-col gap-3 md:gap-4" data-testid="chapter-list">
        <ChapterCardItem v-for="c in data.chapters" :key="c.id" :code="code" :chapter="c" />
        <DsEmptyState
          v-if="data.chapters.length === 0"
          title="Tiada bab tersedia untuk tahap ini."
          icon="stack"
          data-testid="chapter-empty"
        />
      </div>
    </template>

    <DsLoadError
      v-else-if="error && !notFound"
      :message="LOAD_ERROR"
      retry-testid="chapter-retry"
      testid="chapter-error"
      @retry="reload()"
    />
  </div>
</template>
