<script setup lang="ts">
/**
 * S8 "Gambar Profil" card (FR-M01-41, BR-15). Choosing a file only previews it (FileReader) and
 * shows "Simpan"; nothing is sent until "Simpan" posts `POST /api/me/picture`. No client-side type
 * or size check beyond `accept` (the server answers with the red alert). The page owns the flash.
 */
import { computed, ref, watch } from 'vue'

import { useFlash } from '@/composables/useFlash'

import { uploadPicture } from '../../api'
import { errorLines } from '../../lib/error-lines'
import { DsCluster, DsStack, DsText } from '@/ds'

const props = defineProps<{ name: string; avatarUrl: string | null }>()
const emit = defineEmits<{
  /** The picture was saved; `status` is the flash text. */
  saved: [status: string]
  failed: [lines: string[]]
}>()

const flash = useFlash()
const file = ref<File | null>(null)
const preview = ref<string | null>(null)
const saving = ref(false)

const shown = computed(() => preview.value ?? props.avatarUrl ?? undefined)

// Clearing the file (after a save) keeps the preview; only a new saved avatarUrl resets it.
watch(file, (chosen) => {
  if (!chosen) return
  const reader = new FileReader()
  reader.onload = () => {
    if (file.value === chosen && typeof reader.result === 'string') preview.value = reader.result
  }
  reader.readAsDataURL(chosen)
})

/** The preview stays until the saved `avatarUrl` arrives (no flicker back to the old image). */
watch(
  () => props.avatarUrl,
  () => {
    preview.value = null
  },
)

async function submit(): Promise<void> {
  if (!file.value) return
  saving.value = true
  flash.clear()
  try {
    const result = await uploadPicture(file.value)
    file.value = null
    emit('saved', result.status)
  } catch (err) {
    emit('failed', errorLines(err))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard>
    <DsStack data-testid="picture-form" as="form" @submit.prevent="submit">
      <h2 class="flex items-center gap-2 text-subheading text-highlighted">
        <UIcon name="i-ph-camera" class="size-5" aria-hidden="true" />
        Gambar Profil
      </h2>

      <div class="flex flex-wrap items-center gap-4 sm:gap-6">
        <UAvatar
          :src="shown"
          :alt="shown ? 'Avatar' : name"
          size="3xl"
          data-testid="picture-preview"
        />

        <div class="flex min-w-0 flex-1 flex-col gap-2">
          <DsCluster gap="xs">
            <UFileUpload
              v-model="file"
              variant="button"
              :preview="false"
              label="Pilih Gambar"
              icon="i-ph-upload-simple"
              accept="image/jpeg,image/png,image/webp"
              name="profile_picture"
              color="primary"
              size="lg"
              class="w-auto"
              data-testid="picture-input"
            />
            <UButton
              v-if="file"
              type="submit"
              color="primary"
              size="lg"
              icon="i-ph-check"
              :loading="saving"
              :disabled="saving"
              data-testid="picture-save"
              >Simpan</UButton
            >
          </DsCluster>
          <DsText variant="caption">JPG, PNG atau WEBP. Maks 2MB.</DsText>
        </div>
      </div>
    </DsStack>
  </UCard>
</template>
