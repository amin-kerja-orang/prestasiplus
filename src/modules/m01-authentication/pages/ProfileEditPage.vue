<script setup lang="ts">
/**
 * S8 `/profile/edit` "Kemaskini Profil - PRESTASIPLUS" (M01-T6; FR-M01-39..45, BR-13..16), v2 restyle (B09 / A1).
 * Three cards in the order of live: "Gambar Profil" (own form), "Maklumat Peribadi" + actions row
 * (one form, `PUT /api/me`: name, phone, bio only; Tingkatan and school change only through the admin
 * user edit, S5-T05), and "Tukar Kata Laluan" (own form).
 * Native validation (`required` name, except the school admin, whose empty Nama shows the app line "Sila isi nama." instead; `maxlength` bio 1000). The bio counter is `{n}/1000` (FR-MUR-A1-11). Outcomes show in the flash outlet at the top of the shell main:
 * success texts and server errors are UNVERIFIED COPY (SRS §8). The form is seeded from the cached
 * session user; a background `GET /api/me` refresh re-seeds it only while the user has not typed.
 */
import { computed, onMounted, ref } from 'vue'

import { useFlash } from '@/composables/useFlash'
import { useSessionStore } from '@/stores/session'

import { updateProfile, type UserMe } from '../api'
import ProfileAvatarCard from '../components/profile/ProfileAvatarCard.vue'
import ProfilePasswordCard from '../components/profile/ProfilePasswordCard.vue'
import { errorLines } from '../lib/error-lines'

const session = useSessionStore()
const flash = useFlash()
const user = computed(() => session.user)
/** S5-T14 (R1-AS-A1): the school admin's form follows the field table of 20 R1-AS-A1 (other roles keep the V3 behaviour). */
const isSchoolAdmin = computed(() => user.value?.role === 'school_admin')
const SCHOOL_ADMIN_PROFILE_SAVED = 'Profil dikemaskini.'
const PHONE = /^\+?\d{9,14}$/

/**
 * FR-AS-A1-4, AC-AS-A1-4: Nama required and at most 255 characters; Telefon optional, digits with an optional leading "+",
 * 9 to 14 digits. Spaces and dashes typed for readability (the placeholder is "012-3456789") are ignored by the check and
 * the value is sent as typed. Nothing is saved while a check fails.
 */
function schoolAdminProfileErrors(input: { name: string; phone: string }): string[] {
  const out: string[] = []
  const trimmed = input.name.trim()
  if (trimmed === '') out.push('Sila isi nama.')
  else if (trimmed.length > 255) out.push('Nama tidak boleh melebihi 255 aksara.')
  const digits = input.phone.trim().replace(/[\s-]/g, '')
  if (digits !== '' && !PHONE.test(digits)) out.push('Format telefon tidak sah.')
  return out
}

const name = ref('')
const phone = ref('')
const bio = ref('')
const saving = ref(false)
const touched = ref(false)

function seed(me: UserMe): void {
  name.value = me.name
  phone.value = me.phone ?? ''
  bio.value = me.bio ?? ''
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
  flash.clear()
  if (isSchoolAdmin.value) {
    const problems = schoolAdminProfileErrors({ name: name.value, phone: phone.value })
    if (problems.length) {
      showErrors(problems)
      return
    }
  }
  saving.value = true
  try {
    // The school admin's values are sent trimmed, as they were checked (S5-T14).
    const sentName = isSchoolAdmin.value ? name.value.trim() : name.value
    const sentPhone = isSchoolAdmin.value ? phone.value.trim() : phone.value
    const result = await updateProfile({
      name: sentName,
      phone: sentPhone === '' ? null : sentPhone,
      bio: bio.value === '' ? null : bio.value,
    })
    session.setUser(result.data)
    seed(result.data)
    touched.value = false
    showSuccess(isSchoolAdmin.value ? SCHOOL_ADMIN_PROFILE_SAVED : result.status)
  } catch (err) {
    showErrors(errorLines(err))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div
    v-if="user"
    class="mx-auto flex w-full max-w-3xl flex-col gap-4 md:gap-6"
    data-testid="profile-edit-page"
  >
    <ProfileAvatarCard
      :name="user.name"
      :avatar-url="user.avatarUrl"
      @saved="onPictureSaved"
      @failed="showErrors"
    />

    <form
      class="flex flex-col gap-4 md:gap-6"
      data-testid="profile-form"
      @submit.prevent="submit"
      @input="touched = true"
    >
      <UCard>
        <div class="flex flex-col gap-4">
          <h2 class="flex items-center gap-2 text-subheading text-highlighted">
            <UIcon name="i-ph-user-circle" class="size-5" aria-hidden="true" />
            Maklumat Peribadi
          </h2>

          <UFormField label="Nama Penuh">
            <UInput
              v-model="name"
              type="text"
              name="name"
              :required="!isSchoolAdmin"
              icon="i-ph-user"
              size="lg"
              class="w-full"
              data-testid="profile-name-input"
            />
          </UFormField>

          <UFormField label="Email" help="Email tidak boleh diubah">
            <UInput
              type="email"
              disabled
              :model-value="user.email"
              icon="i-ph-envelope"
              size="lg"
              class="w-full"
              data-testid="profile-email-input"
            />
          </UFormField>

          <UFormField label="No. Telefon">
            <UInput
              v-model="phone"
              type="tel"
              name="phone"
              placeholder="012-3456789"
              icon="i-ph-phone"
              size="lg"
              class="w-full"
              data-testid="profile-phone-input"
            />
          </UFormField>

          <UFormField label="Bio / Motto">
            <UTextarea
              v-model="bio"
              name="bio"
              :rows="3"
              :maxlength="1000"
              placeholder="Tulis sesuatu tentang diri anda..."
              size="lg"
              class="w-full"
              data-testid="profile-bio-input"
            />
            <template #help>
              <!-- FR-MUR-A1-11: the limit is 1000 and the counter is `{n}/1000` (live showed a static "Baki: 500 aksara"). -->
              <span data-testid="profile-bio-counter">{{ bio.length }}/1000</span>
            </template>
          </UFormField>
        </div>
      </UCard>

      <div class="flex items-center justify-between gap-3" data-testid="profile-actions">
        <UButton
          to="/profile"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-arrow-left"
          data-testid="profile-back"
          >Kembali</UButton
        >
        <UButton
          type="submit"
          color="primary"
          size="lg"
          icon="i-ph-floppy-disk"
          :loading="saving"
          :disabled="saving"
          data-testid="profile-save"
          >Simpan Profil</UButton
        >
      </div>
    </form>

    <ProfilePasswordCard @saved="showSuccess" @failed="showErrors" />
  </div>
</template>
