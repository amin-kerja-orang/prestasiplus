<script setup lang="ts">
/**
 * S8 `/profile/edit` "Kemaskini Profil - PRESTASIPLUS" (M01-T6; FR-M01-39..45, BR-13..16).
 * Four cards in the order of live: "Gambar Profil" (own form), "Maklumat Peribadi" + "Maklumat
 * Sekolah" + actions row (one form, `PUT /api/me`), and "Tukar Kata Laluan" (own form).
 * Native validation only (`required` name, `maxlength` bio). The bio counter is static, as live
 * (its binding is missing there). Outcomes show in the flash outlet at the top of the shell main:
 * success texts and server errors are UNVERIFIED COPY (SRS §8). The form is seeded from the cached
 * session user; a background `GET /api/me` refresh re-seeds it only while the user has not typed.
 */
import { ArrowLeft, Mail, MessageSquare, Phone, Save, School, User } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { FORM_DISABLED_MODIFIER, FORM_TEXTAREA_CLASS } from '@/components/form'
import { LoadingSpinner } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'
import { useSessionStore } from '@/stores/session'

import { updateProfile, type SchoolSummary, type UserMe } from '../api'
import ProfileAvatarCard from '../components/profile/ProfileAvatarCard.vue'
import {
  PROFILE_BUTTON_CLASS,
  PROFILE_CARD_CLASS,
  PROFILE_CARD_TITLE_CLASS,
  PROFILE_INPUT_CLASS,
  PROFILE_LABEL_CLASS,
} from '../components/profile/classes'
import ProfileGradePicker from '../components/profile/ProfileGradePicker.vue'
import ProfilePasswordCard from '../components/profile/ProfilePasswordCard.vue'
import ProfileSchoolPicker from '../components/profile/ProfileSchoolPicker.vue'
import { errorLines } from '../lib/error-lines'

const session = useSessionStore()
const flash = useFlash()
const user = computed(() => session.user)

const name = ref('')
const phone = ref('')
const bio = ref('')
const grade = ref<number | null>(null)
const school = ref<SchoolSummary | null>(null)
/** Saved grade decides the "Tahap" group (7-11 = secondary); it does not flip while editing. */
const secondary = ref(false)
const saving = ref(false)
const touched = ref(false)

function seed(me: UserMe): void {
  name.value = me.name
  phone.value = me.phone ?? ''
  bio.value = me.bio ?? ''
  grade.value = me.grade
  school.value = me.school
  secondary.value = me.grade !== null && me.grade >= 7
}

if (session.user) seed(session.user)

onMounted(async () => {
  const fresh = await session.refreshUser()
  if (fresh && !touched.value) seed(fresh)
})

function showSuccess(status: string): void {
  flash.show({ type: 'success', message: status })
  scrollToTop()
}

function showErrors(lines: string[]): void {
  flash.show({ type: 'error', message: lines })
  scrollToTop()
}

/** The flash sits at the top of `main`, above the long form: bring it into view. */
function scrollToTop(): void {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

/** A picture or password success refreshes the cached user (new avatar in the shell, etc.). */
async function onPictureSaved(status: string): Promise<void> {
  await session.refreshUser()
  showSuccess(status)
}

async function submit(): Promise<void> {
  saving.value = true
  flash.clear()
  try {
    const result = await updateProfile({
      name: name.value,
      phone: phone.value === '' ? null : phone.value,
      bio: bio.value === '' ? null : bio.value,
      grade: grade.value,
      schoolId: school.value?.id ?? null,
    })
    session.setUser(result.data)
    seed(result.data)
    touched.value = false
    showSuccess(result.status)
  } catch (err) {
    showErrors(errorLines(err))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="user" class="mx-auto max-w-3xl space-y-4 sm:space-y-6" data-testid="profile-edit-page">
    <ProfileAvatarCard
      :name="user.name"
      :avatar-url="user.avatarUrl"
      @saved="onPictureSaved"
      @failed="showErrors"
    />

    <form
      class="space-y-4 sm:space-y-6"
      data-testid="profile-form"
      @submit.prevent="submit"
      @input="touched = true"
    >
      <section :class="PROFILE_CARD_CLASS">
        <h2 :class="PROFILE_CARD_TITLE_CLASS">
          <User class="h-5 w-5 text-indigo-500" />
          Maklumat Peribadi
        </h2>

        <div class="space-y-4">
          <div>
            <label for="name" :class="PROFILE_LABEL_CLASS">
              <User class="h-4 w-4 text-blue-500" />
              Nama Penuh
            </label>
            <input
              id="name"
              v-model="name"
              type="text"
              name="name"
              required
              :class="PROFILE_INPUT_CLASS"
              data-testid="profile-name-input"
            />
          </div>

          <div>
            <label for="email_display" :class="PROFILE_LABEL_CLASS">
              <Mail class="h-4 w-4 text-purple-500" />
              Email
            </label>
            <input
              id="email_display"
              type="email"
              disabled
              :value="user.email"
              :class="[PROFILE_INPUT_CLASS, FORM_DISABLED_MODIFIER]"
              data-testid="profile-email-input"
            />
            <p class="mt-1 text-xs text-slate-500">Email tidak boleh diubah</p>
          </div>

          <div>
            <label for="phone" :class="PROFILE_LABEL_CLASS">
              <Phone class="h-4 w-4 text-green-500" />
              No. Telefon
            </label>
            <input
              id="phone"
              v-model="phone"
              type="tel"
              name="phone"
              placeholder="012-3456789"
              :class="PROFILE_INPUT_CLASS"
              data-testid="profile-phone-input"
            />
          </div>

          <div>
            <label for="bio" :class="PROFILE_LABEL_CLASS">
              <MessageSquare class="h-4 w-4 text-amber-500" />
              Bio / Motto
            </label>
            <textarea
              id="bio"
              v-model="bio"
              name="bio"
              rows="3"
              maxlength="500"
              placeholder="Tulis sesuatu tentang diri anda..."
              :class="FORM_TEXTAREA_CLASS"
              data-testid="profile-bio-input"
            ></textarea>
            <!-- Static, as live: the counter never updates (FR-M01-39). -->
            <p class="mt-1 text-xs text-slate-500" data-testid="profile-bio-counter">
              Baki: 500 aksara
            </p>
          </div>

          <ProfileGradePicker
            v-model="grade"
            :secondary="secondary"
            @update:model-value="touched = true"
          />
        </div>
      </section>

      <section :class="PROFILE_CARD_CLASS">
        <h2 :class="PROFILE_CARD_TITLE_CLASS">
          <School class="h-5 w-5 text-orange-500" />
          Maklumat Sekolah
        </h2>
        <p class="mb-3 text-sm text-slate-600">
          Pilih sekolah anda untuk sambung dengan rakan sekelas
        </p>
        <ProfileSchoolPicker v-model="school" @update:model-value="touched = true" />
      </section>

      <div class="flex items-center justify-between gap-3" data-testid="profile-actions">
        <RouterLink
          to="/profile"
          class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none"
          data-testid="profile-back"
        >
          <ArrowLeft class="h-4 w-4" />
          Kembali
        </RouterLink>
        <button
          type="submit"
          :disabled="saving"
          :class="[PROFILE_BUTTON_CLASS, 'bg-save-gradient']"
          data-testid="profile-save"
        >
          <LoadingSpinner v-if="saving" />
          <Save v-else class="h-4 w-4" />
          Simpan Profil
        </button>
      </div>
    </form>

    <ProfilePasswordCard @saved="showSuccess" @failed="showErrors" />
  </div>
</template>
