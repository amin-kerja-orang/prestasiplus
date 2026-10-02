<script setup lang="ts">
/**
 * S5 `/admin/curriculum/topics/:id/edit` "Edit Topik - Admin PRESTASIPLUS" (M03-T3; FR-M03-36..38).
 * Loads the topic with its chapter (#18): context card, FR-33 fields pre-filled and "Aktif"; the chapter
 * cannot change. An unknown id -> S1 with "Topik tidak dijumpai." (BR-18). Success goes to the tree.
 */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { fetchTopic, updateTopic } from '../api/admin-curriculum'
import ChapterContextCard from '../components/curriculum/ChapterContextCard.vue'
import CurriculumBackLink from '../components/curriculum/CurriculumBackLink.vue'
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
  <div class="mx-auto max-w-3xl min-w-0 space-y-4" data-testid="topic-edit-page">
    <AlertBox v-if="loadFailed" :messages="LOAD_ERROR" data-testid="curriculum-load-error" />
    <template v-else-if="ready && topic">
      <CurriculumBackLink :to="backTo" />
      <ChapterContextCard :chapter="topic.chapter" />
      <AlertBox :messages="errors" data-testid="curriculum-form-alert" />
      <TopicForm
        mode="edit"
        :initial="initial"
        :cancel-to="backTo"
        :saving="saving"
        @submit="submit"
      />
    </template>
  </div>
</template>
