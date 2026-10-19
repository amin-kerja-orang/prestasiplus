<script setup lang="ts">
/**
 * Topic form card shared by S4 (create) and S5 (edit) (FR-M03-33, 37): "Nama Topik (Bahasa Melayu) *",
 * "Nama Topik (English)", "Nombor Topik", "Penerangan", "Standard Pembelajaran"; S5 adds "Aktif". The
 * chapter is fixed (S4 sends it from the page, S5 has no chapter field). Native HTML5 validation only.
 */
import { reactive, watch } from 'vue'
import type { RouteLocationRaw } from 'vue-router'

import { DsFormBar, DsFormField, DsFormSection, DsStack, DsText } from '@/ds'

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
  <form
    method="post"
    class="flex min-w-0 flex-col gap-4 md:gap-6"
    data-testid="topic-form"
    @submit.prevent="onSubmit"
  >
    <DsFormSection title="Maklumat Topik" icon="i-ph-bookmark-simple">
      <DsFormField
        v-slot="{ id }"
        native
        for="topic-name"
        label="Nama Topik (Bahasa Melayu)"
        required
      >
        <UInput
          :id="id"
          v-model="form.name"
          type="text"
          name="name"
          required
          placeholder="cth: Nombor hingga 1000"
          class="w-full"
          data-testid="topic-name"
        />
      </DsFormField>

      <DsFormField v-slot="{ id }" native for="topic-name-en" label="Nama Topik (English)">
        <UInput
          :id="id"
          v-model="form.nameEn"
          type="text"
          name="name_en"
          placeholder="e.g: Numbers up to 1000"
          class="w-full"
          data-testid="topic-name-en"
        />
      </DsFormField>

      <DsFormField
        v-slot="{ id }"
        native
        for="topic-number"
        label="Nombor Topik"
        hint="Contoh: 1.1, 1.2, 2.1 (opsional)"
      >
        <UInput
          :id="id"
          v-model="form.topicNumber"
          type="text"
          name="topic_number"
          placeholder="cth: 1.1"
          class="w-full"
          data-testid="topic-number"
        />
      </DsFormField>

      <DsFormField v-slot="{ id }" native for="topic-description" label="Penerangan">
        <UTextarea
          :id="id"
          v-model="form.description"
          name="description"
          :rows="4"
          placeholder="Penerangan ringkas tentang topik ini..."
          class="w-full"
          data-testid="topic-description"
        />
      </DsFormField>

      <DsFormField
        v-slot="{ id }"
        native
        for="topic-standard"
        label="Standard Pembelajaran"
        hint="Rujuk dokumen standard kurikulum KPM"
      >
        <UTextarea
          :id="id"
          v-model="form.learningStandard"
          name="learning_standard"
          :rows="4"
          placeholder="Standard pembelajaran mengikut kurikulum KSSM/KSSR..."
          class="w-full"
          data-testid="topic-standard"
        />
      </DsFormField>

      <DsStack v-if="mode === 'edit'" gap="xs">
        <UCheckbox
          v-model="form.isActive"
          name="is_active"
          value="1"
          label="Aktif"
          data-testid="topic-active"
        />
        <DsText variant="caption">
          Nyahtanda jika topik ini tidak mahu dipaparkan buat masa ini
        </DsText>
      </DsStack>
    </DsFormSection>

    <DsFormBar
      :cancel-to="cancelTo"
      :saving="saving"
      :submit-label="mode === 'edit' ? 'Kemaskini Topik' : 'Simpan Topik'"
    />
  </form>
</template>
