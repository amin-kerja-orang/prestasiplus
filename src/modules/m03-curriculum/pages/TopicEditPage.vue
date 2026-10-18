<script setup lang="ts">
/**
 * S5 `/admin/curriculum/topics/:id/edit` "Edit Topik - Admin PRESTASIPLUS" (M03-T3; FR-M03-36..38).
 * Loads the topic with its chapter (#18): context card, FR-33 fields pre-filled and "Aktif"; the chapter
 * cannot change. An unknown id -> S1 with "Topik tidak dijumpai." (BR-18). Success goes to the tree.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsLoadError, DsPage } from '@/ds'

import { fetchTopic, updateTopic } from '../api/admin-curriculum'
import ChapterContextCard from '../components/curriculum/ChapterContextCard.vue'
import TopicForm, {
  type TopicFormPayload,
  type TopicFormValues,
} from '../components/curriculum/TopicForm.vue'
import {
  CURRICULUM_PATH,
  errorLines,
  FLASH_TOPIC_NOT_FOUND,
  isNotFound,
  LOAD_ERROR,
  treeTo,
} from '../lib/curriculum-paths'

const props = defineProps<{ id: string }>()

const router = useRouter()
const flash = useFlash()

const {
  data: topic,
  error: topicError,
  loading: topicLoading,
  reload: retry,
} = useApi(
  (signal) => fetchTopic(props.id, { signal }),
  () => props.id,
)

watch(
  topicError,
  (err) => {
    if (err && isNotFound(err)) {
      flash.error(FLASH_TOPIC_NOT_FOUND)
      void router.replace(CURRICULUM_PATH)
    }
  },
  { immediate: true },
)

const loadFailed = computed(() => topicError.value !== null && !isNotFound(topicError.value))
const ready = computed(() => !topicLoading.value && topic.value !== null)

const initial = computed<TopicFormValues>(() => {
  const t = topic.value
  return {
    name: t?.name ?? '',
    nameEn: t?.nameEn ?? '',
    topicNumber: t?.topicNumber ?? '',
    description: t?.description ?? '',
    learningStandard: t?.learningStandard ?? '',
    isActive: t?.isActive ?? true,
  }
})

const backTo = computed(() =>
  treeTo(topic.value?.chapter.subjectId, topic.value?.chapter.educationLevelId),
)

const saving = ref(false)
const errors = ref<string[]>([])

async function submit(payload: TopicFormPayload): Promise<void> {
  const t = topic.value
  if (saving.value || !t) return
  saving.value = true
  errors.value = []
  try {
    const result = await updateTopic(props.id, payload)
    flash.success(result.status)
    await router.push(treeTo(t.chapter.subjectId, t.chapter.educationLevelId))
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage class="max-w-3xl" data-testid="topic-edit-page">
    <DsLoadError
      v-if="loadFailed"
      :message="LOAD_ERROR"
      testid="curriculum-load-error"
      @retry="retry()"
    />
    <template v-else-if="ready && topic">
      <DsBackLink :to="backTo" label="Kembali ke Kurikulum" data-testid="curriculum-back" />
      <ChapterContextCard :chapter="topic.chapter" />
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
        mode="edit"
        :initial="initial"
        :cancel-to="backTo"
        :saving="saving"
        @submit="submit"
      />
    </template>
  </DsPage>
</template>
