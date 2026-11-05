<script setup lang="ts">
/**
 * S1 card "Link Jemputan" (L45 FR-L45-06..10, DV-L45-03/04). Read-only URL field plus "Salin",
 * "Hantar via WhatsApp" and "Jana Link Baru". The page owns the token and the regenerate request;
 * this card owns the copy feedback. "Salin" shows "Disalin!" for 2 s only after a successful clipboard
 * write (DV-L45-04); a blocked clipboard shows "Salin pautan secara manual." (R1-MUR-40). "Jana Link Baru" asks first (dialog
 * "Jana pautan baharu?"). The WhatsApp anchor keeps its `href` but the click does not navigate (D14,
 * DV-L45-03). No ARIA beyond native elements (D10, NFR-L45-02).
 */
import { computed, onBeforeUnmount, ref } from 'vue'

import { DsDialog, DsText } from '@/ds'

import { inviteUrl, whatsAppHref } from '../../lib/jemput'
import WhatsAppIcon from './WhatsAppIcon.vue'

const props = defineProps<{ token: string | null; regenerating: boolean }>()
const emit = defineEmits<{ regenerate: [] }>()

const COPIED_MS = 2000
const copied = ref(false)
/** R1-MUR-40: the clipboard is blocked, so the pupil is told to copy by hand. */
const copyFailed = ref(false)
const confirmOpen = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

// http mode, later visit: the server keeps only a hash, so there is no clear token to show (D58). Never
// build a URL from an absent token: the field stays empty and Salin / WhatsApp are disabled until
// "Jana Link Baru" issues one.
const url = computed(() => (props.token ? inviteUrl(props.token, window.location.origin) : ''))
const waHref = computed(() => (url.value ? whatsAppHref(url.value) : undefined))

async function copy(): Promise<void> {
  if (!url.value) return
  try {
    await navigator.clipboard.writeText(url.value)
  } catch {
    copyFailed.value = true // R1-MUR-40: clipboard unavailable or refused
    return
  }
  copyFailed.value = false
  copied.value = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
    timer = null
  }, COPIED_MS)
}

function confirmRegenerate(): void {
  confirmOpen.value = false
  emit('regenerate')
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
        :disabled="!url"
        :data-copied="copied ? 'true' : 'false'"
        data-testid="jemput-copy"
        @click="copy"
        >{{ copied ? 'Disalin!' : 'Salin' }}</UButton
      >
    </div>

    <div class="mt-3 flex flex-col gap-3 sm:flex-row">
      <UButton
        :to="waHref"
        :disabled="!url"
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
        @click="confirmOpen = true"
        >Jana Link Baru</UButton
      >
    </div>
    <DsText
      v-if="copyFailed"
      variant="label"
      tone="muted"
      role="status"
      data-testid="jemput-copy-failed"
    >
      Salin pautan secara manual.
    </DsText>

    <DsDialog v-model:open="confirmOpen" title="Jana pautan baharu?" data-testid="jemput-regen-modal">
      <DsText variant="body">
        Pautan lama tidak akan berfungsi lagi. Ibu bapa yang sudah dihubungkan kekal.
      </DsText>
      <template #footer>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          label="Batal"
          data-testid="jemput-regen-cancel"
          @click="confirmOpen = false"
        />
        <UButton
          type="button"
          label="Jana Baharu"
          data-testid="jemput-regen-confirm"
          @click="confirmRegenerate"
        />
      </template>
    </DsDialog>
  </section>
</template>
