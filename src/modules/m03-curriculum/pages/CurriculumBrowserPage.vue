<script setup lang="ts">
/**
 * S1 `/admin/curriculum` "Pengurusan Kurikulum - Admin PRESTASIPLUS" (M03-T3; FR-M03-01..24).
 *
 * Filter card "Tapis Kurikulum" (GET form: `?subject_id=&education_level_id=`); with both parameters the
 * tree (#13) is fetched and shown with 4 summary cards, "Tambah Bab" and the chapter -> topic -> subtopic
 * tree; otherwise only the prompt card. Deleting a chapter/topic/subtopic (native confirm) and adding or
 * saving a subtopic send the mutation, reload the same tree (collapsed again, as after a live redirect)
 * and show the flash. Redirect flashes (BR-18) are shown by the shell once, after navigation.
 */
import { Funnel, Inbox, Info, Plus, Search } from '@lucide/vue'
import { computed, provide, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { FORM_SELECT_CLASS } from '@/components/form'
import { confirmNative } from '@/components/overlay/native-dialogs'
import { useApi, useFlash } from '@/composables'

import {
  createSubtopic,
  deleteChapter,
  deleteSubtopic,
  deleteTopic,
  fetchCurriculumTree,
  fetchLevelOptions,
  fetchSubjectOptions,
  updateSubtopic,
  type CurriculumMutation,
} from '../api/admin-curriculum'
import ChapterBlock from '../components/curriculum/ChapterBlock.vue'
import CurriculumStatCards from '../components/curriculum/CurriculumStatCards.vue'
import {
  CURRICULUM_PATH,
  chapterCreateTo,
  errorLines,
  isNotFound,
  LOAD_ERROR,
} from '../lib/curriculum-paths'
import { queryString } from '../lib/query'
import { TREE_ACTIONS, type TreeActions } from '../lib/tree-actions'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const subjectParam = computed(() => queryString(route.query.subject_id))
const levelParam = computed(() => queryString(route.query.education_level_id))
const hasPair = computed(() => subjectParam.value !== '' && levelParam.value !== '')

const { data: subjects, error: subjectsError } = useApi((signal) => fetchSubjectOptions({ signal }))
const { data: levels, error: levelsError } = useApi((signal) => fetchLevelOptions({ signal }))

const {
  data: tree,
  error: treeError,
  loading: treeLoading,
  reload,
} = useApi(
  async (signal) =>
    hasPair.value ? fetchCurriculumTree(subjectParam.value, levelParam.value, { signal }) : null,
  [subjectParam, levelParam],
)

const subjectSel = ref(subjectParam.value)
const levelSel = ref(levelParam.value)
watch([subjectParam, levelParam], ([s, l]) => {
  subjectSel.value = s
  levelSel.value = l
})

/** The form is a GET form (FR-M03-03): empty values go out as empty parameters. */
async function applyFilter(): Promise<void> {
  const failure = await router.push({
    path: CURRICULUM_PATH,
    query: { subject_id: subjectSel.value, education_level_id: levelSel.value },
  })
  // Same URL again: a GET form reloads the page.
  if (failure) {
    flash.clear()
    await reload()
  }
}

const optionsReady = computed(() => subjects.value !== null && levels.value !== null)
const optionsFailed = computed(() => subjectsError.value !== null || levelsError.value !== null)
const treeFailed = computed(() => treeError.value !== null)
const showTree = computed(() => hasPair.value && !treeLoading.value && tree.value !== null)

// --- Mutations: confirm, send, reload the tree, flash (FR-M03-10, 14, 18, 19, 21).
const busy = ref(false)

async function mutate(run: () => Promise<CurriculumMutation<unknown>>): Promise<boolean> {
  if (busy.value) return false
  busy.value = true
  try {
    const result = await run()
    await reload()
    // A failed reload shows the load-error box instead; no success flash next to it.
    if (treeError.value === null) {
      flash.show({ type: 'success', message: result.status })
      window.scrollTo?.({ top: 0 })
    }
    return true
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
    window.scrollTo?.({ top: 0 })
    // A 404 means the tree on screen is stale: show the current one.
    if (isNotFound(err)) await reload()
    return false
  } finally {
    busy.value = false
  }
}

const actions: TreeActions = {
  async deleteChapter(chapter) {
    if (busy.value || !confirmNative('Adakah anda pasti mahu padam bab ini?')) return
    await mutate(() => deleteChapter(chapter.id))
  },
  async deleteTopic(topic) {
    if (busy.value || !confirmNative('Adakah anda pasti mahu padam topik ini?')) return
    await mutate(() => deleteTopic(topic.id))
  },
  async deleteSubtopic(subtopicId) {
    if (busy.value || !confirmNative('Adakah anda pasti mahu padam subtopik ini?')) return
    await mutate(() => deleteSubtopic(subtopicId))
  },
  saveSubtopic: (subtopicId, input) => mutate(() => updateSubtopic(subtopicId, input)),
  addSubtopic: (topicId, input) => mutate(() => createSubtopic({ topicId, ...input })),
}
provide(TREE_ACTIONS, actions)

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
</script>

<template>
  <div class="min-w-0 space-y-4 sm:space-y-6" data-testid="curriculum-page">
    <AlertBox
      v-if="optionsFailed || treeFailed"
      :messages="LOAD_ERROR"
      data-testid="curriculum-load-error"
    />

    <template v-if="optionsReady">
      <form
        method="get"
        class="rounded-2xl bg-white p-4 shadow sm:p-5"
        data-testid="curriculum-filter"
        @submit.prevent="applyFilter"
      >
        <h2 class="mb-4 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
          <Funnel class="h-4 w-4 text-indigo-500" />
          Tapis Kurikulum
        </h2>
        <div class="grid grid-cols-2 items-end gap-3 md:grid-cols-3 md:gap-4">
          <div class="min-w-0">
            <label for="cur-subject" :class="LABEL">Subjek</label>
            <select
              id="cur-subject"
              v-model="subjectSel"
              name="subject_id"
              :class="[FORM_SELECT_CLASS, 'min-h-11']"
              data-testid="curriculum-subject"
            >
              <option value="">-- Pilih Subjek --</option>
              <option v-for="s in subjects?.data ?? []" :key="s.id" :value="String(s.id)">
                {{ s.name }}
              </option>
            </select>
          </div>
          <div class="min-w-0">
            <label for="cur-level" :class="LABEL">Tahap</label>
            <select
              id="cur-level"
              v-model="levelSel"
              name="education_level_id"
              :class="[FORM_SELECT_CLASS, 'min-h-11']"
              data-testid="curriculum-level"
            >
              <option value="">-- Pilih Tahap --</option>
              <option v-for="l in levels?.data ?? []" :key="l.id" :value="String(l.id)">
                {{ l.name }}
              </option>
            </select>
          </div>
          <button
            type="submit"
            class="col-span-2 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 md:col-span-1"
            data-testid="curriculum-filter-submit"
          >
            <Search class="h-4 w-4" />
            Tapis
          </button>
        </div>
      </form>

      <div
        v-if="!hasPair"
        class="rounded-2xl bg-white p-8 text-center shadow sm:p-12"
        data-testid="curriculum-prompt"
      >
        <Info class="mx-auto mb-3 h-12 w-12 text-slate-300" />
        <p class="font-semibold text-slate-700">Sila pilih subjek dan tahap pendidikan</p>
        <p class="mt-1 text-sm text-slate-500">Gunakan penapis di atas</p>
      </div>

      <template v-else-if="showTree && tree">
        <CurriculumStatCards :tree="tree" />

        <div class="flex">
          <RouterLink
            :to="chapterCreateTo(subjectParam, levelParam)"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            data-testid="chapter-add"
          >
            <Plus class="h-4 w-4" />
            Tambah Bab
          </RouterLink>
        </div>

        <div class="rounded-2xl bg-white p-3 shadow sm:p-6" data-testid="curriculum-tree">
          <div v-if="tree.chapters.length === 0" class="py-8 text-center" data-testid="tree-empty">
            <Inbox class="mx-auto mb-3 h-12 w-12 text-slate-300" />
            <p class="text-slate-600">Tiada bab dijumpai untuk subjek dan tahap ini.</p>
            <RouterLink
              :to="chapterCreateTo(subjectParam, levelParam)"
              class="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
              data-testid="chapter-add-first"
            >
              <Plus class="h-4 w-4" />
              Tambah Bab Pertama
            </RouterLink>
          </div>
          <div v-else class="space-y-3 sm:space-y-4">
            <ChapterBlock v-for="c in tree.chapters" :key="c.id" :chapter="c" />
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
