<script setup lang="ts">
/**
 * S13 `/admin/audio-kbat/create` "Cipta Set Audio KBAT" (M09; FR-M09-66..71, BR-M09-15). Admin shell,
 * header title only (no subtitle, DV-M09-08).
 *
 * - "Kembali", h1, the format line and the guide box with the template links (DV-M09-20: readable).
 * - Card "Maklumat Set" (status defaults to "Approved"), then 4 section cards each followed by its
 *   questions (8 / 8 / 8 / 6, 30 in all). Native HTML5 validation only: the empty form has 153
 *   invalid required fields and sends nothing.
 * - One sticky bottom-right submit "Simpan Set Audio KBAT" (no "Batal"). A valid submit sends the
 *   multipart `POST /api/admin/audio-kbat-sets`; 201 goes to S12 with the success flash, a 422 shows
 *   in the red box and under the fields and keeps every value.
 */
import { ArrowLeft, Save } from '@lucide/vue'
import { computed, nextTick, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { createAudioSet, fetchLevelOptions, fetchSubjectOptions } from '../api/admin-media'
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
import {
  AUDIO_PATH,
  COPY,
  ERROR_BORDER_CLASS,
  ERROR_TEXT_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  errorLines,
  fieldErrors,
} from '../lib/admin-media/common'

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

const field = (name: string): string[] => [
  INPUT_CLASS,
  ...(errors.value[name] ? [ERROR_BORDER_CLASS] : []),
]

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
  <div class="min-w-0 space-y-5" data-testid="audio-create-page">
    <div>
      <RouterLink
        :to="AUDIO_PATH"
        class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
        data-testid="audio-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali
      </RouterLink>
      <h1 class="font-heading text-3xl font-bold text-slate-900">Cipta Set Audio KBAT</h1>
      <p class="mt-1 text-sm text-slate-500">
        Format fixed: 4 audio section, 30 soalan MCQ, soalan dipaparkan serentak mengikut section.
      </p>
    </div>

    <div
      class="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-blue-100 bg-blue-50 p-4"
      data-testid="audio-guide"
    >
      <div class="min-w-0 flex-1 space-y-1.5 text-sm text-slate-700 sm:min-w-64">
        <p class="font-semibold text-slate-900">{{ CREATE_GUIDE.title }}</p>
        <p v-for="text in CREATE_GUIDE.paragraphs" :key="text">{{ text }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <AudioTemplateLink kind="word" />
        <AudioTemplateLink kind="xlsx" />
      </div>
    </div>

    <AlertBox v-if="lookupFailed" :messages="COPY.loadFailed" data-testid="audio-load-error" />

    <form
      v-else
      method="post"
      enctype="multipart/form-data"
      class="space-y-5"
      data-testid="audio-form"
      @submit.prevent="submit"
    >
      <div ref="alertRef">
        <AlertBox :messages="boxMessages" data-testid="audio-form-alert" />
      </div>

      <section class="space-y-4 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 class="font-heading text-lg font-bold text-slate-800">Maklumat Set</h2>
        <div>
          <label for="set-title" :class="LABEL_CLASS">Tajuk Set</label>
          <input
            id="set-title"
            v-model="form.title"
            type="text"
            name="title"
            required
            placeholder="Contoh: BM T4 Ujian Mendengar Set 1"
            :class="field('title')"
            data-testid="set-title"
          />
          <p v-if="errors.title" :class="ERROR_TEXT_CLASS">{{ errors.title }}</p>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label for="set-level" :class="LABEL_CLASS">Tahap</label>
            <select
              id="set-level"
              v-model="form.educationLevelId"
              name="education_level_id"
              required
              :class="field('educationLevelId')"
              data-testid="set-level"
            >
              <option value="">Pilih Tahap</option>
              <option v-for="level in levels?.data ?? []" :key="level.id" :value="level.id">
                {{ level.name }}
              </option>
            </select>
            <p v-if="errors.educationLevelId" :class="ERROR_TEXT_CLASS">
              {{ errors.educationLevelId }}
            </p>
          </div>
          <div>
            <label for="set-subject" :class="LABEL_CLASS">Subjek</label>
            <select
              id="set-subject"
              v-model="form.subjectId"
              name="subject_id"
              required
              :class="field('subjectId')"
              data-testid="set-subject"
            >
              <option value="">Pilih Subjek</option>
              <option v-for="subject in subjectOptions" :key="subject.id" :value="subject.id">
                {{ subject.name }}
              </option>
            </select>
            <p v-if="errors.subjectId" :class="ERROR_TEXT_CLASS">{{ errors.subjectId }}</p>
          </div>
          <div>
            <label for="set-status" :class="LABEL_CLASS">Status</label>
            <select
              id="set-status"
              v-model="form.status"
              name="status"
              :class="field('status')"
              data-testid="set-status"
            >
              <option v-for="s in CREATE_STATUS_OPTIONS" :key="s.value" :value="s.value">
                {{ s.label }}
              </option>
            </select>
          </div>
          <div>
            <label for="set-source" :class="LABEL_CLASS">Sumber / Penyumbang</label>
            <input
              id="set-source"
              v-model="form.sourceLabel"
              type="text"
              name="source_label"
              placeholder="Contoh: Cikgu Demo 02"
              :class="field('sourceLabel')"
              data-testid="set-source"
            />
          </div>
        </div>
        <div>
          <label for="set-instructions" :class="LABEL_CLASS">Arahan Umum</label>
          <textarea
            id="set-instructions"
            v-model="form.instructions"
            name="instructions"
            rows="3"
            placeholder="Dengar audio bagi setiap bahagian dan jawab semua soalan."
            :class="field('instructions')"
            data-testid="set-instructions"
          ></textarea>
        </div>
      </section>

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

      <div
        class="pointer-events-none sticky bottom-[calc(61px+env(safe-area-inset-bottom))] z-40 flex justify-end lg:bottom-4"
      >
        <button
          type="submit"
          :disabled="saving"
          class="pointer-events-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          data-testid="audio-submit"
        >
          <LoadingSpinner v-if="saving" class="h-4 w-4" />
          <Save v-else class="h-4 w-4" aria-hidden="true" />
          Simpan Set Audio KBAT
        </button>
      </div>
    </form>
  </div>
</template>
