<script setup lang="ts">
/**
 * S5 `/guru/kelas/cipta` (FR-M10-31..34; URS FT-M10-3.2): school search, "Maklumat Kelas" and the
 * level tiles filtered by the school type. Native validation only (name, subject); the level
 * radios carry no `required` (DV-M10-22). 201 → `/guru/kelas`; 422 → the shared red box.
 */
import { ArrowLeft, CirclePlus, Laptop } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { ApiError } from '@/api'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'
import { useApi, useFlash } from '@/composables'
import type { SchoolSummary } from '@/modules/m02-users-schools'

import { createGuruClass } from '../api/guru'
import type { EducationLevelSlug } from '../api/types'
import { KELAS_COPY, tilesForSchoolType } from '../components/kelas/copy'
import SchoolPicker from '../components/kelas/SchoolPicker.vue'
import { fetchSubjectOptions } from '../components/kelas/subjects'

const router = useRouter()
const flash = useFlash()
const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))

const school = ref<SchoolSummary | null>(null)
const name = ref('')
const subjectId = ref('')
const level = ref<EducationLevelSlug | ''>('')
const description = ref('')
const submitting = ref(false)
const fields = ref<Record<string, string>>({})
const failure = ref<string[]>([])

const tiles = computed(() => tilesForSchoolType(school.value?.type ?? null))

// A level hidden by the chosen school's type is no longer chosen.
watch(tiles, (next) => {
  if (level.value !== '' && !next.some((t) => t.slug === level.value)) level.value = ''
})

const errorLines = computed(() =>
  failure.value.length > 0 ? failure.value : Object.values(fields.value),
)

async function submit(): Promise<void> {
  if (submitting.value) return
  submitting.value = true
  fields.value = {}
  failure.value = []
  try {
    await createGuruClass({
      ...(school.value ? { schoolId: school.value.id } : {}),
      name: name.value.trim(),
      subjectId: Number(subjectId.value),
      educationLevel: level.value as EducationLevelSlug,
      description: description.value.trim() === '' ? null : description.value.trim(),
    })
    flash.success(KELAS_COPY.created)
    await router.push('/guru/kelas')
  } catch (err) {
    if (err instanceof ApiError && err.fields) fields.value = err.fields
    else failure.value = [err instanceof Error ? err.message : KELAS_COPY.createFailed]
  } finally {
    submitting.value = false
  }
}

const fieldClass = (base: string, key: string): string =>
  fields.value[key] ? `${base} ${FORM_ERROR_MODIFIER}` : base
</script>

<template>
  <div class="mx-auto max-w-4xl min-w-0 space-y-5" data-testid="kelas-create-page">
    <RouterLink
      to="/guru/kelas"
      class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 hover:text-indigo-600"
      data-testid="kelas-back"
    >
      <ArrowLeft class="h-4 w-4" />{{ KELAS_COPY.back }}
    </RouterLink>

    <form class="space-y-5" data-testid="kelas-form" @submit.prevent="submit">
      <AlertBox :messages="errorLines" />

      <SchoolPicker @select="school = $event" />

      <section class="min-w-0 rounded-2xl bg-white p-4 shadow-sm sm:p-6">
        <h2 class="mb-4 flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
          <Laptop class="h-5 w-5 text-indigo-500" />{{ KELAS_COPY.info }}
        </h2>

        <div class="space-y-4">
          <div>
            <label for="kelas-name" class="mb-1 block text-sm font-semibold text-slate-700"
              >{{ KELAS_COPY.name }} *</label
            >
            <input
              id="kelas-name"
              v-model="name"
              type="text"
              required
              maxlength="255"
              :placeholder="KELAS_COPY.namePlaceholder"
              :class="fieldClass(FORM_INPUT_CLASS, 'name')"
              data-testid="kelas-name"
            />
            <p class="mt-1 text-xs text-slate-500">{{ KELAS_COPY.nameHelp }}</p>
            <p v-if="fields.name" :class="FORM_ERROR_TEXT_CLASS">{{ fields.name }}</p>
          </div>

          <div>
            <label for="kelas-subject" class="mb-1 block text-sm font-semibold text-slate-700"
              >{{ KELAS_COPY.subject }} *</label
            >
            <select
              id="kelas-subject"
              v-model="subjectId"
              required
              :class="fieldClass(FORM_SELECT_CLASS, 'subjectId')"
              data-testid="kelas-subject"
            >
              <option value="">{{ KELAS_COPY.subjectPlaceholder }}</option>
              <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
                {{ s.name }}
              </option>
            </select>
            <p v-if="fields.subjectId" :class="FORM_ERROR_TEXT_CLASS">{{ fields.subjectId }}</p>
          </div>

          <fieldset class="min-w-0">
            <legend class="mb-1 block text-sm font-semibold text-slate-700">
              {{ KELAS_COPY.level }} *
            </legend>
            <div class="grid grid-cols-2 gap-2 sm:grid-cols-3" data-testid="kelas-levels">
              <label
                v-for="tile in tiles"
                :key="tile.slug"
                class="relative block cursor-pointer"
                data-testid="kelas-level"
              >
                <input
                  v-model="level"
                  type="radio"
                  name="education_level"
                  :value="tile.slug"
                  class="peer hidden"
                />
                <span
                  class="flex min-h-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-3 text-sm text-slate-700 transition peer-checked:border-indigo-500 peer-checked:bg-indigo-50 peer-checked:font-semibold peer-checked:text-indigo-700"
                  >{{ tile.label }}</span
                >
              </label>
            </div>
            <p v-if="fields.educationLevel" :class="FORM_ERROR_TEXT_CLASS">
              {{ fields.educationLevel }}
            </p>
          </fieldset>

          <div>
            <label
              for="kelas-description"
              class="mb-1 block text-sm font-semibold text-slate-700"
              >{{ KELAS_COPY.description }}</label
            >
            <textarea
              id="kelas-description"
              v-model="description"
              rows="3"
              maxlength="2000"
              :placeholder="KELAS_COPY.descriptionPlaceholder"
              :class="FORM_TEXTAREA_CLASS"
              data-testid="kelas-description"
            />
          </div>
        </div>
      </section>

      <button
        type="submit"
        :disabled="submitting"
        class="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-indigo-500 to-purple-500 px-5 py-3 font-semibold text-white shadow hover:opacity-90 disabled:opacity-60"
        data-testid="kelas-submit"
      >
        <LoadingSpinner v-if="submitting" />
        <CirclePlus v-else class="h-5 w-5" />
        {{ submitting ? KELAS_COPY.submitting : KELAS_COPY.submit }}
      </button>
    </form>
  </div>
</template>
