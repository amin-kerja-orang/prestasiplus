<script setup lang="ts">
/**
 * S5 `/practice/chapter/:code` (`?level=`) "Chapter {subject} - PRESTASIPLUS" (M05-T5; FR-M05-59…65,
 * 67, 132; BR-11, BR-15, BR-16; DV-M05-07, DV-M05-09, DV-M05-15).
 *
 * - Dark hero: "Semua Subjek" → S4, "Progressive Unlock", the subject and the level select; a change
 *   navigates to `?level={id}`. With no offered level the select is not rendered (DV-M05-07).
 * - One card per chapter of the level: open (count links to Q2) or locked, from the API (BR-16);
 *   no chapter → `Tiada bab tersedia untuk tahap ini.`.
 * - The shell subtitle is the subject name (FR-M05-59). An unknown code is the global 404 page.
 *   The page reads the API on every visit, so the stats and unlock state are fresh after a session
 *   (FR-M05-67).
 */
import { ArrowLeft, Layers } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'
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

function onLevelChange(event: Event): void {
  const id = Number.parseInt((event.target as HTMLSelectElement).value, 10)
  if (Number.isNaN(id)) return
  void router.push(chapterListHref(code.value, id))
}
</script>

<template>
  <div class="space-y-6" data-testid="chapter-subject-page">
    <template v-if="data">
      <div
        class="rounded-3xl bg-gradient-to-br from-slate-900 via-teal-900 to-emerald-800 p-6 text-white"
        data-testid="chapter-subject-hero"
      >
        <RouterLink
          to="/practice/chapter"
          class="mb-4 inline-flex items-center text-sm text-emerald-100 hover:text-white max-lg:min-h-11"
          data-testid="chapter-all-subjects"
        >
          <ArrowLeft class="mr-2 h-4 w-4" /> Semua Subjek
        </RouterLink>
        <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p class="text-xs font-black tracking-[0.25em] text-emerald-200 uppercase">
              Progressive Unlock
            </p>
            <h1
              class="mt-2 font-heading text-2xl font-black text-white sm:text-4xl"
              data-testid="chapter-subject-name"
            >
              {{ data.subject.name }}
            </h1>
            <p class="mt-2 text-sm text-emerald-50">
              Lengkapkan semua soalan bab semasa dan capai 70% untuk buka bab seterusnya.
            </p>
          </div>
          <form v-if="data.levels.length > 0" @submit.prevent>
            <select
              name="level"
              :value="data.levelId ?? ''"
              class="max-w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white"
              data-testid="chapter-level-select"
              @change="onLevelChange"
            >
              <option
                v-for="l in data.levels"
                :key="l.id"
                :value="l.id"
                class="text-slate-900"
                :selected="l.id === data.levelId"
              >
                {{ l.name }} — {{ formatCount(l.count) }} soalan
              </option>
            </select>
          </form>
        </div>
      </div>

      <div class="space-y-4" data-testid="chapter-list">
        <ChapterCardItem v-for="c in data.chapters" :key="c.id" :code="code" :chapter="c" />
        <div
          v-if="data.chapters.length === 0"
          class="rounded-3xl border border-slate-100 bg-white p-10 text-center"
          data-testid="chapter-empty"
        >
          <Layers class="mx-auto h-10 w-10 text-slate-300" />
          <h3 class="mt-4 font-bold text-slate-700">Tiada bab tersedia untuk tahap ini.</h3>
        </div>
      </div>
    </template>

    <div v-else-if="error && !notFound" class="max-w-xl space-y-3" data-testid="chapter-error">
      <AlertBox :messages="LOAD_ERROR" />
      <button
        type="button"
        class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
        data-testid="chapter-retry"
        @click="reload()"
      >
        Cuba Semula
      </button>
    </div>
  </div>
</template>
