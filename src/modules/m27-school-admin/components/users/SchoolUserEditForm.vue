<script setup lang="ts">
/**
 * S9 `/admin-sekolah/pelajar/:id` and S10 `/admin-sekolah/guru/:id` "Edit Pengguna" (SRS M27 Part B FR-M27-94 to 98,
 * 104 to 107; BR-M27-31, 34). One page for both roles (`role` prop). A profile card (initials avatar, name,
 * e-mail, "Daftar", "Kemaskini"), the fields "Nama *", "Emel *", "No. Telefon (Pilihan)", S9 only the read-only line
 * "Status" "Aktif", the amber bar "Reset Kata Laluan" (closed) and the footer "Batal" / "Kemaskini". No role,
 * school, grade, IC field or "Nota Keselamatan" card.
 *
 * "Kemaskini" sends ONE PUT (#8 / #13) with name, e-mail, phone and, when typed, the new password pair (applied in one
 * transaction: a 422 saves nothing). #9 / #15 stay in the client contract but the form does not call them. A server `VALIDATION_ERROR` shows in the red alert above the
 * form, keeps the values and clears the passwords. Success queues the flash (the API `status`) and returns to the
 * list. 404 and 403 (an inactive account) render the global pages in place; the form has no native validation so
 * the server's messages show (AC-M27-27.3).
 */
import { ArrowLeft, Calendar, ChevronDown, Clock, Info, KeyRound, Lock, Mail, Phone, Save, ToggleRight, User } from '@lucide/vue'
import { computed, nextTick, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useApi, useFlash } from '@/composables'
import { initialsOf } from '@/shells/shared/avatar'

import {
  fetchSchoolPupil,
  fetchSchoolTeacher,
  updateSchoolPupil,
  updateSchoolTeacher,
  type SchoolUserDetail,
  type SchoolUserInput,
} from '../../api/school-admin'
import {
  BUTTON_BASE,
  BUTTON_CANCEL,
  BUTTON_PRIMARY,
  errorLines,
  formatDate,
  formatDateTime,
  LABEL,
  ROLE_CONFIG,
  type SchoolUserRole,
} from './users-format'

const props = defineProps<{ role: SchoolUserRole; id: number }>()

const router = useRouter()
const flash = useFlash()

const listPath = computed(() => ROLE_CONFIG[props.role].listPath)
const isPupil = computed(() => props.role === 'student')

const { data: loaded, error: loadError } = useApi(
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
const shownError = computed(() => (loadError.value && status.value !== 404 && status.value !== 403 ? loadError.value : null))

const form = reactive({ name: '', email: '', phone: '', newPassword: '', newPasswordConfirmation: '' })
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
    alertBox.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-4" :data-testid="isPupil ? 'sp-edit-page' : 'sg-edit-page'">
    <!-- A failed load other than 404 / 403: the server message and the way back (no M27 copy, FR-M27-48). -->
    <div v-if="shownError" class="space-y-3" data-testid="user-load-error">
      <AlertBox :messages="errorLines(shownError)" />
      <div class="flex flex-wrap gap-3">
        <RouterLink :to="listPath" :class="[BUTTON_BASE, 'bg-slate-100 text-slate-600 hover:bg-slate-200']" data-testid="user-back">
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Batal
        </RouterLink>
      </div>
    </div>

    <div
      v-else-if="loaded === null"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="user-form-skeleton"
    >
      <div class="h-14 animate-pulse rounded-xl bg-slate-100"></div>
      <div v-for="n in 3" :key="n" class="h-11 animate-pulse rounded-xl bg-slate-100"></div>
    </div>

    <form
      v-else
      method="post"
      novalidate
      class="rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="user-form"
      @submit.prevent="submit"
    >
      <!-- FR-M27-94: profile card -->
      <div class="mb-5 flex items-center gap-4 border-b border-slate-100 pb-5" data-testid="user-profile">
        <span
          class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-lg font-bold text-white ring-4 ring-indigo-100"
          aria-hidden="true"
          data-testid="user-profile-avatar"
          >{{ initialsOf(loaded.name) }}</span
        >
        <div class="min-w-0">
          <h3 class="truncate text-base font-bold text-slate-800" data-testid="user-profile-name">
            {{ loaded.name }}
          </h3>
          <p class="truncate text-sm text-slate-500" data-testid="user-profile-email">
            {{ loaded.email }}
          </p>
          <p class="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
            <span class="inline-flex items-center gap-1.5" data-testid="user-profile-created">
              <Calendar class="h-3.5 w-3.5" aria-hidden="true" />
              Daftar: {{ formatDate(loaded.createdAt) }}
            </span>
            <span class="inline-flex items-center gap-1.5" data-testid="user-profile-updated">
              <Clock class="h-3.5 w-3.5" aria-hidden="true" />
              Kemaskini: {{ formatDateTime(loaded.updatedAt) }}
            </span>
          </p>
        </div>
      </div>

      <div ref="alertBox" class="scroll-mt-4">
        <AlertBox :messages="errors" class="mb-5" data-testid="user-form-alert" />
      </div>

      <div class="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
        <div>
          <label for="user-name" :class="LABEL">
            <User class="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Nama <span class="-ml-1.5 text-red-500">*</span>
          </label>
          <input
            id="user-name"
            v-model="form.name"
            type="text"
            name="name"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="user-name"
          />
        </div>

        <div>
          <label for="user-email" :class="LABEL">
            <Mail class="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Emel <span class="-ml-1.5 text-red-500">*</span>
          </label>
          <input
            id="user-email"
            v-model="form.email"
            type="email"
            name="email"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="user-email"
          />
        </div>

        <div>
          <label for="user-phone" :class="LABEL">
            <Phone class="h-4 w-4 text-emerald-500" aria-hidden="true" />
            No. Telefon <span class="-ml-1 font-normal text-slate-400">(Pilihan)</span>
          </label>
          <input
            id="user-phone"
            v-model="form.phone"
            type="tel"
            name="phone"
            maxlength="14"
            placeholder="Cth: 0191234567"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="user-phone"
          />
        </div>

        <!-- FR-M27-94: the read-only status line of S9 (pupil activation is not the school admin's). -->
        <div v-if="isPupil" data-testid="user-status-line">
          <span :class="LABEL">
            <ToggleRight class="h-4 w-4 text-emerald-500" aria-hidden="true" />
            Status
          </span>
          <p class="flex min-h-11 items-center">
            <span
              class="inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700"
              data-testid="user-status-value"
              >Aktif</span
            >
          </p>
        </div>

        <!-- FR-M27-95 / 104: the amber bar "Reset Kata Laluan" -->
        <div class="md:col-span-2">
          <button
            type="button"
            class="flex min-h-11 w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left transition hover:bg-amber-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
            data-testid="user-password-toggle"
            @click="passwordOpen = !passwordOpen"
          >
            <KeyRound class="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold text-amber-900">Reset Kata Laluan</span>
              <span class="block text-xs text-amber-700">
                Klik untuk buka bahagian reset kata laluan
              </span>
            </span>
            <ChevronDown
              class="h-5 w-5 shrink-0 text-amber-500 transition-transform"
              :class="passwordOpen ? 'rotate-180' : ''"
              aria-hidden="true"
            />
          </button>
          <div
            v-show="passwordOpen"
            class="mt-3 grid grid-cols-1 gap-4 rounded-xl border border-amber-200 p-4 md:grid-cols-2"
            data-testid="user-password-panel"
          >
            <div>
              <label for="user-new-password" :class="LABEL">
                <Lock class="h-4 w-4 text-slate-500" aria-hidden="true" />
                Kata Laluan Baru
              </label>
              <input
                id="user-new-password"
                v-model="form.newPassword"
                type="password"
                name="new_password"
                autocomplete="new-password"
                placeholder="Minimum 6 aksara"
                :class="[FORM_INPUT_CLASS, 'min-h-11']"
                data-testid="user-new-password"
              />
            </div>
            <div>
              <label for="user-new-password-confirm" :class="LABEL">
                <Lock class="h-4 w-4 text-slate-500" aria-hidden="true" />
                Sahkan Kata Laluan Baru
              </label>
              <input
                id="user-new-password-confirm"
                v-model="form.newPasswordConfirmation"
                type="password"
                name="new_password_confirmation"
                autocomplete="new-password"
                placeholder="Taip semula kata laluan baru"
                :class="[FORM_INPUT_CLASS, 'min-h-11']"
                data-testid="user-new-password-confirm"
              />
            </div>
            <p class="flex items-start gap-1.5 text-xs text-slate-500 md:col-span-2">
              <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Kosongkan jika tidak mahu tukar kata laluan. Kata laluan baru akan berkuat kuasa
              serta-merta.
            </p>
          </div>
        </div>
      </div>

      <div
        class="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
      >
        <RouterLink :to="listPath" :class="BUTTON_CANCEL" data-testid="user-cancel">
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Batal
        </RouterLink>
        <button type="submit" :disabled="saving" :class="BUTTON_PRIMARY" data-testid="user-submit">
          <LoadingSpinner v-if="saving" class="h-4 w-4" />
          <Save v-else class="h-4 w-4" aria-hidden="true" />
          Kemaskini
        </button>
      </div>
    </form>
  </div>
</template>
