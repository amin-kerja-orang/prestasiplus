<script setup lang="ts">
/**
 * Topic form card shared by S4 (create) and S5 (edit) (FR-M03-33, 37): "Nama Topik (Bahasa Melayu) *",
 * "Nama Topik (English)", "Nombor Topik", "Penerangan", "Standard Pembelajaran"; S5 adds "Aktif". The
 * chapter is fixed (S4 sends it from the page, S5 has no chapter field). Native HTML5 validation only.
 */
import { Info, Save } from '@lucide/vue'
import { reactive, watch } from 'vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from '@/components/form'

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

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
const HINT = 'mt-1.5 flex items-center gap-1.5 text-xs text-slate-500'
</script>

<template>
  <form
    method="post"
    class="space-y-5 rounded-2xl bg-white p-4 shadow sm:p-6"
    data-testid="topic-form"
    @submit.prevent="onSubmit"
  >
    <div>
      <label for="topic-name" :class="LABEL"
        >Nama Topik (Bahasa Melayu) <span class="text-red-500">*</span></label
      >
      <input
        id="topic-name"
        v-model="form.name"
        type="text"
        name="name"
        required
        placeholder="cth: Nombor hingga 1000"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="topic-name"
      />
    </div>

    <div>
      <label for="topic-name-en" :class="LABEL">Nama Topik (English)</label>
      <input
        id="topic-name-en"
        v-model="form.nameEn"
        type="text"
        name="name_en"
        placeholder="e.g: Numbers up to 1000"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="topic-name-en"
      />
    </div>

    <div>
      <label for="topic-number" :class="LABEL">Nombor Topik</label>
      <input
        id="topic-number"
        v-model="form.topicNumber"
        type="text"
        name="topic_number"
        placeholder="cth: 1.1"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="topic-number"
      />
      <p :class="HINT"><Info class="h-3.5 w-3.5 shrink-0" />Contoh: 1.1, 1.2, 2.1 (opsional)</p>
    </div>

    <div>
      <label for="topic-description" :class="LABEL">Penerangan</label>
      <textarea
        id="topic-description"
        v-model="form.description"
        name="description"
        rows="4"
        placeholder="Penerangan ringkas tentang topik ini..."
        :class="FORM_TEXTAREA_CLASS"
        data-testid="topic-description"
      ></textarea>
    </div>

    <div>
      <label for="topic-standard" :class="LABEL">Standard Pembelajaran</label>
      <textarea
        id="topic-standard"
        v-model="form.learningStandard"
        name="learning_standard"
        rows="4"
        placeholder="Standard pembelajaran mengikut kurikulum KSSM/KSSR..."
        :class="FORM_TEXTAREA_CLASS"
        data-testid="topic-standard"
      ></textarea>
      <p :class="HINT"><Info class="h-3.5 w-3.5 shrink-0" />Rujuk dokumen standard kurikulum KPM</p>
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
          data-testid="topic-active"
        />
        Aktif
      </label>
      <p :class="HINT">Nyahtanda jika topik ini tidak mahu dipaparkan buat masa ini</p>
    </div>

    <div class="flex justify-end space-x-3 border-t border-slate-100 pt-4">
      <RouterLink
        :to="cancelTo"
        class="inline-flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:px-6"
        data-testid="topic-cancel"
      >
        Batal
      </RouterLink>
      <button
        type="submit"
        :disabled="saving"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-600 px-4 py-2 text-sm font-bold text-white shadow transition hover:from-indigo-600 hover:to-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-wait disabled:opacity-60 sm:px-6"
        data-testid="topic-submit"
      >
        <Save class="h-4 w-4" />
        {{ mode === 'edit' ? 'Kemaskini Topik' : 'Simpan Topik' }}
      </button>
    </div>
  </form>
</template>
