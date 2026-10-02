<script setup lang="ts">
/**
 * S2 `/admin/curriculum/chapters/create` "Tambah Bab - Admin PRESTASIPLUS" (M03-T3; FR-M03-25..27).
 * The selects are pre-selected from `?subject_id=&education_level_id=`; the back link and "Batal" carry
 * exactly the parameters received. Success goes to the S1 tree of the saved pair with the flash;
 * a server `VALIDATION_ERROR` stays here in the red box and keeps the input.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { createChapter, fetchLevelOptions, fetchSubjectOptions } from '../api/admin-curriculum'
import ChapterForm, {
  type ChapterFormPayload,
  type ChapterFormValues,
} from '../components/curriculum/ChapterForm.vue'
import CurriculumBackLink from '../components/curriculum/CurriculumBackLink.vue'
import { errorLines, LOAD_ERROR, treeTo } from '../lib/curriculum-paths'
import { queryString } from '../lib/query'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const subjectParam = queryString(route.query.subject_id)
const levelParam = queryString(route.query.education_level_id)

const { data: subjects, error: subjectsError } = useApi((signal) => fetchSubjectOptions({ signal }))
const { data: levels, error: levelsError } = useApi((signal) => fetchLevelOptions({ signal }))

const ready = computed(() => subjects.value !== null && levels.value !== null)
const loadFailed = computed(() => subjectsError.value !== null || levelsError.value !== null)

const initial: ChapterFormValues = {
  subjectId: subjectParam,
  educationLevelId: levelParam,
  name: '',
  nameEn: '',
  chapterNumber: '',
  description: '',
  isActive: true,
}

const saving = ref(false)
const errors = ref<string[]>([])

async function submit(payload: ChapterFormPayload): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = []
  try {
    const result = await createChapter({
      subjectId: payload.subjectId,
      educationLevelId: payload.educationLevelId,
      name: payload.name,
      nameEn: payload.nameEn,
      chapterNumber: payload.chapterNumber,
      description: payload.description,
    })
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
  <div class="mx-auto max-w-3xl min-w-0 space-y-4" data-testid="chapter-create-page">
    <CurriculumBackLink :to="treeTo(subjectParam, levelParam)" />
    <AlertBox v-if="loadFailed" :messages="LOAD_ERROR" data-testid="curriculum-load-error" />
    <template v-else-if="ready">
      <AlertBox :messages="errors" data-testid="curriculum-form-alert" />
      <ChapterForm
        mode="create"
        :subjects="subjects?.data ?? []"
        :levels="levels?.data ?? []"
        :initial="initial"
        :cancel-to="treeTo(subjectParam, levelParam)"
        :saving="saving"
        @submit="submit"
      />
    </template>
  </div>
</template>
