<script setup lang="ts">
/**
 * R1-MUR-A1 block 2 (FR-MUR-A1-4): card "Profil Awam Saya". The public URL as text, "Salin" copies it
 * (the label reads "Disalin!" for 2 s) and an icon button opens the public page in a new tab. When the
 * clipboard is blocked the URL text is selected and the line "Salin pautan secara manual." shows.
 */
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps<{
  /** The absolute public profile URL. */
  url: string
}>()

const COPIED_MS = 2000
const copied = ref(false)
const manual = ref(false)
const urlInput = ref<{ inputRef?: HTMLInputElement | null } | null>(null)
let timer: ReturnType<typeof setTimeout> | undefined

/** Clipboard blocked: select the URL so the pupil can copy it by hand. */
function selectUrl(): void {
  urlInput.value?.inputRef?.select()
}

async function copy(): Promise<void> {
  manual.value = false
  try {
    await navigator.clipboard.writeText(props.url)
  } catch {
    manual.value = true
    selectUrl()
    return
  }
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
  }, COPIED_MS)
}

onBeforeUnmount(() => {
  clearTimeout(timer)
})
</script>

<template>
  <UCard data-testid="profile-public-card">
    <div class="flex flex-col gap-3">
      <div>
        <h2 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-share-network" class="size-5" aria-hidden="true" />
          Profil Awam Saya
        </h2>
        <p class="text-caption text-muted">Kongsi profil anda dengan kawan-kawan!</p>
      </div>

      <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
        <UInput
          ref="urlInput"
          :model-value="url"
          readonly
          size="lg"
          class="min-w-0 flex-1"
          aria-label="Pautan profil awam"
          data-testid="profile-public-url"
        />
        <div class="flex items-center gap-2">
          <UButton
            color="primary"
            variant="soft"
            size="lg"
            :icon="copied ? 'i-ph-check' : 'i-ph-copy'"
            class="min-h-11"
            data-testid="profile-copy"
            @click="copy"
            >{{ copied ? 'Disalin!' : 'Salin' }}</UButton
          >
          <UButton
            :to="url"
            target="_blank"
            rel="noopener"
            color="neutral"
            variant="soft"
            size="lg"
            icon="i-ph-arrow-square-out"
            class="min-h-11 min-w-11"
            aria-label="Buka profil awam"
            data-testid="profile-open-public"
          />
        </div>
      </div>

      <p v-if="manual" class="text-caption text-warning" role="status" data-testid="profile-copy-manual">
        Salin pautan secara manual.
      </p>
    </div>
  </UCard>
</template>
