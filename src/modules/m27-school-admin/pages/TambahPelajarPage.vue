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
import { computed, nextTick, reactive, ref, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash } from '@/composables'
import { DsPage } from '@/ds'

import {
  createSchoolPupil,
  fetchSchoolPupilFormOptions,
  type CreatePupilResult,
} from '../api/school-admin'
import NativeSelect from '../components/native/NativeSelect.vue'
import LockedSchoolLabel from '../components/users/LockedSchoolLabel.vue'
import PupilCredentialBlock from '../components/users/PupilCredentialBlock.vue'
import { errorLines, PUPIL_LIST_PATH } from '../components/users/users-format'

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
  <DsPage class="max-w-2xl" data-testid="sp-create-page">
    <PupilCredentialBlock v-if="credential" :credential="credential" />

    <UAlert
      v-if="loadError && !refused"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle"
      :title="errorLines(loadError).join(' ')"
      role="alert"
      data-testid="user-load-error"
    />

    <UCard v-else-if="!options" data-testid="user-form-skeleton">
      <div class="flex flex-col gap-6">
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </div>
    </UCard>

    <form v-else method="post" novalidate data-testid="user-form" @submit.prevent="submit">
      <UCard>
        <div ref="alertBox" class="empty:hidden">
          <UAlert
            v-if="errors.length"
            color="error"
            variant="subtle"
            icon="i-ph-warning-circle"
            class="mb-4"
            role="alert"
            data-testid="user-form-alert"
          >
            <template #description>
              <ul class="flex flex-col gap-1">
                <li v-for="line in errors" :key="line">{{ line }}</li>
              </ul>
            </template>
          </UAlert>
        </div>

        <div class="flex flex-col gap-6">
          <UFormField label="Nama penuh *" name="pupil-name">
            <UInput
              id="pupil-name"
              v-model="form.name"
              type="text"
              name="name"
              icon="i-ph-user"
              class="w-full"
              data-testid="pupil-name"
            />
          </UFormField>

          <LockedSchoolLabel :school="options.school" />

          <UFormField label="Kelas" name="pupil-class">
            <NativeSelect
              id="pupil-class"
              v-model="form.classId"
              name="classId"
              data-testid="pupil-class"
            >
              <option value="">Tiada kelas</option>
              <option v-for="c in options.classes" :key="c.id" :value="String(c.id)">
                {{ c.name }}
              </option>
            </NativeSelect>
          </UFormField>

          <UFormField label="Emel *" name="pupil-email">
            <UInput
              id="pupil-email"
              v-model="form.email"
              type="email"
              name="email"
              icon="i-ph-envelope-simple"
              class="w-full"
              data-testid="pupil-email"
            />
          </UFormField>

          <UFormField label="Kata laluan" name="pupil-password">
            <UInput
              id="pupil-password"
              v-model="form.password"
              type="password"
              name="password"
              autocomplete="new-password"
              icon="i-ph-key"
              :placeholder="options.passwordPlaceholder"
              class="w-full"
              data-testid="pupil-password"
            />
            <template #help>
              <span data-testid="pupil-password-hint">{{ options.passwordHint }}</span>
            </template>
          </UFormField>
        </div>

        <div
          class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="user-form-footer"
        >
          <UButton
            :to="PUPIL_LIST_PATH"
            color="neutral"
            variant="ghost"
            size="lg"
            icon="i-ph-arrow-left"
            class="min-h-11 justify-center"
            data-testid="user-cancel"
            >Batal</UButton
          >
          <UButton
            type="submit"
            size="lg"
            :loading="saving"
            :disabled="saving"
            :icon="saving ? undefined : 'i-ph-user-plus'"
            class="min-h-11 justify-center"
            data-testid="user-submit"
            >Cipta Pelajar</UButton
          >
        </div>
      </UCard>
    </form>
  </DsPage>
</template>
