<script setup lang="ts">
/**
 * Chapter form card shared by S2 (create) and S3 (edit) (FR-M03-26, 29): "Subjek *", "Tahap Pendidikan *",
 * "Nama Bab (Bahasa Melayu) *", "Nama Bab (English)", "Nombor Bab", "Penerangan"; S3 adds "Aktif". Native
 * HTML5 validation only. The parent owns the request; this component keeps the typed values and
 * emits `submit`. The sticky `DsFormBar` holds "Batal" and the submit button.
 */
import { reactive, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { DsFormBar, DsFormField, DsFormSection, DsNativeSelect, DsStack, DsText } from '@/ds'

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
</script>

<template>
  <form
    method="post"
    class="flex min-w-0 flex-col gap-4 md:gap-6"
    data-testid="chapter-form"
    @submit.prevent="onSubmit"
  >
    <DsFormSection title="Maklumat Bab" icon="book-bookmark">
      <DsFormField v-slot="{ id }" native for="chapter-subject" label="Subjek" required>
        <DsNativeSelect
          :id="id"
          v-model="form.subjectId"
          name="subject_id"
          required
          data-testid="chapter-subject"
        >
          <option value="">-- Pilih Subjek --</option>
          <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
        </DsNativeSelect>
      </DsFormField>

      <DsFormField v-slot="{ id }" native for="chapter-level" label="Tahap Pendidikan" required>
        <DsNativeSelect
          :id="id"
          v-model="form.educationLevelId"
          name="education_level_id"
          required
          data-testid="chapter-level"
        >
          <option value="">-- Pilih Tahap --</option>
          <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
        </DsNativeSelect>
      </DsFormField>

      <DsFormField
        v-slot="{ id }"
        native
        for="chapter-name"
        label="Nama Bab (Bahasa Melayu)"
        required
      >
        <UInput
          :id="id"
          v-model="form.name"
          type="text"
          name="name"
          required
          placeholder="cth: Nombor Bulat"
          class="w-full"
          data-testid="chapter-name"
        />
      </DsFormField>

      <DsFormField v-slot="{ id }" native for="chapter-name-en" label="Nama Bab (English)">
        <UInput
          :id="id"
          v-model="form.nameEn"
          type="text"
          name="name_en"
          placeholder="e.g: Whole Numbers"
          class="w-full"
          data-testid="chapter-name-en"
        />
      </DsFormField>

      <DsFormField
        v-slot="{ id }"
        native
        for="chapter-number"
        label="Nombor Bab"
        hint="Contoh: 1, 2, 3 (opsional)"
      >
        <UInput
          :id="id"
          v-model="form.chapterNumber"
          type="number"
          name="chapter_number"
          min="1"
          placeholder="cth: 1"
          class="w-full"
          data-testid="chapter-number"
        />
      </DsFormField>

      <DsFormField v-slot="{ id }" native for="chapter-description" label="Penerangan">
        <UTextarea
          :id="id"
          v-model="form.description"
          name="description"
          :rows="4"
          placeholder="Penerangan ringkas tentang bab ini..."
          class="w-full"
          data-testid="chapter-description"
        />
      </DsFormField>

      <DsStack v-if="mode === 'edit'" gap="xs">
        <UCheckbox
          v-model="form.isActive"
          name="is_active"
          value="1"
          label="Aktif"
          data-testid="chapter-active"
        />
        <DsText variant="caption">
          Nyahtanda jika bab ini tidak mahu dipaparkan buat masa ini
        </DsText>
      </DsStack>
    </DsFormSection>

    <DsFormBar
      :cancel-to="cancelTo"
      :saving="saving"
      :submit-label="mode === 'edit' ? 'Kemaskini Bab' : 'Simpan Bab'"
    />
  </form>
</template>
