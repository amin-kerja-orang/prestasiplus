<script setup lang="ts">
/**
 * S4 `/admin/curriculum/topics/create?chapter_id=:id` "Tambah Topik - Admin PRESTASIPLUS" (M03-T3;
 * FR-M03-31..35). Without `chapter_id` -> S1 with "ID Bab diperlukan."; an unknown chapter -> S1 with
 * "Bab tidak dijumpai." (BR-18). Shows the chapter context card; success goes to the tree of the chapter's
 * pair with the flash.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsLoadError, DsPage } from '@/ds'

import { createTopic, fetchChapter } from '../api/admin-curriculum'
import ChapterContextCard from '../components/curriculum/ChapterContextCard.vue'
import TopicForm, {
  type TopicFormPayload,
  type TopicFormValues,
} from '../components/curriculum/TopicForm.vue'
import {
  CURRICULUM_PATH,
  errorLines,
  FLASH_CHAPTER_ID_REQUIRED,
  FLASH_CHAPTER_NOT_FOUND,
  isNotFound,
  LOAD_ERROR,
  treeTo,
} from '../lib/curriculum-paths'
import { queryString } from '../lib/query'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const chapterId = computed(() => queryString(route.query.chapter_id))
/** Leaving the page changes the query too; only act while S4 is the current route. */
const onPage = () => route.path.endsWith('/topics/create')

const {
  data: chapter,
  error: chapterError,
  loading: chapterLoading,
  reload: retry,
} = useApi(
  async (signal) => (chapterId.value === '' ? null : fetchChapter(chapterId.value, { signal })),
  chapterId,
)

watch(
  chapterId,
  (id) => {
    if (id === '' && onPage()) {
      flash.error(FLASH_CHAPTER_ID_REQUIRED)
      void router.replace(CURRICULUM_PATH)
    }
  },
  { immediate: true },
)

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

const loadFailed = computed(() => chapterError.value !== null && !isNotFound(chapterError.value))
const ready = computed(() => !chapterLoading.value && chapter.value !== null)

const initial: TopicFormValues = {
  name: '',
  nameEn: '',
  topicNumber: '',
  description: '',
  learningStandard: '',
  isActive: true,
}

const backTo = computed(() => treeTo(chapter.value?.subjectId, chapter.value?.educationLevelId))

const saving = ref(false)
const errors = ref<string[]>([])

async function submit(payload: TopicFormPayload): Promise<void> {
  const c = chapter.value
  if (saving.value || !c) return
  saving.value = true
  errors.value = []
  try {
    const result = await createTopic({
      chapterId: c.id,
      name: payload.name,
      nameEn: payload.nameEn,
      topicNumber: payload.topicNumber,
      description: payload.description,
      learningStandard: payload.learningStandard,
    })
    flash.success(result.status)
    await router.push(treeTo(c.subjectId, c.educationLevelId))
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage class="max-w-3xl" data-testid="topic-create-page">
    <DsLoadError
      v-if="loadFailed"
      :message="LOAD_ERROR"
      testid="curriculum-load-error"
      @retry="retry()"
    />
    <template v-else-if="ready && chapter">
      <DsBackLink :to="backTo" label="Kembali ke Kurikulum" data-testid="curriculum-back" />
      <ChapterContextCard :chapter="chapter" />
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
      <TopicForm
        mode="create"
        :initial="initial"
        :cancel-to="backTo"
        :saving="saving"
        @submit="submit"
      />
    </template>
  </DsPage>
</template>
