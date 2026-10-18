<script setup lang="ts">
/**
 * S1 card "Link Jemputan" (L45 FR-L45-06..10, DV-L45-03/04). Read-only URL field plus "Salin",
 * "Hantar via WhatsApp" and "Jana Link Baru". The page owns the token and the regenerate request;
 * this card owns the copy feedback. "Salin" shows "Disalin!" for 2 s only after a successful clipboard
 * write (DV-L45-04). The WhatsApp anchor keeps its `href` but the click does not navigate (D14,
 * DV-L45-03). No ARIA beyond native elements (D10, NFR-L45-02).
 */
import { computed, onBeforeUnmount, ref } from 'vue'

import { inviteUrl, whatsAppHref } from '../../lib/jemput'
import WhatsAppIcon from './WhatsAppIcon.vue'

const props = defineProps<{ token: string; regenerating: boolean }>()
const emit = defineEmits<{ regenerate: [] }>()

const COPIED_MS = 2000
const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const url = computed(() => inviteUrl(props.token, window.location.origin))
const waHref = computed(() => whatsAppHref(url.value))

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(url.value)
  } catch {
    return // FR-L45-08: clipboard unavailable or refused, no change and no message
  }
  copied.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
    timer = null
  }, COPIED_MS)
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})
</script>

<template>
  <section class="rounded-card bg-default p-5 shadow-lift sm:p-6" data-testid="jemput-link-card">
    <h2 class="flex items-center gap-2 text-heading text-highlighted">
      <UIcon name="i-ph-link-duotone" class="size-5 text-primary-t" aria-hidden="true" />
      Link Jemputan
    </h2>
    <p class="mt-2 text-body text-muted">
      Salin link ini dan hantar kepada ibu bapa anda melalui WhatsApp atau mesej.
    </p>

    <div class="mt-4 flex items-stretch gap-2">
      <UInput
        type="text"
        readonly
        :model-value="url"
        size="xl"
        class="min-w-0 flex-1"
        :ui="{ base: 'font-mono' }"
        data-testid="jemput-url"
      />
      <UButton
        type="button"
        size="xl"
        :color="copied ? 'success' : 'primary'"
        :icon="copied ? 'i-ph-check-bold' : 'i-ph-copy-duotone'"
        class="shrink-0 justify-center"
        :data-copied="copied ? 'true' : 'false'"
        data-testid="jemput-copy"
        @click="copy"
        >{{ copied ? 'Disalin!' : 'Salin' }}</UButton
      >
    </div>

    <div class="mt-3 flex flex-col gap-3 sm:flex-row">
      <UButton
        :to="waHref"
        target="_blank"
        rel="noopener noreferrer"
        size="xl"
        color="neutral"
        variant="soft"
        class="justify-center sm:flex-1"
        data-testid="jemput-whatsapp"
        @click.prevent
      >
        <WhatsAppIcon class="size-5" />
        Hantar via WhatsApp
      </UButton>
      <UButton
        type="button"
        size="xl"
        color="neutral"
        variant="soft"
        icon="i-ph-arrows-clockwise-duotone"
        class="justify-center"
        :disabled="regenerating"
        :loading="regenerating"
        data-testid="jemput-regenerate"
        @click="emit('regenerate')"
        >Jana Link Baru</UButton
      >
    </div>
  </section>
</template>
