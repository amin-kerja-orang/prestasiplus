<script setup lang="ts">
/**
 * Chapter form card shared by S2 (create) and S3 (edit) (FR-M03-26, 29): "Subjek *", "Tahap Pendidikan *",
 * "Nama Bab (Bahasa Melayu) *", "Nama Bab (English)", "Nombor Bab", "Penerangan"; S3 adds "Aktif". Native
 * HTML5 validation only. The parent owns the request; this component keeps the typed values and
 * emits `submit`. "Batal" and the submit button stay on one row, right-aligned, at every width.
 */
import { Info, Save } from '@lucide/vue'
import { reactive, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { FORM_INPUT_CLASS, FORM_SELECT_CLASS, FORM_TEXTAREA_CLASS } from '@/components/form'

import type { LevelOption, SubjectOption } from '../../api/admin-curriculum'
import { orNull } from '../../lib/curriculum-paths'

export interface ChapterFormValues {
  subjectId: string
  educationLevelId: string
  name: string
  nameEn: string
  chapterNumber: string
  description: string
  isActive: boolean
}

export interface ChapterFormPayload {
  subjectId: number | null
  educationLevelId: number | null
  name: string
  nameEn: string | null
  chapterNumber: number | null
  description: string | null
  isActive: boolean
}

const props = defineProps<{
  mode: 'create' | 'edit'
  subjects: readonly SubjectOption[]
  levels: readonly LevelOption[]
  initial: ChapterFormValues
  cancelTo: RouteLocationRaw
  saving?: boolean
}>()

const emit = defineEmits<{ submit: [payload: ChapterFormPayload] }>()

const form = reactive<ChapterFormValues>({ ...props.initial })
watch(
  () => props.initial,
  (next) => Object.assign(form, next),
)

function onSubmit(): void {
  emit('submit', {
    subjectId: form.subjectId === '' ? null : Number(form.subjectId),
    educationLevelId: form.educationLevelId === '' ? null : Number(form.educationLevelId),
    name: form.name,
    nameEn: orNull(form.nameEn),
    chapterNumber: form.chapterNumber === '' ? null : Number(form.chapterNumber),
    description: orNull(form.description),
    isActive: form.isActive,
  })
}

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
const HINT = 'mt-1.5 flex items-center gap-1.5 text-xs text-slate-500'
</script>

<template>
  <form
    method="post"
    class="space-y-5 rounded-2xl bg-white p-4 shadow sm:p-6"
    data-testid="chapter-form"
    @submit.prevent="onSubmit"
  >
    <div>
      <label for="chapter-subject" :class="LABEL">Subjek <span class="text-red-500">*</span></label>
      <select
        id="chapter-subject"
        v-model="form.subjectId"
        name="subject_id"
        required
        :class="[FORM_SELECT_CLASS, 'min-h-11']"
        data-testid="chapter-subject"
      >
        <option value="">-- Pilih Subjek --</option>
        <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
      </select>
    </div>

    <div>
      <label for="chapter-level" :class="LABEL"
        >Tahap Pendidikan <span class="text-red-500">*</span></label
      >
      <select
        id="chapter-level"
        v-model="form.educationLevelId"
        name="education_level_id"
        required
        :class="[FORM_SELECT_CLASS, 'min-h-11']"
        data-testid="chapter-level"
      >
        <option value="">-- Pilih Tahap --</option>
        <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
      </select>
    </div>

    <div>
      <label for="chapter-name" :class="LABEL"
        >Nama Bab (Bahasa Melayu) <span class="text-red-500">*</span></label
      >
      <input
        id="chapter-name"
        v-model="form.name"
        type="text"
        name="name"
        required
        placeholder="cth: Nombor Bulat"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="chapter-name"
      />
    </div>

    <div>
      <label for="chapter-name-en" :class="LABEL">Nama Bab (English)</label>
      <input
        id="chapter-name-en"
        v-model="form.nameEn"
        type="text"
        name="name_en"
        placeholder="e.g: Whole Numbers"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="chapter-name-en"
      />
    </div>

    <div>
      <label for="chapter-number" :class="LABEL">Nombor Bab</label>
      <input
        id="chapter-number"
        v-model="form.chapterNumber"
        type="number"
        name="chapter_number"
        min="1"
        placeholder="cth: 1"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="chapter-number"
      />
      <p :class="HINT"><Info class="h-3.5 w-3.5 shrink-0" />Contoh: 1, 2, 3 (opsional)</p>
    </div>

    <div>
      <label for="chapter-description" :class="LABEL">Penerangan</label>
      <textarea
        id="chapter-description"
        v-model="form.description"
        name="description"
        rows="4"
        placeholder="Penerangan ringkas tentang bab ini..."
        :class="FORM_TEXTAREA_CLASS"
        data-testid="chapter-description"
      ></textarea>
    </div>

    <div v-if="mode === 'edit'">
      <label
        class="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700"
      >
        <input
          v-model="form.isActive"
          type="checkbox"
          name="is_active"
          value="1"
          class="h-4 w-4 rounded border-slate-300 text-indigo-600"
          data-testid="chapter-active"
        />
        Aktif
      </label>
      <p :class="HINT">Nyahtanda jika bab ini tidak mahu dipaparkan buat masa ini</p>
    </div>

    <div class="flex justify-end space-x-3 border-t border-slate-100 pt-4">
      <RouterLink
        :to="cancelTo"
        class="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:px-6"
        data-testid="chapter-cancel"
      >
        Batal
      </RouterLink>
      <button
        type="submit"
        :disabled="saving"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60 sm:px-6"
        data-testid="chapter-submit"
      >
        <Save class="h-4 w-4" />
        {{ mode === 'edit' ? 'Kemaskini Bab' : 'Simpan Bab' }}
      </button>
    </div>
  </form>
</template>
