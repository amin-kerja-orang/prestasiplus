<script setup lang="ts">
/**
 * S12 `/admin-sekolah/pelajar/baru` "Tambah Pelajar" (SRS M27 Part B FR-M27-117, 118, 120; BR-M27-41). One card,
 * max width 2xl: "Nama penuh *", the locked school label, the select "Kelas" ("Tiada kelas" then the school's
 * active classroom classes), "Emel *", "Kata laluan" (placeholder and hint from `GET .../pelajar/form-options`;
 * never the literal default) and the buttons "Cipta Pelajar" / "Batal".
 *
 * Success: the form is emptied, the flash (the API `status`) shows and the one-time credential block above the form
 * holds the `credential` of the response. That block lives in component memory only (the one place a password is
 * rendered, BR-M27-41): leaving the page or reloading shows nothing. Errors show above the form and keep the values
 * (the password is cleared). The role, school and `isActive` are never sent. No native validation.
 */
import { ArrowLeft, GraduationCap, KeyRound, Mail, User, UserPlus } from '@lucide/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { FORM_INPUT_CLASS, FORM_SELECT_CLASS } from '@/components/form'
import { useApi, useFlash } from '@/composables'

import {
  createSchoolPupil,
  fetchSchoolPupilFormOptions,
  type CreatePupilResult,
} from '../api/school-admin'
import LockedSchoolLabel from '../components/users/LockedSchoolLabel.vue'
import PupilCredentialBlock from '../components/users/PupilCredentialBlock.vue'
import {
  BUTTON_CANCEL,
  BUTTON_PRIMARY,
  errorLines,
  LABEL,
  PUPIL_LIST_PATH,
} from '../components/users/users-format'

const flash = useFlash()

const { data: options, error: loadError } = useApi((signal) =>
  fetchSchoolPupilFormOptions({ signal }),
)
const refused = computed(() => isApiError(loadError.value) && loadError.value.status === 403)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

const form = reactive({ name: '', classId: '', email: '', password: '' })
const saving = ref(false)
const errors = ref<string[]>([])
const credential = ref<CreatePupilResult['credential'] | null>(null)
const alertBox = ref<HTMLElement | null>(null)

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = []
  try {
    const result = await createSchoolPupil({
      name: form.name,
      email: form.email,
      ...(form.password !== '' ? { password: form.password } : {}),
      ...(form.classId !== '' ? { classId: Number(form.classId) } : {}),
    })
    credential.value = result.credential
    flash.show({ type: 'success', message: result.status })
    form.name = ''
    form.classId = ''
    form.email = ''
    form.password = ''
  } catch (err) {
    errors.value = errorLines(err)
    form.password = ''
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto min-w-0 max-w-2xl space-y-4" data-testid="sp-create-page">
    <PupilCredentialBlock v-if="credential" :credential="credential" />

    <AlertBox
      v-if="loadError && !refused"
      :messages="errorLines(loadError)"
      data-testid="user-load-error"
    />

    <div
      v-else-if="!options"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="user-form-skeleton"
    >
      <div v-for="n in 4" :key="n" class="h-11 animate-pulse rounded-xl bg-slate-100"></div>
    </div>

    <form
      v-else
      method="post"
      novalidate
      class="rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="user-form"
      @submit.prevent="submit"
    >
      <div ref="alertBox" class="scroll-mt-4">
        <AlertBox :messages="errors" class="mb-5" data-testid="user-form-alert" />
      </div>

      <div class="space-y-5">
        <div>
          <label for="pupil-name" :class="LABEL">
            <User class="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Nama penuh <span class="-ml-1.5 text-red-500">*</span>
          </label>
          <input
            id="pupil-name"
            v-model="form.name"
            type="text"
            name="name"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="pupil-name"
          />
        </div>

        <LockedSchoolLabel :school="options.school" />

        <div>
          <label for="pupil-class" :class="LABEL">
            <GraduationCap class="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Kelas
          </label>
          <select
            id="pupil-class"
            v-model="form.classId"
            name="classId"
            :class="[FORM_SELECT_CLASS, 'min-h-11']"
            data-testid="pupil-class"
          >
            <option value="">Tiada kelas</option>
            <option v-for="c in options.classes" :key="c.id" :value="String(c.id)">
              {{ c.name }}
            </option>
          </select>
        </div>

        <div>
          <label for="pupil-email" :class="LABEL">
            <Mail class="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Emel <span class="-ml-1.5 text-red-500">*</span>
          </label>
          <input
            id="pupil-email"
            v-model="form.email"
            type="email"
            name="email"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="pupil-email"
          />
        </div>

        <div>
          <label for="pupil-password" :class="LABEL">
            <KeyRound class="h-4 w-4 text-slate-500" aria-hidden="true" />
            Kata laluan
          </label>
          <input
            id="pupil-password"
            v-model="form.password"
            type="password"
            name="password"
            autocomplete="new-password"
            :placeholder="options.passwordPlaceholder"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="pupil-password"
          />
          <p class="mt-1 text-xs text-slate-500" data-testid="pupil-password-hint">
            {{ options.passwordHint }}
          </p>
        </div>
      </div>

      <div
        class="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        data-testid="user-form-footer"
      >
        <RouterLink :to="PUPIL_LIST_PATH" :class="BUTTON_CANCEL" data-testid="user-cancel">
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Batal
        </RouterLink>
        <button type="submit" :disabled="saving" :class="BUTTON_PRIMARY" data-testid="user-submit">
          <LoadingSpinner v-if="saving" class="h-4 w-4" />
          <UserPlus v-else class="h-4 w-4" aria-hidden="true" />
          Cipta Pelajar
        </button>
      </div>
    </form>
  </div>
</template>
