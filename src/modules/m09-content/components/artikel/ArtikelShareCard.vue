<script setup lang="ts">
/**
 * S16 share card (FR-M09-35; URS FN-M09-2.3.6). WhatsApp / Facebook / Twitter open in a new tab;
 * the link button writes `location.href` to the clipboard and shows "Link Disalin!" for 2000 ms.
 * Brand glyphs: the shared WhatsApp icon and the simple-icons Facebook / Twitter glyphs
 * (design-system §6.9). No ARIA beyond live (D10).
 */
import { computed, onBeforeUnmount, ref } from 'vue'

import { ARTIKEL_COPY, shareLinks } from '../../lib/artikel/artikel'
import WhatsAppIcon from '../icons/WhatsAppIcon.vue'
import ShareBrandIcon from './ShareBrandIcon.vue'
import { DsCluster, DsStack, DsHeading, DsText } from '@/ds'

const props = defineProps<{ title: string }>()

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | null = null

const links = computed(() => shareLinks(props.title, window.location.href))

async function copyLink(): Promise<void> {
  try {
    await navigator.clipboard.writeText(window.location.href)
  } catch {
    // Clipboard unavailable (insecure context): the confirmation is still shown, as live does.
  }
  copied.value = true
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
    timer = null
  }, 2000)
}

onBeforeUnmount(() => {
  if (timer !== null) clearTimeout(timer)
})
</script>

<template>
  <UCard data-testid="artikel-share">
    <DsStack gap="sm" align="center" class="text-center">
      <DsHeading :level="2" variant="subheading">{{ ARTIKEL_COPY.shareTitle }}</DsHeading>
      <DsText variant="label" as="p" tone="muted" class="max-w-prose">{{
        ARTIKEL_COPY.shareBody
      }}</DsText>
      <DsCluster justify="center">
        <UButton
          :to="links.whatsapp"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="soft"
          size="xl"
          data-testid="share-whatsapp"
        >
          <WhatsAppIcon class="size-5" />
        </UButton>
        <UButton
          :to="links.facebook"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="soft"
          size="xl"
          data-testid="share-facebook"
        >
          <ShareBrandIcon name="facebook" class="size-5" />
        </UButton>
        <UButton
          :to="links.twitter"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="soft"
          size="xl"
          data-testid="share-twitter"
        >
          <ShareBrandIcon name="twitter" class="size-5" />
        </UButton>
        <UButton
          color="neutral"
          variant="soft"
          size="xl"
          icon="i-ph-link-duotone"
          data-testid="share-copy"
          @click="copyLink"
        />
      </DsCluster>
      <DsText
        v-if="copied"
        variant="label"
        as="p"
        tone="highlighted"
        role="status"
        data-testid="share-copied"
      >
        {{ ARTIKEL_COPY.copied }}
      </DsText>
    </DsStack>
  </UCard>
</template>
