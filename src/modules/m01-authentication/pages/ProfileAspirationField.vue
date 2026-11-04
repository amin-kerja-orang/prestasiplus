<script setup lang="ts">
/**
 * R1-MUR-A1 field "Cita-Cita Saya" (FR-MUR-A1-3, FR-MUR-A1-10): text, placeholder "cth: Doktor, Jurutera, Saintis
 * Data...", max 255, never on the public page.
 *
 * NOT WIRED AND NOT RENDERED YET (S5-T05 part B): the column `users.aspiration` waits for S0's migration 0184
 * (DM-80), and `PUT /api/me` has no `aspiration` key until then. When the column and the contract key exist,
 * render this field in the "Kemaskini Profil" form of `ProfilePage.vue` and send `{bio, aspiration}`.
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
