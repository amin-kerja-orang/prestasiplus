<script setup lang="ts">
/**
 * S13 `/admin/audio-kbat/create` "Cipta Set Audio KBAT" (M09; FR-M09-66..71, BR-M09-15), v2 staff theme.
 * Admin shell, header title only (no subtitle, DV-M09-08).
 *
 * - "Kembali", the format line and the guide card with the template links (DV-M09-20: readable).
 * - Card "Maklumat Set" (status defaults to "Approved"), then 4 section cards each followed by its
 *   questions (8 / 8 / 8 / 6, 30 in all). Native HTML5 validation only: the empty form has 153
 *   invalid required fields and sends nothing.
 * - One sticky action bar with "Simpan Set Audio KBAT" (no "Batal"). A valid submit sends the
 *   multipart `POST /api/admin/audio-kbat-sets`; 201 goes to S12 with the success flash, a 422 shows
 *   in the red box and under the fields and keeps every value.
 */
import { computed, nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import { DsPage } from '@/ds'

import { createAudioSet, fetchLevelOptions, fetchSubjectOptions } from '../api/admin-media'
import AdminBackLink from '../components/admin-articles-notes/AdminBackLink.vue'
import AdminAlert from '../components/admin-kit/AdminAlert.vue'
import AdminField from '../components/admin-kit/AdminField.vue'
import AdminSection from '../components/admin-kit/AdminSection.vue'
import NativeSelect from '../components/admin-kit/native/NativeSelect.vue'
import AudioQuestionBlock from '../components/admin-media/AudioQuestionBlock.vue'
import AudioSectionCard from '../components/admin-media/AudioSectionCard.vue'
import AudioTemplateLink from '../components/admin-media/AudioTemplateLink.vue'
import {
  CREATE_GUIDE,
  CREATE_STATUS_OPTIONS,
  SECTION_RANGES,
  audioSetPayload,
  emptyAudioSetForm,
  sortByName,
  type QuestionState,
  type SectionState,
} from '../lib/admin-media/audio'
import { AUDIO_PATH, COPY, errorLines, fieldErrors } from '../lib/admin-media/common'

const router = useRouter()
const flash = useFlash()

const form = reactive(emptyAudioSetForm())

const { data: levels, error: levelsError } = useApi((signal) => fetchLevelOptions({ signal }))
const { data: subjects, error: subjectsError } = useApi((signal) => fetchSubjectOptions({ signal }))
const subjectOptions = computed(() => sortByName(subjects.value?.data ?? []))
const lookupFailed = computed(() => levelsError.value !== null || subjectsError.value !== null)

/** The state objects of the section and question children (they edit them in place). */
const sectionAt = (index: number): SectionState => form.sections[index] as SectionState
const questionAt = (index: number): QuestionState => form.questions[index] as QuestionState

const saving = ref(false)
const errors = ref<Record<string, string>>({})
const failure = ref<string[]>([])
const alertRef = ref<HTMLElement | null>(null)

const TOP_FIELDS = ['title', 'educationLevelId', 'subjectId']

/** Messages with no field of their own (incl. the nested `questions.n.…` keys) go in the red box. */
const boxMessages = computed(() => {
  const unmatched = Object.entries(errors.value)
    .filter(([key]) => !TOP_FIELDS.includes(key))
    .map(([, message]) => message)
  return [...new Set([...failure.value, ...unmatched])]
})

const invalid = (name: string): boolean => errors.value[name] !== undefined

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = {}
  failure.value = []
  try {
    const result = await createAudioSet(audioSetPayload(form))
    flash.success(result.status)
    await router.push(AUDIO_PATH)
  } catch (err) {
    errors.value = fieldErrors(err)
    if (Object.keys(errors.value).length === 0) failure.value = errorLines(err)
    await nextTick()
    alertRef.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage data-testid="audio-create-page">
    <div class="flex flex-col gap-2">
      <AdminBackLink :to="AUDIO_PATH" label="Kembali" />
      <p class="text-body text-muted">
        Format fixed: 4 audio section, 30 soalan MCQ, soalan dipaparkan serentak mengikut section.
      </p>
    </div>

    <UAlert
      color="info"
      variant="subtle"
      icon="i-ph-info"
      :title="CREATE_GUIDE.title"
      data-testid="audio-guide"
    >
      <template #description>
        <div class="flex flex-col gap-3">
          <p v-for="text in CREATE_GUIDE.paragraphs" :key="text">{{ text }}</p>
          <div class="flex flex-wrap gap-3">
            <AudioTemplateLink kind="word" />
            <AudioTemplateLink kind="xlsx" />
          </div>
        </div>
      </template>
    </UAlert>

    <AdminAlert v-if="lookupFailed" :messages="[COPY.loadFailed]" data-testid="audio-load-error" />

    <form
      v-else
      method="post"
      enctype="multipart/form-data"
      class="flex min-w-0 flex-col gap-6"
      data-testid="audio-form"
      @submit.prevent="submit"
    >
      <div ref="alertRef">
        <AdminAlert :messages="boxMessages" data-testid="audio-form-alert" />
      </div>

      <AdminSection title="Maklumat Set" icon="i-ph-list-checks" accent="action">
        <AdminField for="set-title" label="Tajuk Set" :error="errors.title">
          <UInput
            id="set-title"
            v-model="form.title"
            type="text"
            name="title"
            required
            placeholder="Contoh: BM T4 Ujian Mendengar Set 1"
            size="md"
            class="w-full"
            :color="invalid('title') ? 'error' : undefined"
            data-testid="set-title"
          />
        </AdminField>
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <AdminField for="set-level" label="Tahap" :error="errors.educationLevelId">
            <NativeSelect
              id="set-level"
              v-model="form.educationLevelId"
              name="education_level_id"
              required
              :aria-invalid="invalid('educationLevelId') ? 'true' : undefined"
              data-testid="set-level"
            >
              <option value="">Pilih Tahap</option>
              <option v-for="level in levels?.data ?? []" :key="level.id" :value="level.id">
                {{ level.name }}
              </option>
            </NativeSelect>
          </AdminField>
          <AdminField for="set-subject" label="Subjek" :error="errors.subjectId">
            <NativeSelect
              id="set-subject"
              v-model="form.subjectId"
              name="subject_id"
              required
              :aria-invalid="invalid('subjectId') ? 'true' : undefined"
              data-testid="set-subject"
            >
              <option value="">Pilih Subjek</option>
              <option v-for="subject in subjectOptions" :key="subject.id" :value="subject.id">
                {{ subject.name }}
              </option>
            </NativeSelect>
          </AdminField>
          <AdminField for="set-status" label="Status">
            <NativeSelect
              id="set-status"
              v-model="form.status"
              name="status"
              data-testid="set-status"
            >
              <option v-for="s in CREATE_STATUS_OPTIONS" :key="s.value" :value="s.value">
                {{ s.label }}
              </option>
            </NativeSelect>
          </AdminField>
          <AdminField for="set-source" label="Sumber / Penyumbang">
            <UInput
              id="set-source"
              v-model="form.sourceLabel"
              type="text"
              name="source_label"
              placeholder="Contoh: Cikgu Demo 02"
              size="md"
              class="w-full"
              data-testid="set-source"
            />
          </AdminField>
        </div>
        <AdminField for="set-instructions" label="Arahan Umum">
          <UTextarea
            id="set-instructions"
            v-model="form.instructions"
            name="instructions"
            :rows="3"
            placeholder="Dengar audio bagi setiap bahagian dan jawab semua soalan."
            size="md"
            class="w-full"
            data-testid="set-instructions"
          />
        </AdminField>
      </AdminSection>

      <template v-for="(range, index) in SECTION_RANGES" :key="range.no">
        <AudioSectionCard
          :model-value="sectionAt(index)"
          :no="range.no"
          :from="range.from"
          :to="range.to"
        />
        <AudioQuestionBlock
          v-for="no in range.to - range.from + 1"
          :key="range.from + no - 1"
          :model-value="questionAt(range.from + no - 2)"
          :no="range.from + no - 1"
        />
      </template>

      <UCard class="sticky bottom-0" :ui="{ body: 'p-4 sm:p-6' }">
        <div class="flex justify-end">
          <UButton
            type="submit"
            icon="i-ph-floppy-disk"
            label="Simpan Set Audio KBAT"
            size="md"
            class="min-h-11"
            :loading="saving"
            :disabled="saving"
            data-testid="audio-submit"
          />
        </div>
      </UCard>
    </form>
  </DsPage>
</template>
