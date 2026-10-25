<script setup lang="ts">
/**
 * S9 `/admin-sekolah/pelajar/:id` and S10 `/admin-sekolah/guru/:id` "Edit Pengguna" (SRS M27 Part B FR-M27-94 to 98,
 * 104 to 107; BR-M27-31, 34). One page for both roles (`role` prop). A profile card (initials avatar, name,
 * e-mail, "Daftar", "Kemaskini"), the fields "Nama *", "Emel *", "No. Telefon (Pilihan)", S9 only the read-only line
 * "Status" "Aktif", the "Reset Kata Laluan" bar (closed) and the footer "Batal" / "Kemaskini". No role,
 * school, grade, IC field or "Nota Keselamatan" card.
 *
 * "Kemaskini" sends ONE PUT (#8 / #13) with name, e-mail, phone and, when typed, the new password pair (applied in one
 * transaction: a 422 saves nothing). #9 / #15 stay in the client contract but the form does not call them. A server
 * `VALIDATION_ERROR` shows in the alert above the form, keeps the values and clears the passwords. Success queues the
 * flash (the API `status`) and returns to the list. 404 and 403 (an inactive account) render the global pages in
 * place; the form has no native validation so the server's messages show (AC-M27-27.3).
 */
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash } from '@/composables'
import {
  DsBackLink,
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStatusBadge,
} from '@/ds'

import {
  fetchSchoolPupil,
  fetchSchoolTeacher,
  updateSchoolPupil,
  updateSchoolTeacher,
  type SchoolUserDetail,
  type SchoolUserInput,
} from '../../api/school-admin'
import {
  errorLines,
  formatDate,
  formatDateTime,
  newPasswordPlaceholder,
  ROLE_CONFIG,
  type SchoolUserRole,
} from './users-format'

const props = defineProps<{ role: SchoolUserRole; id: number }>()

const router = useRouter()
const flash = useFlash()

const listPath = computed(() => ROLE_CONFIG[props.role].listPath)
const isPupil = computed(() => props.role === 'student')

const {
  data: loaded,
  error: loadError,
  reload,
} = useApi(
  (signal) =>
    props.role === 'student'
      ? fetchSchoolPupil(props.id, { signal })
      : fetchSchoolTeacher(props.id, { signal }),
  [() => props.role, () => props.id],
)

/** FR-M27-43 / 96 / 105: an unknown, foreign or wrong-role id is the 404 page; an inactive account the 403 page. */
const status = computed(() => (isApiError(loadError.value) ? loadError.value.status : null))
watch(
  status,
  (s) => {
    if (s === 404) setRouteOutcome(404)
    else if (s === 403) setRouteOutcome(403)
  },
  { immediate: true },
)
const shownError = computed(() =>
  loadError.value && status.value !== 404 && status.value !== 403 ? loadError.value : null,
)

const form = reactive({
  name: '',
  email: '',
  phone: '',
  newPassword: '',
  newPasswordConfirmation: '',
})
const passwordOpen = ref(false)

function fill(user: SchoolUserDetail): void {
  form.name = user.name
  form.email = user.email
  form.phone = user.phone ?? ''
  form.newPassword = ''
  form.newPasswordConfirmation = ''
  passwordOpen.value = false
}

watch(loaded, (user) => {
  if (user) fill(user)
})

const saving = ref(false)
const errors = ref<string[]>([])
const alertBox = ref<HTMLElement | null>(null)

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = []
  try {
    // One PUT (#8 / #13): the optional password pair is applied with the profile in one transaction, so a 422
    // leaves nothing saved (FR-M27-95, BR-M27-34).
    const input: SchoolUserInput = {
      name: form.name,
      email: form.email,
      phone: form.phone,
    }
    if (form.newPassword !== '' || form.newPasswordConfirmation !== '') {
      input.newPassword = form.newPassword
      input.newPasswordConfirmation = form.newPasswordConfirmation
    }
    const result = isPupil.value
      ? await updateSchoolPupil(props.id, input)
      : await updateSchoolTeacher(props.id, input)
    flash.success(result.status)
    await router.push(listPath.value)
  } catch (err) {
    errors.value = errorLines(err)
    form.newPassword = ''
    form.newPasswordConfirmation = ''
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'center' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage class="max-w-4xl" :data-testid="isPupil ? 'sp-edit-page' : 'sg-edit-page'">
    <!-- A failed load other than 404 / 403: the server message and the way back (no M27 copy, FR-M27-48). -->
    <div v-if="shownError" class="flex flex-col gap-3" data-testid="user-load-error">
      <DsLoadError :message="errorLines(shownError).join(' ')" @retry="reload" />
      <DsBackLink :to="listPath" label="Batal" data-testid="user-back" />
    </div>

    <DsPanel v-else-if="loaded === null" data-testid="user-form-skeleton">
      <div class="flex flex-col gap-6">
        <USkeleton class="h-14 w-full" />
        <USkeleton v-for="n in 3" :key="n" class="h-11 w-full" />
      </div>
    </DsPanel>

    <form
      v-else
      method="post"
      novalidate
      class="flex min-w-0 flex-col gap-6"
      data-testid="user-form"
      @submit.prevent="submit"
    >
      <!-- FR-M27-94: profile card -->
      <DsPanel data-testid="user-profile">
        <div class="flex items-center gap-4">
          <UAvatar
            :alt="loaded.name"
            size="3xl"
            aria-hidden="true"
            data-testid="user-profile-avatar"
          />
          <div class="min-w-0">
            <h2 class="truncate text-subheading text-highlighted" data-testid="user-profile-name">
              {{ loaded.name }}
            </h2>
            <p class="truncate text-body text-muted" data-testid="user-profile-email">
              {{ loaded.email }}
            </p>
            <p class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted">
              <span class="inline-flex items-center gap-2" data-testid="user-profile-created">
                <UIcon name="i-ph-calendar-blank" class="size-4" aria-hidden="true" />
                Daftar: {{ formatDate(loaded.createdAt) }}
              </span>
              <span class="inline-flex items-center gap-2" data-testid="user-profile-updated">
                <UIcon name="i-ph-clock" class="size-4" aria-hidden="true" />
                Kemaskini: {{ formatDateTime(loaded.updatedAt) }}
              </span>
            </p>
          </div>
        </div>
      </DsPanel>

      <div ref="alertBox" class="empty:hidden">
        <UAlert
          v-if="errors.length"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
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

      <DsFormSection title="Maklumat Pengguna" icon="user-circle" accent="action" :columns="2">
        <DsFormField label="Nama" required name="user-name">
          <UInput
            id="user-name"
            v-model="form.name"
            type="text"
            name="name"
            icon="i-ph-user"
            class="w-full"
            data-testid="user-name"
          />
        </DsFormField>

        <DsFormField label="Emel" required name="user-email">
          <UInput
            id="user-email"
            v-model="form.email"
            type="email"
            name="email"
            icon="i-ph-envelope-simple"
            class="w-full"
            data-testid="user-email"
          />
        </DsFormField>

        <DsFormField label="No. Telefon (Pilihan)" name="user-phone">
          <UInput
            id="user-phone"
            v-model="form.phone"
            type="tel"
            name="phone"
            maxlength="14"
            icon="i-ph-phone"
            placeholder="Cth: 0191234567"
            class="w-full"
            data-testid="user-phone"
          />
        </DsFormField>

        <!-- FR-M27-94: the read-only status line of S9 (pupil activation is not the school admin's). -->
        <DsFormField v-if="isPupil" label="Status" data-testid="user-status-line">
          <p class="flex min-h-11 items-center">
            <DsStatusBadge status="active" data-testid="user-status-value" />
          </p>
        </DsFormField>
      </DsFormSection>

      <!-- FR-M27-95 / 104: "Reset Kata Laluan" -->
      <DsFormSection
        title="Reset Kata Laluan"
        icon="key"
        accent="heat"
        description="Klik untuk buka bahagian reset kata laluan"
        :columns="2"
      >
        <template #actions>
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            :trailing-icon="passwordOpen ? 'i-ph-caret-up' : 'i-ph-caret-down'"
            :aria-expanded="passwordOpen"
            :label="passwordOpen ? 'Tutup' : 'Buka'"
            class="min-h-11"
            data-testid="user-password-toggle"
            @click="passwordOpen = !passwordOpen"
          />
        </template>
        <div
          v-show="passwordOpen"
          class="grid min-w-0 gap-6 sm:col-span-2 sm:grid-cols-2"
          data-testid="user-password-panel"
        >
          <DsFormField label="Kata Laluan Baru" name="user-new-password">
            <UInput
              id="user-new-password"
              v-model="form.newPassword"
              type="password"
              name="new_password"
              autocomplete="new-password"
              icon="i-ph-lock-simple"
              :placeholder="newPasswordPlaceholder()"
              class="w-full"
              data-testid="user-new-password"
            />
          </DsFormField>
          <DsFormField label="Sahkan Kata Laluan Baru" name="user-new-password-confirm">
            <UInput
              id="user-new-password-confirm"
              v-model="form.newPasswordConfirmation"
              type="password"
              name="new_password_confirmation"
              autocomplete="new-password"
              icon="i-ph-lock-simple"
              placeholder="Taip semula kata laluan baru"
              class="w-full"
              data-testid="user-new-password-confirm"
            />
          </DsFormField>
          <p class="flex items-start gap-2 text-caption text-muted sm:col-span-2">
            <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" aria-hidden="true" />
            Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa
            serta-merta.
          </p>
        </div>
      </DsFormSection>

      <DsFormBar :cancel-to="listPath" submit-label="Kemaskini" :saving="saving" />
    </form>
  </DsPage>
</template>
