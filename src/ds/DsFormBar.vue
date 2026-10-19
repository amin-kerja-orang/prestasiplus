<script setup lang="ts">
/**
 * Sticky action bar of a form, on `DsPanel tone="bar"`. Right-aligned order: `extra`, Batal
 * (tonal), submit (primary, `type="submit"`, loading while `saving`). `status` sits on the left.
 * Batal is a link when `cancelTo` is set, otherwise it emits `cancel`.
 */
import type { RouteLocationRaw } from 'vue-router'

import { dsCopy } from './copy'
import DsPanel from './DsPanel.vue'
import { resolveIcon } from './icon'
import { usePersonality } from './personality'
import type { DsIconProp } from './types'

withDefaults(
  defineProps<{
    submitLabel?: string
    cancelLabel?: string
    cancelTo?: RouteLocationRaw
    saving?: boolean
    disabled?: boolean
    showCancel?: boolean
    sticky?: boolean
    /** Phosphor base name of the submit button icon. */
    submitIcon?: DsIconProp
  }>(),
  {
    submitLabel: dsCopy.save,
    cancelLabel: dsCopy.cancel,
    cancelTo: undefined,
    saving: false,
    disabled: false,
    showCancel: true,
    sticky: true,
    // Bundle hint until `floppy-disk` joins `ds-icons.ts`: i-ph-floppy-disk i-ph-floppy-disk-duotone
    submitIcon: 'floppy-disk',
  },
)

const personality = usePersonality()

const emit = defineEmits<{ cancel: [] }>()
</script>

<template>
  <DsPanel tone="bar" :sticky="sticky" data-ds="form-bar">
    <div class="flex flex-wrap items-center justify-end gap-3">
      <div v-if="$slots.status" class="mr-auto min-w-0 text-caption text-muted">
        <slot name="status" />
      </div>
      <slot name="extra" />
      <UButton
        v-if="showCancel"
        :to="cancelTo"
        :type="cancelTo ? undefined : 'button'"
        color="neutral"
        variant="soft"
        :label="cancelLabel"
        class="min-h-11"
        data-testid="form-cancel"
        @click="cancelTo ? undefined : emit('cancel')"
      />
      <slot name="submit">
        <UButton
          type="submit"
          variant="solid"
          :icon="resolveIcon(submitIcon, personality)"
          :label="submitLabel"
          :loading="saving"
          :disabled="saving || disabled"
          class="min-h-11"
          data-testid="form-submit"
        />
      </slot>
    </div>
  </DsPanel>
</template>
