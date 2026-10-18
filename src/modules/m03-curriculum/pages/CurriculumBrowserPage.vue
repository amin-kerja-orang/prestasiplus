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
import { computed, provide, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsEmptyState, DsPage, DsPageHeader, DsPanel, useConfirm } from '@/ds'

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
import ErrorBox from '../components/ErrorBox.vue'
import {
  CURRICULUM_PATH,
  chapterCreateTo,
  errorLines,
  isNotFound,
  LOAD_ERROR,
} from '../lib/curriculum-paths'
import { queryString } from '../lib/query'
import { TREE_ACTIONS, type TreeActions } from '../lib/tree-actions'
import NativeSelect from '../components/native/NativeSelect.vue'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

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
    if (
      busy.value ||
      !(await confirm({ message: 'Adakah anda pasti mahu padam bab ini?', tone: 'danger' }))
    )
      return
    await mutate(() => deleteChapter(chapter.id))
  },
  async deleteTopic(topic) {
    if (
      busy.value ||
      !(await confirm({ message: 'Adakah anda pasti mahu padam topik ini?', tone: 'danger' }))
    )
      return
    await mutate(() => deleteTopic(topic.id))
  },
  async deleteSubtopic(subtopicId) {
    if (
      busy.value ||
      !(await confirm({ message: 'Adakah anda pasti mahu padam subtopik ini?', tone: 'danger' }))
    )
      return
    await mutate(() => deleteSubtopic(subtopicId))
  },
  saveSubtopic: (subtopicId, input) => mutate(() => updateSubtopic(subtopicId, input)),
  addSubtopic: (topicId, input) => mutate(() => createSubtopic({ topicId, ...input })),
}
provide(TREE_ACTIONS, actions)
</script>

<template>
  <DsPage data-testid="curriculum-page">
    <DsPageHeader
      title="Pengurusan Kurikulum"
      subtitle="Urus bab, topik dan subtopik mengikut subjek dan tahap."
    >
      <template v-if="showTree && tree" #actions>
        <UButton
          :to="chapterCreateTo(subjectParam, levelParam)"
          icon="i-ph-plus"
          label="Tambah Bab"
          data-testid="chapter-add"
        />
      </template>
    </DsPageHeader>

    <ErrorBox
      v-if="optionsFailed || treeFailed"
      :messages="LOAD_ERROR"
      data-testid="curriculum-load-error"
    />

    <template v-if="optionsReady">
      <DsPanel
        flush
        as="form"
        method="get"
        data-testid="curriculum-filter"
        @submit.prevent="applyFilter"
      >
        <div class="flex flex-col gap-4 p-4 md:flex-row md:items-end md:p-6">
          <div class="min-w-0 md:flex-1">
            <label for="cur-subject" class="mb-2 block text-label text-highlighted">Subjek</label>
            <NativeSelect
              id="cur-subject"
              v-model="subjectSel"
              name="subject_id"
              data-testid="curriculum-subject"
            >
              <option value="">-- Pilih Subjek --</option>
              <option v-for="s in subjects?.data ?? []" :key="s.id" :value="String(s.id)">
                {{ s.name }}
              </option>
            </NativeSelect>
          </div>
          <div class="min-w-0 md:flex-1">
            <label for="cur-level" class="mb-2 block text-label text-highlighted">Tahap</label>
            <NativeSelect
              id="cur-level"
              v-model="levelSel"
              name="education_level_id"
              data-testid="curriculum-level"
            >
              <option value="">-- Pilih Tahap --</option>
              <option v-for="l in levels?.data ?? []" :key="l.id" :value="String(l.id)">
                {{ l.name }}
              </option>
            </NativeSelect>
          </div>
          <UButton
            type="submit"
            icon="i-ph-funnel"
            class="justify-center"
            data-testid="curriculum-filter-submit"
          >
            Tapis
          </UButton>
        </div>
      </DsPanel>

      <DsPanel v-if="!hasPair" flush data-testid="curriculum-prompt">
        <div class="p-6">
          <DsEmptyState
            title="Sila pilih subjek dan tahap pendidikan"
            description="Gunakan penapis di atas"
            icon="i-ph-info"
          />
        </div>
      </DsPanel>

      <template v-else-if="showTree && tree">
        <CurriculumStatCards :tree="tree" />

        <div class="flex flex-col gap-4" data-testid="curriculum-tree">
          <DsPanel v-if="tree.chapters.length === 0" flush data-testid="tree-empty">
            <div class="p-6">
              <DsEmptyState title="Tiada bab dijumpai untuk subjek dan tahap ini." icon="i-ph-tray">
                <template #actions>
                  <UButton
                    :to="chapterCreateTo(subjectParam, levelParam)"
                    icon="i-ph-plus"
                    data-testid="chapter-add-first"
                  >
                    Tambah Bab Pertama
                  </UButton>
                </template>
              </DsEmptyState>
            </div>
          </DsPanel>
          <template v-else>
            <ChapterBlock v-for="c in tree.chapters" :key="c.id" :chapter="c" />
          </template>
        </div>
      </template>
    </template>
  </DsPage>
</template>
