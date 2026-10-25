<script setup lang="ts">
/**
 * S5 `/guru/kelas/cipta` (FR-M10-31..34; URS FT-M10-3.2): school search, "Maklumat Kelas" and the
 * level tiles filtered by the school type. Native validation only (name, subject); the level
 * radios carry no `required` (DV-M10-22). 201 → `/guru/kelas`; 422 → the shared red box.
 *
 * DV-M10-40 (http mode only): the picker opens with the teacher's own school selected, so a class
 * left without a school choice is still visible to that school's admin. The teacher can clear it.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError, isHttpMode } from '@/api'
import { useApi, useFlash } from '@/composables'
import { DsBackLink, DsFormField, DsNativeSelect, DsPage, DsPanel } from '@/ds'
import { searchSchools, type SchoolSummary } from '@/modules/m02-users-schools'
import { useSessionStore } from '@/stores/session'

import { createGuruClass } from '../api/guru'
import type { EducationLevelSlug } from '../api/types'
import { KELAS_COPY, tilesForSchoolType } from '../components/kelas/copy'
import SchoolPicker from '../components/kelas/SchoolPicker.vue'
import { fetchSubjectOptions } from '../components/kelas/subjects'
import { KELAS_COPY as KELAS_SAYA_COPY } from '../components/kelas-saya/copy'
import { moduleMessage } from '../lib/generic-server-text'

const router = useRouter()
const flash = useFlash()
const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))

const session = useSessionStore()

const school = ref<SchoolSummary | null>(null)
/** The teacher's own school, offered to the picker (DV-M10-40); `null` when none or in mock mode. */
const ownSchool = ref<SchoolSummary | null>(null)
/** True while that lookup runs: the form is not submitted meanwhile, so it cannot go out without the school. */
const schoolLookup = ref(false)
const name = ref('')
const subjectId = ref('')
const level = ref<EducationLevelSlug | ''>('')
const description = ref('')
const submitting = ref(false)
const INLINE_FIELDS = ['name', 'subjectId', 'educationLevel']
const fields = ref<Record<string, string>>({})
const failure = ref<string[]>([])

const tiles = computed(() => tilesForSchoolType(school.value?.type ?? null))

onMounted(async () => {
  const schoolId = session.user?.schoolId
  if (!isHttpMode() || schoolId === null || schoolId === undefined) return
  schoolLookup.value = true
  try {
    // `GET /api/schools/search?id=`: that one active school, `[]` for an inactive or unknown one.
    ownSchool.value = (await searchSchools({ id: schoolId }))[0] ?? null
  } catch {
    // The picker simply stays empty; the teacher can still search.
  } finally {
    schoolLookup.value = false
  }
})

// A level hidden by the chosen school's type is no longer chosen.
watch(tiles, (next) => {
  if (level.value !== '' && !next.some((t) => t.slug === level.value)) level.value = ''
})

/** A module BM message of a refused request, the network copy for status 0, else the generic BM line (SWE). */
function createFailureText(err: unknown): string {
  if (err instanceof ApiError && err.status === 0) return KELAS_SAYA_COPY.network
  return moduleMessage(err) ?? KELAS_COPY.createFailed
}

async function submit(): Promise<void> {
  if (submitting.value || schoolLookup.value) return
  submitting.value = true
  fields.value = {}
  failure.value = []
  try {
    await createGuruClass({
      ...(school.value ? { schoolId: school.value.id } : {}),
      name: name.value.trim(),
      // The option value as chosen: an opaque id string on the real API (D-01).
      subjectId: subjectId.value,
      educationLevel: level.value as EducationLevelSlug,
      description: description.value.trim() === '' ? null : description.value.trim(),
    })
    flash.success(KELAS_COPY.created)
    await router.push('/guru/kelas')
  } catch (err) {
    if (err instanceof ApiError && err.fields) {
      fields.value = err.fields
      // Fields without an inline slot (schoolId, description) go to the box, so no message is lost.
      failure.value = Object.entries(err.fields)
        .filter(([key]) => !INLINE_FIELDS.includes(key))
        .map(([, message]) => message)
    } else failure.value = [createFailureText(err)]
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <DsPage class="max-w-4xl" data-testid="kelas-create-page">
    <DsBackLink to="/guru/kelas" :label="KELAS_COPY.back" data-testid="kelas-back" />

    <form class="flex flex-col gap-4" data-testid="kelas-form" @submit.prevent="submit">
      <UAlert
        v-if="failure.length"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        :title="failure.join(' ')"
        role="alert"
      />

      <SchoolPicker :preselect="ownSchool" @select="school = $event" />

      <DsPanel>
        <h2 class="mb-4 flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-laptop-duotone" class="size-5 text-primary-t" />{{ KELAS_COPY.info }}
        </h2>

        <div class="flex flex-col gap-4">
          <DsFormField
            :label="`${KELAS_COPY.name} *`"
            name="kelas-name"
            :help="KELAS_COPY.nameHelp"
            :error="fields.name"
          >
            <UInput
              id="kelas-name"
              v-model="name"
              type="text"
              required
              maxlength="255"
              :placeholder="KELAS_COPY.namePlaceholder"
              class="w-full"
              data-testid="kelas-name"
            />
          </DsFormField>

          <DsFormField
            :label="`${KELAS_COPY.subject} *`"
            name="kelas-subject"
            :error="fields.subjectId"
          >
            <DsNativeSelect
              id="kelas-subject"
              v-model="subjectId"
              required
              data-testid="kelas-subject"
            >
              <option value="">{{ KELAS_COPY.subjectPlaceholder }}</option>
              <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
                {{ s.name }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <URadioGroup
            :model-value="level || undefined"
            :legend="`${KELAS_COPY.level} *`"
            :items="tiles.map((t) => ({ label: t.label, value: t.slug }))"
            variant="card"
            orientation="horizontal"
            name="education_level"
            class="min-w-0"
            data-testid="kelas-levels"
            @update:model-value="level = $event as EducationLevelSlug"
          />
          <p v-if="fields.educationLevel" class="text-caption text-error">
            {{ fields.educationLevel }}
          </p>

          <DsFormField :label="KELAS_COPY.description" name="kelas-description">
            <UTextarea
              id="kelas-description"
              v-model="description"
              :rows="3"
              maxlength="2000"
              :placeholder="KELAS_COPY.descriptionPlaceholder"
              class="w-full"
              data-testid="kelas-description"
            />
          </DsFormField>
        </div>
      </DsPanel>

      <UButton
        type="submit"
        size="xl"
        block
        :loading="submitting"
        :disabled="submitting || schoolLookup"
        :icon="submitting ? undefined : 'i-ph-plus-circle-duotone'"
        data-testid="kelas-submit"
      >
        {{ submitting ? KELAS_COPY.submitting : KELAS_COPY.submit }}
      </UButton>
    </form>
  </DsPage>
</template>
