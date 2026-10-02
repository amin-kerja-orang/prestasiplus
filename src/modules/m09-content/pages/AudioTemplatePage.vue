<script setup lang="ts">
/**
 * `/admin/audio-kbat/template` and `/admin/audio-kbat/template-word` (FN-M09-5.1.3, OQ-M09-03): live
 * answers these URLs with a file and leaves the page where it was. Opened directly (a modified
 * click, a typed address), the route downloads the placeholder file and returns to S12.
 */
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { alertNative } from '@/composables'

import { COPY, AUDIO_PATH } from '../lib/admin-media/common'
import { downloadAudioTemplate } from '../lib/admin-media/template-download'

const props = defineProps<{ format: 'xlsx' | 'docx' }>()

const router = useRouter()

onMounted(async () => {
  try {
    await downloadAudioTemplate(props.format)
  } catch {
    alertNative(COPY.genericError)
  }
  await router.replace(AUDIO_PATH)
})
</script>

<template>
  <div data-testid="audio-template-page"></div>
</template>
