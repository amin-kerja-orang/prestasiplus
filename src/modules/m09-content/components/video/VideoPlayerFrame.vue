<script setup lang="ts">
/**
 * S18 player (URS FN-M09-6.3.3): the live embedded player, not auto-played. The `src` is the embed URL
 * the server derived (BR-M09-17) and is used only when its host is one of the three embeddable
 * providers; nothing else is ever put in an iframe and no markup is injected. Platforms without an
 * embed (TikTok, Facebook, other) show a plain link to the stored http(s) address.
 */
import { ExternalLink } from '@lucide/vue'
import { computed } from 'vue'

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
  <div
    class="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-900 shadow"
    :data-embed-url="embedSrc ?? undefined"
    data-testid="video-player"
  >
    <iframe
      v-if="embedSrc"
      :src="embedSrc"
      :title="title"
      class="absolute inset-0 h-full w-full border-0"
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
      <a
        :href="safeLink"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold break-all text-white hover:bg-white/20"
        data-testid="video-player-link"
      >
        <ExternalLink class="h-4 w-4 shrink-0" aria-hidden="true" />
        {{ safeLink }}
      </a>
    </div>
  </div>
</template>
