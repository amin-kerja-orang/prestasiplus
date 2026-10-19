<script setup lang="ts">
/**
 * S18 player (URS FN-M09-6.3.3): the live embedded player, not auto-played. The `src` is the embed URL
 * the server derived (BR-M09-17) and is used only when its host is one of the three embeddable
 * providers; nothing else is ever put in an iframe and no markup is injected. Platforms without an
 * embed (TikTok, Facebook, other) show a plain link to the stored http(s) address.
 */
import { computed } from 'vue'
import { DsSurface } from '@/ds'

const props = defineProps<{ embedUrl: string | null; videoUrl: string; title: string }>()

const EMBED_HOSTS = new Set(['www.youtube.com', 'player.vimeo.com', 'www.dailymotion.com'])

function parse(value: string | null): URL | null {
  if (value === null) return null
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const embedSrc = computed(() => {
  const url = parse(props.embedUrl)
  return url && url.protocol === 'https:' && EMBED_HOSTS.has(url.hostname) ? url.href : null
})

const safeLink = computed(() => {
  const url = parse(props.videoUrl)
  return url && (url.protocol === 'http:' || url.protocol === 'https:') ? url.href : null
})
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    :data-embed-url="embedSrc ?? undefined"
    data-testid="video-player"
  >
    <DsSurface level="elevated" radius="card" padding="none" class="relative aspect-video w-full">
      <iframe
        v-if="embedSrc"
        :src="embedSrc"
        :title="title"
        class="absolute inset-0 size-full"
        loading="lazy"
        allow="
          accelerometer;
          clipboard-write;
          encrypted-media;
          gyroscope;
          picture-in-picture;
          web-share;
        "
        allowfullscreen
        referrerpolicy="strict-origin-when-cross-origin"
        data-testid="video-player-frame"
      ></iframe>
      <div v-else-if="safeLink" class="flex h-full items-center justify-center p-4">
        <UButton
          :to="safeLink"
          target="_blank"
          rel="noopener noreferrer"
          color="neutral"
          variant="soft"
          icon="i-ph-arrow-square-out-duotone"
          class="max-w-full break-all"
          data-testid="video-player-link"
          >{{ safeLink }}</UButton
        >
      </div>
    </DsSurface>
  </UCard>
</template>
