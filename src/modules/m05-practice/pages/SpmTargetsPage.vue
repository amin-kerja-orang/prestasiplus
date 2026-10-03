<script setup lang="ts">
/**
 * S15 `/target-spm` "Target SPM Saya — PrestasiPlus" (M05-T7; FR-M05-117…121, BR-22, BR-26, BR-27,
 * DV-M05-12).
 *
 * - Card "Target Gred SPM" with "Simpan" and the 20 subject rows of #18: name, status line, progress
 *   track, predicted grade and the grade select (`targets[{id}]`). Progress exists only from the test
 *   fixture (BR-27); otherwise "Belum mula", an empty track and "-".
 * - "Simpan" sends all 20 values (#19), reloads the rows and shows the success flash (the server
 *   `status`); on error the choices are kept and the red flash shows (§8.3 UNVERIFIED COPY).
 * - Below 640 px each row wraps: name + status, grade, select; then the bar at full width (DV-M05-12).
 */
import { Lightbulb, Save, Target } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchSpmTargets, saveSpmTargets } from '../api/practice'
import type { SpmGrade } from '../api/types'
import {
  BAND_CLASS,
  SAVE_ERROR,
  SPM_GRADES,
  targetBarWidth,
  targetStatus,
} from '../components/remedial/assigned-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const { data, error, reload } = useApi((signal) => fetchSpmTargets({ signal }))
const rows = computed(() => data.value?.subjects ?? [])

const chosen = reactive<Record<number, SpmGrade | ''>>({})
watch(
  data,
  (d) => {
    if (!d) return
    for (const r of d.subjects) chosen[r.id] = r.target ?? ''
  },
  { immediate: true },
)

const saving = ref(false)
const success = ref<string | null>(null)
const failure = ref<string | null>(null)

async function save(): Promise<void> {
  if (saving.value) return
  saving.value = true
  success.value = null
  failure.value = null
  try {
    const targets: Record<number, SpmGrade | ''> = {}
    for (const r of rows.value) targets[r.id] = chosen[r.id] ?? ''
    const res = await saveSpmTargets(targets)
    success.value = res.status
  } catch {
    failure.value = SAVE_ERROR
    saving.value = false
    return
  }
  // A failed reload is not a failed save: the rows simply keep the chosen values.
  try {
    await reload()
  } catch {
    /* keep the page as it is */
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8" data-testid="targets-page">
    <div class="mx-auto max-w-3xl space-y-4">
      <AlertBox
        v-if="success"
        variant="success"
        :messages="success"
        data-testid="targets-success"
      />
      <AlertBox v-if="failure" :messages="failure" data-testid="targets-failure" />

      <form
        v-if="data"
        class="rounded-2xl bg-white p-4 shadow-sm sm:p-6"
        data-testid="targets-form"
        @submit.prevent="save"
      >
        <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="flex items-center gap-2 font-heading text-base font-bold text-slate-900">
              <Target class="h-5 w-5 text-indigo-600" />
              Target Gred SPM
            </h2>
            <p class="text-xs text-slate-500">
              Pilih target gred untuk setiap subjek. Sistem akan tunjuk kemajuan anda.
            </p>
          </div>
          <button
            type="submit"
            :disabled="saving"
            class="inline-flex min-h-11 items-center gap-2 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            data-testid="targets-save"
          >
            <Save class="h-4 w-4" />
            Simpan
          </button>
        </div>

        <div class="space-y-2">
          <div
            v-for="r in rows"
            :key="r.id"
            class="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-3 sm:flex-nowrap"
            :data-testid="`target-row-${String(r.id)}`"
          >
            <div class="min-w-0 flex-1 sm:w-44 sm:flex-none">
              <p class="text-sm font-semibold break-words text-slate-800" data-testid="target-name">
                {{ r.name }}
              </p>
              <p class="text-xs text-slate-500" data-testid="target-status">
                {{ targetStatus(r) }}
              </p>
            </div>
            <div
              class="order-last h-4 basis-full overflow-hidden rounded-full bg-slate-100 sm:order-none sm:flex-1 sm:basis-auto"
              data-testid="target-track"
            >
              <div
                v-if="r.band"
                class="h-full rounded-full"
                :class="BAND_CLASS[r.band]"
                :style="{ width: `${String(targetBarWidth(r))}%` }"
                data-testid="target-bar"
              ></div>
            </div>
            <span
              class="w-8 text-center text-sm font-bold"
              :class="r.predictedGrade ? 'text-slate-800' : 'text-slate-300'"
              data-testid="target-predicted"
              >{{ r.predictedGrade ?? '-' }}</span
            >
            <select
              v-model="chosen[r.id]"
              :name="`targets[${String(r.id)}]`"
              class="min-h-11 w-24 shrink-0 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-700"
              data-testid="target-select"
            >
              <option value="">Target</option>
              <option v-for="g in SPM_GRADES" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
        </div>
      </form>

      <div v-else-if="error" class="space-y-3" data-testid="targets-error">
        <AlertBox :messages="LOAD_ERROR" />
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700"
          data-testid="targets-retry"
          @click="reload()"
        >
          Cuba Semula
        </button>
      </div>

      <div
        v-if="data"
        class="rounded-2xl bg-white p-4 shadow-sm sm:p-6"
        data-testid="targets-legend"
      >
        <div class="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600">
          <span class="inline-flex items-center gap-2"
            ><span class="h-3 w-3 rounded-full bg-green-500"></span>70%+ Ketepatan (On Track)</span
          >
          <span class="inline-flex items-center gap-2"
            ><span class="h-3 w-3 rounded-full bg-amber-500"></span>50-69% (Perlu Usaha)</span
          >
          <span class="inline-flex items-center gap-2"
            ><span class="h-3 w-3 rounded-full bg-red-500"></span>&lt;50% (Perlu Fokus)</span
          >
        </div>
        <p class="mt-3 flex items-start gap-2 text-xs text-indigo-600 sm:justify-end">
          <Lightbulb class="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Tip: Jawab lebih banyak soalan untuk ramalan gred yang lebih tepat
        </p>
      </div>
    </div>
  </div>
</template>
