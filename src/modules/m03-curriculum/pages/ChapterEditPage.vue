<script setup lang="ts">
/**
 * S3 `/admin/curriculum/chapters/:id/edit` "Edit Bab - Admin PRESTASIPLUS" (M03-T3; FR-M03-28..31).
 * Loads the chapter (#14) and fills the FR-26 fields plus "Aktif". An unknown id redirects to S1 with the
 * one-time flash "Bab tidak dijumpai." (BR-18). Back link and "Batal" go to the tree of the chapter's current
 * pair; success goes to the tree of the saved (possibly new) pair with the flash.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import {
  fetchChapter,
  fetchLevelOptions,
  fetchSubjectOptions,
  updateChapter,
} from '../api/admin-curriculum'
import ChapterForm, {
  type ChapterFormPayload,
  type ChapterFormValues,
} from '../components/curriculum/ChapterForm.vue'
import CurriculumBackLink from '../components/curriculum/CurriculumBackLink.vue'
import {
  CURRICULUM_PATH,
  errorLines,
  FLASH_CHAPTER_NOT_FOUND,
  isNotFound,
  LOAD_ERROR,
  treeTo,
} from '../lib/curriculum-paths'

const props = defineProps<{ id: string }>()

const router = useRouter()
const flash = useFlash()

const {
  data: chapter,
  error: chapterError,
  loading: chapterLoading,
} = useApi(
  (signal) => fetchChapter(props.id, { signal }),
  () => props.id,
)
const { data: subjects, error: subjectsError } = useApi((signal) => fetchSubjectOptions({ signal }))
const { data: levels, error: levelsError } = useApi((signal) => fetchLevelOptions({ signal }))

watch(
  chapterError,
  (err) => {
    if (err && isNotFound(err)) {
      flash.error(FLASH_CHAPTER_NOT_FOUND)
      void router.replace(CURRICULUM_PATH)
    }
  },
  { immediate: true },
)

const loadFailed = computed(
  () =>
    (chapterError.value !== null && !isNotFound(chapterError.value)) ||
    subjectsError.value !== null ||
    levelsError.value !== null,
)
const ready = computed(
  () =>
    !chapterLoading.value &&
    chapter.value !== null &&
    subjects.value !== null &&
    levels.value !== null,
)

const initial = computed<ChapterFormValues>(() => {
  const c = chapter.value
  return {
    subjectId: c ? String(c.subjectId) : '',
    educationLevelId: c?.educationLevelId == null ? '' : String(c.educationLevelId),
    name: c?.name ?? '',
    nameEn: c?.nameEn ?? '',
    chapterNumber: c?.chapterNumber == null ? '' : String(c.chapterNumber),
    description: c?.description ?? '',
    isActive: c?.isActive ?? true,
  }
})

const backTo = computed(() => treeTo(chapter.value?.subjectId, chapter.value?.educationLevelId))

const saving = ref(false)
const errors = ref<string[]>([])

async function submit(payload: ChapterFormPayload): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = []
  try {
    const result = await updateChapter(props.id, payload)
    flash.success(result.status)
    await router.push(treeTo(payload.subjectId, payload.educationLevelId))
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl min-w-0 space-y-4" data-testid="chapter-edit-page">
    <AlertBox v-if="loadFailed" :messages="LOAD_ERROR" data-testid="curriculum-load-error" />
    <template v-else-if="ready">
      <CurriculumBackLink :to="backTo" />
      <AlertBox :messages="errors" data-testid="curriculum-form-alert" />
      <ChapterForm
        mode="edit"
        :subjects="subjects?.data ?? []"
        :levels="levels?.data ?? []"
        :initial="initial"
        :cancel-to="backTo"
        :saving="saving"
        @submit="submit"
      />
    </template>
  </div>
</template>
