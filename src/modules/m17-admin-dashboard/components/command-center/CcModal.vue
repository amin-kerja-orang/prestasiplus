<script setup lang="ts">
/**
 * Dark modal of the S7 drill (`#weekModal`, `#sessionModal`): a click on x or the backdrop closes it
 * (FR-M17-56), Esc too through the shared F-15 modal. The session modal opens above the sessions modal
 * (`stacked`). Full width minus 16 px gutters on mobile (SRS §10).
 */
import { BaseModal } from '@/components/overlay'

defineProps<{ title: string; subtitle?: string; stacked?: boolean; testid: string }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <BaseModal
    :open="true"
    :container-class="`fixed inset-0 ${stacked ? 'z-[70]' : 'z-[60]'} flex items-center justify-center p-4`"
    backdrop-class="absolute inset-0 bg-black/70"
    panel-class="relative max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-200 shadow-2xl md:p-6"
    :close-on-esc="false"
    :data-testid="testid"
    @close="$emit('close')"
  >
    <template #default="{ close }">
      <button
        type="button"
        class="absolute top-2 right-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-xl text-slate-400 hover:bg-slate-700 hover:text-slate-100"
        data-testid="cc-modal-close"
        @click="close"
      >
        &times;
      </button>
      <h3 class="pr-10 text-lg font-bold break-words text-slate-50" data-testid="cc-modal-title">
        {{ title }}
      </h3>
      <p v-if="subtitle" class="mt-1 text-sm text-slate-400" data-testid="cc-modal-subtitle">
        {{ subtitle }}
      </p>
      <div class="mt-4">
        <slot />
      </div>
    </template>
  </BaseModal>
</template>
