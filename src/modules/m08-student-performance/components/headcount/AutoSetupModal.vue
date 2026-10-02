<script setup lang="ts">
/**
 * S12 Auto-Setup modal (FR-M08-77…80, BR-M08-21). Opening resets the selection; "Batal", the backdrop and
 * Esc only hide it (the ticks stay until the next opening). The submit is disabled until a level is ticked;
 * on success the modal closes and the page reloads its list without a message (PROPOSED, UNVERIFIED L-4).
 */
import { WandSparkles } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { isApiError } from '@/api'
import { AlertBox } from '@/components/feedback'
import { BaseModal } from '@/components/overlay'

import { autoSetupHeadcounts } from '../../api/headcount'
import { DARJAH_LEVELS, TINGKATAN_LEVELS } from '../../lib/headcount/format'
import { LOAD_ERROR } from '../../lib/prestasi/load'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ done: [] }>()

const selected = ref<(number | string)[]>([])
const submitting = ref(false)
const error = ref<string | null>(null)

watch(open, (isOpen) => {
  if (isOpen) {
    selected.value = []
    error.value = null
  }
})

const count = computed(() => selected.value.length)

async function submit() {
  if (count.value === 0 || submitting.value) return
  submitting.value = true
  error.value = null
  try {
    await autoSetupHeadcounts({ levels: [...selected.value] })
    open.value = false
    emit('done')
  } catch (err) {
    error.value = isApiError(err) && err.message !== '' ? err.message : LOAD_ERROR
  } finally {
    submitting.value = false
  }
}

const OFF = 'border-slate-200 bg-white text-slate-600'
const LABEL =
  'flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-3 text-sm font-semibold transition'
</script>

<template>
  <BaseModal
    v-model:open="open"
    container-class="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4"
    backdrop-class="absolute inset-0 bg-black/50"
    panel-class="relative bg-white rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto"
    data-testid="auto-setup-modal"
  >
    <template #default="{ close }">
      <div class="flex items-center gap-3">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"
        >
          <WandSparkles class="h-6 w-6" />
        </span>
        <div class="min-w-0">
          <h3 class="font-heading text-lg font-bold text-slate-800">Auto-Setup Headcount</h3>
          <p class="text-sm text-slate-500">Pilih tingkatan untuk auto-cipta headcount</p>
        </div>
      </div>

      <form class="mt-5 space-y-5" @submit.prevent="submit">
        <AlertBox :messages="error" />

        <fieldset class="min-w-0">
          <legend class="mb-2 text-sm font-bold text-slate-700">Darjah</legend>
          <div class="grid grid-cols-3 gap-2">
            <label
              v-for="l in DARJAH_LEVELS"
              :key="l.label"
              :class="[
                LABEL,
                selected.includes(l.value) ? 'border-amber-300 bg-amber-50 text-amber-800' : OFF,
              ]"
              :data-testid="`level-${l.label}`"
            >
              <input v-model="selected" type="checkbox" :value="l.value" class="h-4 w-4" />
              {{ l.label }}
            </label>
          </div>
        </fieldset>

        <fieldset class="min-w-0">
          <legend class="mb-2 text-sm font-bold text-slate-700">Tingkatan</legend>
          <div class="grid grid-cols-3 gap-2">
            <label
              v-for="l in TINGKATAN_LEVELS"
              :key="l.label"
              :class="[
                LABEL,
                selected.includes(l.value) ? 'border-blue-300 bg-blue-50 text-blue-800' : OFF,
              ]"
              :data-testid="`level-${l.label}`"
            >
              <input v-model="selected" type="checkbox" :value="l.value" class="h-4 w-4" />
              {{ l.label }}
            </label>
          </div>
        </fieldset>

        <div class="flex gap-3">
          <button
            type="button"
            class="min-h-11 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
            data-testid="auto-setup-cancel"
            @click="close()"
          >
            Batal
          </button>
          <button
            type="submit"
            :disabled="count === 0 || submitting"
            :class="[
              'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white transition',
              count === 0
                ? 'cursor-not-allowed bg-slate-300'
                : 'bg-emerald-600 hover:bg-emerald-700',
            ]"
            data-testid="auto-setup-submit"
          >
            <WandSparkles class="h-4 w-4" />
            <span
              >Auto-Setup<template v-if="count > 0"> ({{ count }})</template></span
            >
          </button>
        </div>
      </form>
    </template>
  </BaseModal>
</template>
