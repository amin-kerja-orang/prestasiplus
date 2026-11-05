<script setup lang="ts">
/**
 * R1-MUR-A1 field "Cita-Cita Saya" (FR-MUR-A1-3, FR-MUR-A1-10): text, placeholder "cth: Doktor, Jurutera, Saintis
 * Data...", max 255, never on the public page.
 *
 * Rendered in the "Kemaskini Profil" form of `ProfilePage.vue` (pupil); saved with `PUT /api/me {bio, aspiration}`
 * (column `users.aspiration`, migration 0184, DM-80).
 */
import { computed } from 'vue'

const ASPIRATION_MAX = 255
const ASPIRATION_TOO_LONG = 'Cita-cita tidak boleh melebihi 255 aksara.'

const model = defineModel<string>({ default: '' })

const tooLong = computed(() => model.value.length > ASPIRATION_MAX)
</script>

<template>
  <UFormField label="Cita-Cita Saya" :error="tooLong ? ASPIRATION_TOO_LONG : undefined">
    <UInput
      v-model="model"
      type="text"
      name="aspiration"
      placeholder="cth: Doktor, Jurutera, Saintis Data..."
      size="lg"
      class="w-full"
      data-testid="profile-aspiration-input"
    />
  </UFormField>
</template>
