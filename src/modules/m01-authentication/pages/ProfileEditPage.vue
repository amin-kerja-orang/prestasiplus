<script setup lang="ts">
/**
 * S8 `/profile/edit` "Kemaskini Profil - PRESTASIPLUS" (M01-T6; FR-M01-39..45, BR-13..16), v2 restyle (B09 / A1).
 * Four cards in the order of live: "Gambar Profil" (own form), "Maklumat Peribadi" + "Maklumat
 * Sekolah" + actions row (one form, `PUT /api/me`), and "Tukar Kata Laluan" (own form).
 * Native validation only (`required` name, `maxlength` bio). The bio counter is static, as live
 * (its binding is missing there). Outcomes show in the flash outlet at the top of the shell main:
 * success texts and server errors are UNVERIFIED COPY (SRS §8). The form is seeded from the cached
 * session user; a background `GET /api/me` refresh re-seeds it only while the user has not typed.
 */
import { computed, onMounted, ref } from 'vue'

import { isHttpMode } from '@/api/mode'
import { useFlash } from '@/composables/useFlash'
import { useSessionStore } from '@/stores/session'

import { getMe, updateProfile, type SchoolSummary, type UserMe } from '../api'
import ProfileAvatarCard from '../components/profile/ProfileAvatarCard.vue'
import ProfileGradePicker from '../components/profile/ProfileGradePicker.vue'
import ProfilePasswordCard from '../components/profile/ProfilePasswordCard.vue'
import ProfileSchoolPicker from '../components/profile/ProfileSchoolPicker.vue'
import { errorLines } from '../lib/error-lines'

const session = useSessionStore()
const flash = useFlash()
const user = computed(() => session.user)

/**
 * DV-28: the real API stores a self-chosen school only when the account has at least one role and EVERY role is
 * student or parent (any other role ignores `schoolId`, so the card would "save" nothing). The client `UserMe`
 * has only the active `role`, so in http mode the whole `roles[]` is read from the raw `GET /api/me` (and the
 * `PUT /api/me` answer); until it is known the card stays hidden. Mock mode (live) shows it for every role.
 */
const SELF_SCHOOL_ROLES: readonly string[] = ['student', 'parent']
const http = isHttpMode()
const roles = ref<readonly string[] | null>(null)

function readRoles(me: unknown): void {
  const list = (me as { roles?: unknown } | null)?.roles
  if (Array.isArray(list) && list.every((r) => typeof r === 'string')) roles.value = list
}

const showSchool = computed(
  () =>
    !http ||
    (roles.value !== null &&
      roles.value.length > 0 &&
      roles.value.every((r) => SELF_SCHOOL_ROLES.includes(r))),
)

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
  if (http) {
    try {
      readRoles(await getMe())
    } catch {
      // Roles stay unknown: the school card stays hidden (fail closed).
    }
  }
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
      ...(showSchool.value ? { schoolId: school.value?.id ?? null } : {}),
    })
    readRoles(result.data)
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
              required
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
              :maxlength="500"
              placeholder="Tulis sesuatu tentang diri anda..."
              size="lg"
              class="w-full"
              data-testid="profile-bio-input"
            />
            <template #help>
              <!-- Static, as live: the counter never updates (FR-M01-39). -->
              <span data-testid="profile-bio-counter">Baki: 500 aksara</span>
            </template>
          </UFormField>

          <ProfileGradePicker
            v-model="grade"
            :secondary="secondary"
            @update:model-value="touched = true"
          />
        </div>
      </UCard>

      <UCard v-if="showSchool" data-testid="profile-school-card">
        <div class="flex flex-col gap-4">
          <h2 class="flex items-center gap-2 text-subheading text-highlighted">
            <UIcon name="i-ph-buildings" class="size-5" aria-hidden="true" />
            Maklumat Sekolah
          </h2>
          <p class="text-body text-muted">Pilih sekolah anda untuk sambung dengan rakan sekelas</p>
          <ProfileSchoolPicker v-model="school" @update:model-value="touched = true" />
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
