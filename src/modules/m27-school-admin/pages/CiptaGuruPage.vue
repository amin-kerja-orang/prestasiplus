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

import { useFlash, useSession } from '@/composables'
import { DsPage } from '@/ds'

import { createSchoolTeacher } from '../api/school-admin'
import LockedSchoolLabel from '../components/users/LockedSchoolLabel.vue'
import { errorLines, TEACHER_LIST_PATH } from '../components/users/users-format'

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
  <DsPage class="max-w-4xl" data-testid="sg-create-page">
    <form method="post" novalidate data-testid="user-form" @submit.prevent="submit">
      <UCard>
        <div class="mb-4 flex items-center gap-3">
          <UIcon name="i-ph-user-plus-duotone" class="size-8 shrink-0 text-primary" aria-hidden="true" />
          <div class="min-w-0">
            <h2 class="text-subheading text-highlighted">Borang Pendaftaran Pengguna</h2>
            <p class="text-body text-muted">Isi maklumat untuk mendaftarkan pengguna baru</p>
          </div>
        </div>

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

        <div class="grid grid-cols-1 gap-x-6 gap-y-6 md:grid-cols-2">
          <UFormField label="Peranan">
            <UCard variant="soft" :ui="{ body: 'flex min-h-11 items-center p-3 sm:p-3' }">
              <p class="text-label text-highlighted" data-testid="user-role">Guru</p>
            </UCard>
          </UFormField>

          <LockedSchoolLabel v-if="me?.school" :school="me.school" />

          <UFormField label="Nama *" name="user-name">
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
          </UFormField>

          <UFormField label="Emel *" name="user-email">
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
          </UFormField>

          <UFormField label="No. Telefon (Pilihan)" name="user-phone">
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
          </UFormField>

          <UFormField label="Kata Laluan *" name="user-password">
            <UInput
              id="user-password"
              v-model="form.password"
              type="password"
              name="password"
              autocomplete="new-password"
              icon="i-ph-lock-simple"
              placeholder="Minimum 6 aksara"
              class="w-full"
              data-testid="user-password"
            />
          </UFormField>

          <UFormField label="Sahkan Kata Laluan *" name="user-password-confirm">
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
          </UFormField>
        </div>

        <div
          class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="user-form-footer"
        >
          <UButton
            :to="TEACHER_LIST_PATH"
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
            >Daftar Pengguna</UButton
          >
        </div>
      </UCard>
    </form>
  </DsPage>
</template>
