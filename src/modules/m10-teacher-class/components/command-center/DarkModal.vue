<script setup lang="ts">
/**
 * Dark modal of S2 (`#drillModal` and the five modals of the top bar; FR-M10-19): "×" or the backdrop
 * closes it (not Esc, as the M17 Command Center modals: a stacked holders modal would close both). Full width minus 16 px gutters on mobile (SRS §10). D10: no dialog
 * role, focus trap or scroll lock.
 */
import { BaseModal } from '@/components/overlay'

defineProps<{ title: string; testid: string; stacked?: boolean; wide?: boolean }>()
defineEmits<{ close: [] }>()
</script>

<template>
  <BaseModal
    :open="true"
    :container-class="`fixed inset-0 ${stacked ? 'z-[70]' : 'z-[60]'} flex items-center justify-center p-4`"
    backdrop-class="absolute inset-0 bg-black/70 backdrop-blur-sm"
    :panel-class="`relative max-h-[90vh] w-full ${wide ? 'max-w-5xl' : 'max-w-3xl'} overflow-y-auto rounded-2xl border border-slate-700 bg-slate-800 p-4 text-slate-200 shadow-2xl md:p-6`"
    :close-on-esc="false"
    :data-testid="testid"
    @close="$emit('close')"
  >
    <template #default="{ close }">
      <button
        type="button"
        class="absolute top-2 right-2 inline-flex h-11 w-11 items-center justify-center rounded-lg text-2xl text-slate-400 hover:bg-slate-700 hover:text-slate-100"
        data-testid="cc-modal-close"
        @click="close"
      >
        &times;
      </button>
      <h3 class="pr-10 text-lg font-bold break-words text-slate-50" data-testid="cc-modal-title">
        {{ title }}
      </h3>
      <div class="mt-4 min-w-0">
        <slot />
      </div>
    </template>
  </BaseModal>
</template>
