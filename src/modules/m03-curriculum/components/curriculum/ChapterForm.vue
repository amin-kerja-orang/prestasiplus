<script setup lang="ts">
/**
 * Chapter form card shared by S2 (create) and S3 (edit) (FR-M03-26, 29): "Subjek *", "Tahap Pendidikan *",
 * "Nama Bab (Bahasa Melayu) *", "Nama Bab (English)", "Nombor Bab", "Penerangan"; S3 adds "Aktif". Native
 * HTML5 validation only. The parent owns the request; this component keeps the typed values and
 * emits `submit`. "Batal" and the submit button stay on one row, right-aligned, at every width.
 */
import { reactive, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import type { LevelOption, SubjectOption } from '../../api/admin-curriculum'
import { orNull } from '../../lib/curriculum-paths'
import NativeSelect from '../native/NativeSelect.vue'

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
  <form method="post" data-testid="chapter-form" @submit.prevent="onSubmit">
    <UCard>
      <div class="flex min-w-0 flex-col gap-4">
        <div class="min-w-0">
          <label for="chapter-subject" class="mb-2 block text-label text-highlighted">Subjek *</label>
          <NativeSelect
            id="chapter-subject"
            v-model="form.subjectId"
            name="subject_id"
            required
            data-testid="chapter-subject"
          >
            <option value="">-- Pilih Subjek --</option>
            <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </NativeSelect>
        </div>

        <div class="min-w-0">
          <label for="chapter-level" class="mb-2 block text-label text-highlighted"
            >Tahap Pendidikan *</label
          >
          <NativeSelect
            id="chapter-level"
            v-model="form.educationLevelId"
            name="education_level_id"
            required
            data-testid="chapter-level"
          >
            <option value="">-- Pilih Tahap --</option>
            <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
          </NativeSelect>
        </div>

        <div class="min-w-0">
          <label for="chapter-name" class="mb-2 block text-label text-highlighted"
            >Nama Bab (Bahasa Melayu) *</label
          >
          <UInput
            id="chapter-name"
            v-model="form.name"
            type="text"
            name="name"
            required
            placeholder="cth: Nombor Bulat"
            class="w-full"
            data-testid="chapter-name"
          />
        </div>

        <div class="min-w-0">
          <label for="chapter-name-en" class="mb-2 block text-label text-highlighted"
            >Nama Bab (English)</label
          >
          <UInput
            id="chapter-name-en"
            v-model="form.nameEn"
            type="text"
            name="name_en"
            placeholder="e.g: Whole Numbers"
            class="w-full"
            data-testid="chapter-name-en"
          />
        </div>

        <div class="min-w-0">
          <label for="chapter-number" class="mb-2 block text-label text-highlighted"
            >Nombor Bab</label
          >
          <UInput
            id="chapter-number"
            v-model="form.chapterNumber"
            type="number"
            name="chapter_number"
            min="1"
            placeholder="cth: 1"
            class="w-full"
            data-testid="chapter-number"
          />
          <p class="mt-1 flex items-center gap-2 text-caption text-muted">
            <UIcon name="i-ph-info" class="size-4 shrink-0" />Contoh: 1, 2, 3 (opsional)
          </p>
        </div>

        <div class="min-w-0">
          <label for="chapter-description" class="mb-2 block text-label text-highlighted"
            >Penerangan</label
          >
          <UTextarea
            id="chapter-description"
            v-model="form.description"
            name="description"
            :rows="4"
            placeholder="Penerangan ringkas tentang bab ini..."
            class="w-full"
            data-testid="chapter-description"
          />
        </div>

        <div v-if="mode === 'edit'" class="min-w-0">
          <UCheckbox
            v-model="form.isActive"
            name="is_active"
            value="1"
            label="Aktif"
            data-testid="chapter-active"
          />
          <p class="mt-1 text-caption text-muted">
            Nyahtanda jika bab ini tidak mahu dipaparkan buat masa ini
          </p>
        </div>

        <div class="flex justify-end gap-3">
          <UButton
            :to="cancelTo"
            color="neutral"
            variant="ghost"
            class="min-h-11"
            data-testid="chapter-cancel"
          >
            Batal
          </UButton>
          <UButton
            type="submit"
            :loading="saving"
            :disabled="saving"
            :icon="saving ? undefined : 'i-ph-floppy-disk'"
            class="min-h-11"
            data-testid="chapter-submit"
          >
            {{ mode === 'edit' ? 'Kemaskini Bab' : 'Simpan Bab' }}
          </UButton>
        </div>
      </div>
    </UCard>
  </form>
</template>
