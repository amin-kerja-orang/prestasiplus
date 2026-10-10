<script setup lang="ts">
/**
 * S11 `/admin-sekolah/guru/baru` "Cipta Pengguna" (SRS M27 Part B FR-M27-108 to 110; BR-M27-33). Card "Borang
 * Pendaftaran Pengguna", the read-only role "Guru", the locked school label (the session school), "Nama *", "Emel *",
 * "No. Telefon (Pilihan)", "Kata Laluan *" and "Sahkan Kata Laluan *", footer "Batal" / "Daftar Pengguna".
 *
 * The role, school and `isActive` are fixed by the server; the form sends none of them. A server
 * `VALIDATION_ERROR` shows in the red alert above the form, keeps the values and clears the passwords. Success
 * queues the flash (the API `status`) and opens S7. No native validation, so the server's messages show.
 */
import { ArrowLeft, Lock, Mail, Phone, User, UserCog, UserPlus } from '@lucide/vue'
import { nextTick, reactive, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { FORM_INPUT_CLASS } from '@/components/form'
import { useFlash, useSession } from '@/composables'

import { createSchoolTeacher } from '../api/school-admin'
import LockedSchoolLabel from '../components/users/LockedSchoolLabel.vue'
import {
  BUTTON_CANCEL,
  BUTTON_PRIMARY,
  errorLines,
  LABEL,
  TEACHER_LIST_PATH,
} from '../components/users/users-format'

const router = useRouter()
const flash = useFlash()
const { user: me } = useSession()

const form = reactive({ name: '', email: '', phone: '', password: '', passwordConfirmation: '' })
const saving = ref(false)
const errors = ref<string[]>([])
const alertBox = ref<HTMLElement | null>(null)

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = []
  try {
    const result = await createSchoolTeacher({
      name: form.name,
      email: form.email,
      phone: form.phone,
      password: form.password,
      passwordConfirmation: form.passwordConfirmation,
    })
    flash.success(result.status)
    await router.push(TEACHER_LIST_PATH)
  } catch (err) {
    errors.value = errorLines(err)
    form.password = ''
    form.passwordConfirmation = ''
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'start' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-w-0" data-testid="sg-create-page">
    <form
      method="post"
      novalidate
      class="rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="user-form"
      @submit.prevent="submit"
    >
      <div class="mb-5 flex items-center gap-3 border-b border-slate-100 pb-4">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"
        >
          <UserPlus class="h-5 w-5" aria-hidden="true" />
        </span>
        <div class="min-w-0">
          <h2 class="text-base font-bold text-slate-800">Borang Pendaftaran Pengguna</h2>
          <p class="text-sm text-slate-500">Isi maklumat untuk mendaftarkan pengguna baru</p>
        </div>
      </div>

      <div ref="alertBox" class="scroll-mt-4">
        <AlertBox :messages="errors" class="mb-5" data-testid="user-form-alert" />
      </div>

      <div class="grid grid-cols-1 gap-x-5 gap-y-5 md:grid-cols-2">
        <div>
          <span :class="LABEL">
            <UserCog class="h-4 w-4 text-indigo-500" aria-hidden="true" />
            Peranan
          </span>
          <p
            class="flex min-h-11 items-center rounded-xl border-2 border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-800"
            data-testid="user-role"
          >
            Guru
          </p>
        </div>

        <LockedSchoolLabel v-if="me?.school" :school="me.school" />

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
            placeholder="Nama penuh"
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
            placeholder="contoh@email.com"
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
            inputmode="tel"
            placeholder="Cth: 0191234567"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="user-phone"
          />
        </div>

        <div>
          <label for="user-password" :class="LABEL">
            <Lock class="h-4 w-4 text-slate-500" aria-hidden="true" />
            Kata Laluan <span class="-ml-1.5 text-red-500">*</span>
          </label>
          <input
            id="user-password"
            v-model="form.password"
            type="password"
            name="password"
            autocomplete="new-password"
            placeholder="Minimum 6 aksara"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="user-password"
          />
        </div>

        <div>
          <label for="user-password-confirm" :class="LABEL">
            <Lock class="h-4 w-4 text-slate-500" aria-hidden="true" />
            Sahkan Kata Laluan <span class="-ml-1.5 text-red-500">*</span>
          </label>
          <input
            id="user-password-confirm"
            v-model="form.passwordConfirmation"
            type="password"
            name="password_confirmation"
            autocomplete="new-password"
            placeholder="Taip semula kata laluan"
            :class="[FORM_INPUT_CLASS, 'min-h-11']"
            data-testid="user-password-confirm"
          />
        </div>
      </div>

      <div
        class="mt-6 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        data-testid="user-form-footer"
      >
        <RouterLink :to="TEACHER_LIST_PATH" :class="BUTTON_CANCEL" data-testid="user-cancel">
          <ArrowLeft class="h-4 w-4" aria-hidden="true" />
          Batal
        </RouterLink>
        <button type="submit" :disabled="saving" :class="BUTTON_PRIMARY" data-testid="user-submit">
          <LoadingSpinner v-if="saving" class="h-4 w-4" />
          <UserPlus v-else class="h-4 w-4" aria-hidden="true" />
          Daftar Pengguna
        </button>
      </div>
    </form>
  </div>
</template>
