<script setup lang="ts">
/**
 * "Template XLSX" / "Template Word" (S12 header buttons, S13 guide box; FN-M09-5.1.3, 5.2.2). The
 * `href` is the live download path; a plain click fetches the placeholder file through the API and
 * saves it without leaving the page (OQ-M09-03). Modified clicks fall through to the route of the
 * same path, which downloads and returns to S12.
 * On S13 the live links render near-white on a pale box and cannot be read; here they are ordinary
 * buttons (DV-M09-20).
 */
import { alertNative } from '@/composables'

import { downloadAudioTemplate } from '../../lib/admin-media/template-download'
import { AUDIO_TEMPLATE_PATH, AUDIO_TEMPLATE_WORD_PATH, COPY } from '../../lib/admin-media/common'

const props = defineProps<{ kind: 'xlsx' | 'word' }>()

const href = props.kind === 'xlsx' ? AUDIO_TEMPLATE_PATH : AUDIO_TEMPLATE_WORD_PATH

async function onClick(event: MouseEvent): Promise<void> {
  if (event.defaultPrevented || event.button !== 0) return
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  try {
    await downloadAudioTemplate(props.kind === 'xlsx' ? 'xlsx' : 'docx')
  } catch {
    alertNative(COPY.genericError)
  }
}
</script>

<template>
  <UButton
    :href="href"
    color="neutral"
    variant="soft"
    size="md"
    class="min-h-11"
    :icon="kind === 'xlsx' ? 'i-ph-file-xls' : 'i-ph-file-doc'"
    :label="kind === 'xlsx' ? 'Template XLSX' : 'Template Word'"
    :data-testid="kind === 'xlsx' ? 'template-xlsx' : 'template-word'"
    @click="onClick"
  />
</template>
