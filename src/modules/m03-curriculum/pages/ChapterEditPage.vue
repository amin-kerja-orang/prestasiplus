<script setup lang="ts">
/**
 * S3 `/admin/curriculum/chapters/:id/edit` "Edit Bab - Admin PRESTASIPLUS" (M03-T3; FR-M03-28..31).
 * Loads the chapter (#14) and fills the FR-26 fields plus "Aktif". An unknown id redirects to S1 with the
 * one-time flash "Bab tidak dijumpai." (BR-18). Back link and "Batal" go to the tree of the chapter's current
 * pair; success goes to the tree of the saved (possibly new) pair with the flash.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsLoadError, DsPage } from '@/ds'

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
  reload: reloadChapter,
} = useApi(
  (signal) => fetchChapter(props.id, { signal }),
  () => props.id,
)
const {
  data: subjects,
  error: subjectsError,
  reload: reloadSubjects,
} = useApi((signal) => fetchSubjectOptions({ signal }))
const {
  data: levels,
  error: levelsError,
  reload: reloadLevels,
} = useApi((signal) => fetchLevelOptions({ signal }))

function retry(): void {
  void reloadChapter()
  void reloadSubjects()
  void reloadLevels()
}

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
  <DsPage class="max-w-3xl" data-testid="chapter-edit-page">
    <DsLoadError
      v-if="loadFailed"
      :message="LOAD_ERROR"
      testid="curriculum-load-error"
      @retry="retry"
    />
    <template v-else-if="ready">
      <DsBackLink :to="backTo" label="Kembali ke Kurikulum" data-testid="curriculum-back" />
      <UAlert
        v-if="errors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        data-testid="curriculum-form-alert"
      >
        <template #description>
          <p v-for="(line, i) in errors" :key="i">{{ line }}</p>
        </template>
      </UAlert>
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
  </DsPage>
</template>
