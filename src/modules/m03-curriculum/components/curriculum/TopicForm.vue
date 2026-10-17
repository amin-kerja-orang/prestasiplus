<script setup lang="ts">
/**
 * Topic form card shared by S4 (create) and S5 (edit) (FR-M03-33, 37): "Nama Topik (Bahasa Melayu) *",
 * "Nama Topik (English)", "Nombor Topik", "Penerangan", "Standard Pembelajaran"; S5 adds "Aktif". The
 * chapter is fixed (S4 sends it from the page, S5 has no chapter field). Native HTML5 validation only.
 */
import { reactive, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { orNull } from '../../lib/curriculum-paths'

export interface TopicFormValues {
  name: string
  nameEn: string
  topicNumber: string
  description: string
  learningStandard: string
  isActive: boolean
}

export interface TopicFormPayload {
  name: string
  nameEn: string | null
  topicNumber: string | null
  description: string | null
  learningStandard: string | null
  isActive: boolean
}

const props = defineProps<{
  mode: 'create' | 'edit'
  initial: TopicFormValues
  cancelTo: RouteLocationRaw
  saving?: boolean
}>()

const emit = defineEmits<{ submit: [payload: TopicFormPayload] }>()

const form = reactive<TopicFormValues>({ ...props.initial })
watch(
  () => props.initial,
  (next) => Object.assign(form, next),
)

function onSubmit(): void {
  emit('submit', {
    name: form.name,
    nameEn: orNull(form.nameEn),
    topicNumber: orNull(form.topicNumber),
    description: orNull(form.description),
    learningStandard: orNull(form.learningStandard),
    isActive: form.isActive,
  })
}

</script>

<template>
  <form method="post" data-testid="topic-form" @submit.prevent="onSubmit">
    <UCard>
      <div class="flex min-w-0 flex-col gap-4">
        <div class="min-w-0">
          <label for="topic-name" class="mb-2 block text-label text-highlighted"
            >Nama Topik (Bahasa Melayu) *</label
          >
          <UInput
            id="topic-name"
            v-model="form.name"
            type="text"
            name="name"
            required
            placeholder="cth: Nombor hingga 1000"
            class="w-full"
            data-testid="topic-name"
          />
        </div>

        <div class="min-w-0">
          <label for="topic-name-en" class="mb-2 block text-label text-highlighted"
            >Nama Topik (English)</label
          >
          <UInput
            id="topic-name-en"
            v-model="form.nameEn"
            type="text"
            name="name_en"
            placeholder="e.g: Numbers up to 1000"
            class="w-full"
            data-testid="topic-name-en"
          />
        </div>

        <div class="min-w-0">
          <label for="topic-number" class="mb-2 block text-label text-highlighted"
            >Nombor Topik</label
          >
          <UInput
            id="topic-number"
            v-model="form.topicNumber"
            type="text"
            name="topic_number"
            placeholder="cth: 1.1"
            class="w-full"
            data-testid="topic-number"
          />
          <p class="mt-1 flex items-center gap-2 text-caption text-muted">
            <UIcon name="i-ph-info" class="size-4 shrink-0" />Contoh: 1.1, 1.2, 2.1 (opsional)
          </p>
        </div>

        <div class="min-w-0">
          <label for="topic-description" class="mb-2 block text-label text-highlighted"
            >Penerangan</label
          >
          <UTextarea
            id="topic-description"
            v-model="form.description"
            name="description"
            :rows="4"
            placeholder="Penerangan ringkas tentang topik ini..."
            class="w-full"
            data-testid="topic-description"
          />
        </div>

        <div class="min-w-0">
          <label for="topic-standard" class="mb-2 block text-label text-highlighted"
            >Standard Pembelajaran</label
          >
          <UTextarea
            id="topic-standard"
            v-model="form.learningStandard"
            name="learning_standard"
            :rows="4"
            placeholder="Standard pembelajaran mengikut kurikulum KSSM/KSSR..."
            class="w-full"
            data-testid="topic-standard"
          />
          <p class="mt-1 flex items-center gap-2 text-caption text-muted">
            <UIcon name="i-ph-info" class="size-4 shrink-0" />Rujuk dokumen standard kurikulum KPM
          </p>
        </div>

        <div v-if="mode === 'edit'" class="min-w-0">
          <UCheckbox
            v-model="form.isActive"
            name="is_active"
            value="1"
            label="Aktif"
            data-testid="topic-active"
          />
          <p class="mt-1 text-caption text-muted">
            Nyahtanda jika topik ini tidak mahu dipaparkan buat masa ini
          </p>
        </div>

        <div class="flex justify-end gap-3">
          <UButton
            :to="cancelTo"
            color="neutral"
            variant="ghost"
            class="min-h-11"
            data-testid="topic-cancel"
          >
            Batal
          </UButton>
          <UButton
            type="submit"
            :loading="saving"
            :disabled="saving"
            :icon="saving ? undefined : 'i-ph-floppy-disk'"
            class="min-h-11"
            data-testid="topic-submit"
          >
            {{ mode === 'edit' ? 'Kemaskini Topik' : 'Simpan Topik' }}
          </UButton>
        </div>
      </div>
    </UCard>
  </form>
</template>
