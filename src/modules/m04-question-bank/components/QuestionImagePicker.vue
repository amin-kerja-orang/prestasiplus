<script setup lang="ts">
/**
 * Image picker of S2 / S4 (FR-M04-20, 51; FN-M04-1.2.6, 1.2.7, 1.7.5): the question image as an upload
 * zone and the option images as a small "Gambar" button. A chosen file shows a FileReader preview with
 * a remove button that clears the input; the prompt returns after removal. On S4 the saved image is the
 * preview until removed or replaced (INFERRED); a `blob:mock/...` placeholder is shown as a neutral
 * image. The zone reads "Tukar gambar" once a new file is chosen on S4. Type and size are checked by the
 * server only (accept list as live).
 */
import { computed, ref, watch } from 'vue'

import { DsArt3D, DsFileField, DsStack, DsCluster, DsText } from '@/ds'

import { imageSrc } from '../lib/image-url'

const props = withDefaults(
  defineProps<{
    variant: 'zone' | 'chip'
    /** The saved image (S4). */
    saved?: string | null
    edit?: boolean
    testid: string
  }>(),
  { saved: null, edit: false },
)

const file = defineModel<File | null>('file', { required: true })
const removed = defineModel<boolean>('removed', { default: false })

const preview = ref<string | null>(null)

watch(
  file,
  (next) => {
    if (next === null) {
      preview.value = null
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (file.value === next && typeof reader.result === 'string') preview.value = reader.result
    }
    reader.readAsDataURL(next)
  },
  { immediate: true },
)

const hasSaved = computed(() => props.saved !== null && props.saved !== '' && !removed.value)
const shown = computed(() => (file.value !== null ? 'new' : hasSaved.value ? 'saved' : 'none'))

/** The field clears the native input itself when the model returns to `null`. */
function onPick(next: File | File[] | null): void {
  const picked = Array.isArray(next) ? (next[0] ?? null) : next
  file.value = picked
  if (picked) removed.value = false
}

function remove(): void {
  if (file.value !== null) {
    // Clears the pending file; a saved image underneath shows again.
    file.value = null
    preview.value = null
  } else if (hasSaved.value) {
    removed.value = true
  }
}

const zoneText = computed(() =>
  props.edit && file.value !== null ? 'Tukar gambar' : 'Klik untuk muat naik gambar',
)
const hideZoneText = computed(() => !props.edit && shown.value === 'new')
</script>

<template>
  <DsStack gap="xs" :data-testid="testid">
    <!-- The upload control: a button around the (screen-reader only) file input of the field. -->
    <DsCluster>
      <DsFileField
        :model-value="file"
        accept="image/jpeg,image/png,image/webp"
        preview="none"
        :data-testid="`${testid}-input`"
        @update:model-value="onPick"
      >
        <template #default="{ open }">
          <UButton type="button" color="neutral" variant="soft" class="min-h-11" @click="open()">
            <UIcon
              :name="variant === 'zone' ? 'i-ph-cloud-arrow-up' : 'i-ph-image'"
              class="size-5"
            />
            <span v-if="variant === 'chip'">Gambar</span>
            <span v-else-if="!hideZoneText" :data-testid="`${testid}-text`">{{ zoneText }}</span>
            <span v-else>Tukar gambar</span>
          </UButton>
        </template>
      </DsFileField>
      <DsText v-if="variant === 'zone' && !(edit && file !== null)" variant="caption" as="span">
        JPG, PNG, WebP — Maks 2MB
      </DsText>
    </DsCluster>

    <DsCluster v-if="shown !== 'none'" gap="xs" align="start" :wrap="false">
      <div class="w-40 min-w-0 sm:w-56">
        <DsArt3D
          v-if="shown === 'new' && preview"
          variant="plain"
          :src="preview"
          alt=""
          :data-testid="`${testid}-preview`"
        />
        <DsArt3D
          v-else-if="shown === 'saved' && saved"
          variant="plain"
          :src="imageSrc(saved ?? '')"
          alt=""
          :data-testid="`${testid}-preview`"
        />
        <span
          v-else
          class="inline-grid size-16 place-items-center bg-elevated"
          :data-testid="`${testid}-preview`"
        >
          <UIcon name="i-ph-image" class="size-6 text-dimmed" />
        </span>
      </div>
      <UButton
        type="button"
        color="error"
        variant="soft"
        icon="i-ph-x"
        aria-label="Buang gambar"
        class="size-11 shrink-0 justify-center"
        :data-testid="`${testid}-remove`"
        @click.prevent.stop="remove"
      />
    </DsCluster>
  </DsStack>
</template>
