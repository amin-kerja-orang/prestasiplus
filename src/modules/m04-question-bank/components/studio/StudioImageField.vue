<script setup lang="ts">
/**
 * One picture of the Studio (stem, option or stimulus). A chosen file is uploaded at once through the files module
 * (`purpose=question_image`, JPG/PNG/WebP, max 2MB; the server checks type and size) and the model holds the public token the
 * question then carries. A refusal is shown under the picture and the model keeps its old value.
 */
import { ref } from 'vue'

import { isApiError } from '@/api'
import { DsArt3D, DsCluster, DsFileField, DsStack, DsText } from '@/ds'

import { uploadStudioImage } from '../../api/studio'
import { imageSrc } from '../../lib/image-url'

const props = withDefaults(defineProps<{ testid: string; label?: string; disabled?: boolean }>(), { label: 'Gambar', disabled: false })
const token = defineModel<string | null>({ required: true })

const busy = ref(false)
const error = ref('')
const picked = ref<File | null>(null)

async function onPick(next: File | File[] | null): Promise<void> {
  const file = Array.isArray(next) ? (next[0] ?? null) : next
  picked.value = null
  if (file === null) return
  busy.value = true
  error.value = ''
  try {
    token.value = await uploadStudioImage(file, props.testid)
  } catch (err) {
    error.value = isApiError(err) ? (err.fields?.[props.testid] ?? err.message) : 'Gambar gagal dimuat naik.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsStack gap="sm" :data-testid="testid">
    <DsCluster gap="sm">
      <DsFileField
        :model-value="picked"
        accept="image/jpeg,image/png,image/webp"
        preview="none"
        variant="button"
        :label="label"
        :disabled="disabled || busy"
        :data-testid="`${testid}-input`"
        @update:model-value="onPick"
      />
      <DsText v-if="busy" variant="caption" tone="muted" :data-testid="`${testid}-busy`">Memuat naik…</DsText>
      <UButton
        v-if="token !== null && !disabled"
        type="button"
        color="error"
        variant="soft"
        :data-testid="`${testid}-remove`"
        @click="token = null"
      >
        Buang gambar
      </UButton>
    </DsCluster>
    <DsArt3D v-if="token !== null" variant="plain" :src="imageSrc(token)" alt="" :data-testid="`${testid}-preview`" />
    <DsText v-if="error" variant="caption" tone="error" role="alert" :data-testid="`${testid}-error`">{{ error }}</DsText>
  </DsStack>
</template>
