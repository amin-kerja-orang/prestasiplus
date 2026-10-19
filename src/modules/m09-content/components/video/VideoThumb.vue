<script setup lang="ts">
/**
 * Video thumbnail (URS FN-M09-6.1.6). Only the live thumbnail URL of the row is used (YouTube
 * `hqdefault`, Dailymotion). When the row has none (Vimeo, TikTok, Facebook) the frame stays
 * empty on the elevated surface. The URL is also kept in `data-thumbnail-url`. The image is the
 * DS plain art (no raw `<img>`).
 */
import { DsArt3D } from '@/ds'

defineProps<{ thumbnailUrl: string | null }>()

const isHttps = (url: string | null): url is string => url !== null && /^https:\/\//.test(url)
</script>

<template>
  <div
    class="size-full overflow-hidden bg-elevated"
    :data-thumbnail-url="thumbnailUrl ?? undefined"
    data-testid="video-thumb"
  >
    <DsArt3D v-if="isHttps(thumbnailUrl)" variant="plain" :src="thumbnailUrl" class="size-full" />
  </div>
</template>
