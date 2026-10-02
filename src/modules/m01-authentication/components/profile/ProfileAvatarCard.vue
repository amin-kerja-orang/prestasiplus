<script setup lang="ts">
/**
 * S8 "Gambar Profil" card (FR-M01-41, BR-15). Choosing a file only previews it (FileReader) and
 * shows "Simpan"; nothing is sent until "Simpan" posts `POST /api/me/picture`. No client-side type
 * or size check beyond `accept` (the server answers with the red alert). The page owns the flash.
 */
import { Camera, Check, Upload } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { LoadingSpinner } from '@/components/feedback'
import { useFlash } from '@/composables/useFlash'
import { avatarSrc } from '@/shells/shared/avatar'

import { uploadPicture } from '../../api'
import { errorLines } from '../../lib/error-lines'
import { PROFILE_BUTTON_CLASS, PROFILE_CARD_CLASS, PROFILE_CARD_TITLE_CLASS } from './classes'

const props = defineProps<{ name: string; avatarUrl: string | null }>()
const emit = defineEmits<{
  /** The picture was saved; `status` is the flash text. */
  saved: [status: string]
  failed: [lines: string[]]
}>()

const flash = useFlash()
const fileInput = ref<HTMLInputElement | null>(null)
const file = ref<File | null>(null)
const preview = ref<string | null>(null)
const saving = ref(false)

const shown = computed(
  () => preview.value ?? avatarSrc({ name: props.name, avatarUrl: props.avatarUrl }),
)

function onChange(event: Event): void {
  const chosen = (event.target as HTMLInputElement).files?.[0] ?? null
  file.value = chosen
  if (!chosen) {
    preview.value = null
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    if (file.value === chosen && typeof reader.result === 'string') preview.value = reader.result
  }
  reader.readAsDataURL(chosen)
}

/** The preview stays until the saved `avatarUrl` arrives (no flicker back to the old image). */
watch(
  () => props.avatarUrl,
  () => {
    preview.value = null
  },
)

function reset(): void {
  file.value = null
  if (fileInput.value) fileInput.value.value = ''
}

async function submit(): Promise<void> {
  if (!file.value) return
  saving.value = true
  flash.clear()
  try {
    const result = await uploadPicture(file.value)
    reset()
    emit('saved', result.status)
  } catch (err) {
    emit('failed', errorLines(err))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <form
    :class="PROFILE_CARD_CLASS"
    enctype="multipart/form-data"
    data-testid="picture-form"
    @submit.prevent="submit"
  >
    <h2 :class="PROFILE_CARD_TITLE_CLASS">
      <Camera class="h-5 w-5 text-indigo-500" />
      Gambar Profil
    </h2>

    <div class="flex flex-wrap items-center gap-4 sm:gap-6">
      <div class="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl">
        <img
          :src="shown"
          alt="Avatar"
          class="h-full w-full object-cover"
          data-testid="picture-preview"
        />
        <!-- Hover overlay: a label for the hidden file input (decorative duplicate of "Pilih Gambar"). -->
        <label
          for="profilePicInput"
          class="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"
          data-testid="picture-overlay"
        >
          <Camera class="h-6 w-6" />
        </label>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <label
            for="profilePicInput"
            class="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100"
            data-testid="picture-choose"
          >
            <Upload class="h-4 w-4" />
            Pilih Gambar
            <input
              id="profilePicInput"
              ref="fileInput"
              type="file"
              name="profile_picture"
              accept="image/jpeg,image/png,image/webp"
              class="hidden"
              data-testid="picture-input"
              @change="onChange"
            />
          </label>
          <button
            v-show="file"
            type="submit"
            :disabled="saving"
            :class="[PROFILE_BUTTON_CLASS, 'bg-save-gradient']"
            data-testid="picture-save"
          >
            <LoadingSpinner v-if="saving" />
            <Check v-else class="h-4 w-4" />
            Simpan
          </button>
        </div>
        <p class="mt-2 text-xs text-slate-500">JPG, PNG atau WEBP. Maks 2MB.</p>
      </div>
    </div>
  </form>
</template>
