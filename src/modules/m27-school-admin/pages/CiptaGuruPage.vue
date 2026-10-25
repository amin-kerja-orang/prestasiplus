<script setup lang="ts">
/**
 * S11 `/admin-sekolah/guru/baru` "Cipta Pengguna" (SRS M27 Part B FR-M27-108 to 110; BR-M27-33). Card "Borang
 * Pendaftaran Pengguna", the read-only role "Guru", the locked school label (the session school), "Nama *", "Emel *",
 * "No. Telefon (Pilihan)", "Kata Laluan *" and "Sahkan Kata Laluan *", footer "Batal" / "Daftar Pengguna".
 *
 * The role, school and `isActive` are fixed by the server; the form sends none of them. A server
 * `VALIDATION_ERROR` shows in the alert above the form, keeps the values and clears the passwords. Success
 * queues the flash (the API `status`) and opens S7. No native validation, so the server's messages show.
 */
import { nextTick, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { isHttpMode } from '@/api/mode'
import { useFlash, useSession } from '@/composables'
import { DsFormBar, DsFormField, DsFormSection, DsPage, DsPanel } from '@/ds'

import { createSchoolTeacher, type CreatedCredential } from '../api/school-admin'
import LockedSchoolLabel from '../components/users/LockedSchoolLabel.vue'
import PupilCredentialBlock from '../components/users/PupilCredentialBlock.vue'
import { errorLines, newPasswordPlaceholder, TEACHER_LIST_PATH } from '../components/users/users-format'

const router = useRouter()
const flash = useFlash()
const { user: me } = useSession()

/** http mode: the server generates the password (D59b); no typed pair, and the credential is shown once. */
const http = isHttpMode()
const credential = ref<CreatedCredential | null>(null)
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
      ...(http
        ? {}
        : { password: form.password, passwordConfirmation: form.passwordConfirmation }),
    })
    flash.success(result.status)
    if (http && result.credential) {
      credential.value = result.credential
      return
    }
    await router.push(TEACHER_LIST_PATH)
  } catch (err) {
    errors.value = errorLines(err)
    form.password = ''
    form.passwordConfirmation = ''
    await nextTick()
    alertBox.value?.scrollIntoView?.({ block: 'center' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage class="max-w-4xl" data-testid="sg-create-page">
    <template v-if="credential">
      <PupilCredentialBlock :credential="credential" who="guru" />
      <div>
        <UButton
          :to="TEACHER_LIST_PATH"
          label="Ke Senarai Guru"
          icon="i-ph-arrow-right"
          class="min-h-11"
          data-testid="sg-credential-continue"
        />
      </div>
    </template>
    <form
      v-else
      method="post"
      novalidate
      class="flex min-w-0 flex-col gap-6"
      data-testid="user-form"
      @submit.prevent="submit"
    >
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

      <DsFormSection
        title="Borang Pendaftaran Pengguna"
        description="Isi maklumat untuk mendaftarkan pengguna baru"
        icon="user-plus"
        accent="action"
        :columns="2"
      >
        <DsFormField label="Peranan">
          <DsPanel tone="inset">
<div class="flex min-h-11 items-center">
            <p class="text-label text-highlighted" data-testid="user-role">Guru</p>
          </div>
</DsPanel>
        </DsFormField>

        <LockedSchoolLabel v-if="me?.school" :school="me.school" />

        <DsFormField label="Nama" required name="user-name">
          <UInput
            id="user-name"
            v-model="form.name"
            type="text"
            name="name"
            icon="i-ph-user"
            placeholder="Nama penuh"
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
            placeholder="contoh@email.com"
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
            inputmode="tel"
            icon="i-ph-phone"
            placeholder="Cth: 0191234567"
            class="w-full"
            data-testid="user-phone"
          />
        </DsFormField>

        <DsFormField v-if="!http" label="Kata Laluan" required name="user-password">
          <UInput
            id="user-password"
            v-model="form.password"
            type="password"
            name="password"
            autocomplete="new-password"
            icon="i-ph-lock-simple"
            :placeholder="newPasswordPlaceholder()"
            class="w-full"
            data-testid="user-password"
          />
        </DsFormField>

        <DsFormField v-if="!http" label="Sahkan Kata Laluan" required name="user-password-confirm">
          <UInput
            id="user-password-confirm"
            v-model="form.passwordConfirmation"
            type="password"
            name="password_confirmation"
            autocomplete="new-password"
            icon="i-ph-lock-simple"
            placeholder="Taip semula kata laluan"
            class="w-full"
            data-testid="user-password-confirm"
          />
        </DsFormField>
      </DsFormSection>

      <DsFormBar
        :cancel-to="TEACHER_LIST_PATH"
        submit-label="Daftar Pengguna"
        submit-icon="i-ph-user-plus"
        :saving="saving"
      />
    </form>
  </DsPage>
</template>
