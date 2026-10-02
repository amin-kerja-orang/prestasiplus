<script setup lang="ts">
/**
 * Video thumbnail (URS FN-M09-6.1.6). Only the live thumbnail URL of the row is used (YouTube
 * `hqdefault`, Dailymotion). When the row has none (Vimeo, TikTok, Facebook) or the image fails to
 * load (live `onerror`), the frame stays empty: no icon or image of our own is drawn. The URL is
 * also kept in `data-thumbnail-url`.
 */
import { ref, watch } from 'vue'

const props = defineProps<{ thumbnailUrl: string | null }>()

const failed = ref(false)
watch(
  () => props.thumbnailUrl,
  () => {
    failed.value = false
  },
)

const isHttps = (url: string | null): url is string => url !== null && /^https:\/\//.test(url)
</script>

<template>
  <div
    class="h-full w-full bg-slate-200"
    :data-thumbnail-url="thumbnailUrl ?? undefined"
    data-testid="video-thumb"
  >
    <img
      v-if="isHttps(thumbnailUrl) && !failed"
      :src="thumbnailUrl"
      alt=""
      loading="lazy"
      referrerpolicy="no-referrer"
      class="h-full w-full object-cover"
      @error="failed = true"
    />
  </div>
</template>
