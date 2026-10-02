<script setup lang="ts">
/**
 * S9 `/tetapan` "Tetapan Peribadi" (M01-T7a; FR-M01-46, 48; BR-17). Renders in the user shell for
 * Murid / Guru / Admin Sekolah (INFERRED, OQ-6). The controls are independent (no show/hide or
 * enable logic, as live). Save sends every field to `PUT /api/me/settings` and re-renders with the
 * saved values and the green status box (UNVERIFIED COPY).
 */
import { computed, onMounted, reactive, ref } from 'vue'

import { AlertBox, LoadingSpinner } from '@/components/feedback'

import { getSettings, saveSettings, type Faith, type UserSettings } from '../api'
import SettingRow from '../components/tetapan/SettingRow.vue'
import { errorLines } from '../lib/error-lines'

const FAITH_OPTIONS: { value: '' | Faith; label: string }[] = [
  { value: '', label: '— Tidak nyatakan —' },
  { value: 'muslim', label: 'Islam' },
  { value: 'hindu', label: 'Hindu' },
  { value: 'buddhist', label: 'Buddha' },
  { value: 'christian', label: 'Kristian' },
  { value: 'none', label: 'Tiada' },
]

interface Form {
  spiritualMode: boolean
  showBismillahSplash: boolean
  subuhPushEnabled: boolean
  subuhPushTime: string
  ramadanModeEnabled: boolean
  sahurPushTime: string
  faith: '' | Faith
}

const form = reactive<Form>({
  spiritualMode: false,
  showBismillahSplash: false,
  subuhPushEnabled: false,
  subuhPushTime: '05:30',
  ramadanModeEnabled: false,
  sahurPushTime: '04:30',
  faith: '',
})
const loading = ref(true)
const loadFailed = ref(false)
const saving = ref(false)
const errors = ref<string[]>([])
const status = ref('')

const canSave = computed(() => !loading.value && !loadFailed.value && !saving.value)

function fill(s: UserSettings): void {
  form.spiritualMode = s.spiritualMode
  form.showBismillahSplash = s.showBismillahSplash
  form.subuhPushEnabled = s.subuhPushEnabled
  form.subuhPushTime = s.subuhPushTime
  form.ramadanModeEnabled = s.ramadanModeEnabled
  form.sahurPushTime = s.sahurPushTime
  form.faith = s.faith ?? ''
}

async function load(): Promise<void> {
  loading.value = true
  loadFailed.value = false
  errors.value = []
  try {
    fill(await getSettings())
  } catch (err) {
    loadFailed.value = true
    errors.value = errorLines(err)
  } finally {
    loading.value = false
  }
}

async function submit(): Promise<void> {
  if (!canSave.value) return
  saving.value = true
  errors.value = []
  status.value = ''
  try {
    const result = await saveSettings({ ...form, faith: form.faith === '' ? null : form.faith })
    fill(result.data)
    status.value = result.status
  } catch (err) {
    errors.value = errorLines(err)
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto w-full max-w-182 space-y-6" data-testid="tetapan-page">
    <header
      class="rounded-2xl bg-linear-to-br from-slate-600 to-slate-500 p-6 text-white shadow-lg"
    >
      <h1 class="text-2xl font-bold text-white sm:text-3xl">⚙️ Tetapan Peribadi</h1>
      <p class="mt-2 text-base text-slate-100">
        Atur pengalaman PrestasiPlus mengikut keperluan rohani &amp; masa anda.
      </p>
    </header>

    <AlertBox variant="success" :messages="status" data-testid="tetapan-status" />
    <AlertBox :messages="errors" data-testid="tetapan-alert" />

    <div
      v-if="loading"
      class="flex justify-center py-10 text-teal-600"
      role="status"
      data-testid="tetapan-loading"
    >
      <LoadingSpinner />
    </div>

    <div v-else-if="loadFailed" class="text-center">
      <button
        type="button"
        class="min-h-11 rounded-xl border border-slate-300 bg-white px-5 py-2 font-semibold text-slate-700 hover:bg-slate-50"
        data-testid="tetapan-retry"
        @click="load"
      >
        Cuba lagi
      </button>
    </div>

    <form v-else class="space-y-6" data-testid="tetapan-form" @submit.prevent="submit">
      <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 class="text-lg font-bold text-slate-900">🕌 Mod Rohani</h2>
        <p class="mt-2 mb-5 text-sm text-slate-500">
          Personalisasi pembelajaran ikut nilai keagamaan anda. Boleh toggle off bila-bila masa.
        </p>

        <SettingRow
          id="spiritual_mode"
          v-model:checked="form.spiritualMode"
          label="Aktifkan Mod Rohani"
          description="Master toggle — kalau off, semua spiritual touchpoints disable."
        />
        <SettingRow
          id="show_bismillah_splash"
          v-model:checked="form.showBismillahSplash"
          label="Tunjuk doa sebelum quiz"
          description='Splash 2-saat sebelum mula quiz: "Bismillahi tawakkaltu &apos;alallah". Tetapan untuk Muslim.'
        />
        <SettingRow
          id="subuh_push_enabled"
          v-model:checked="form.subuhPushEnabled"
          v-model:time="form.subuhPushTime"
          has-time
          label="Push waktu Subuh"
          description="Push notifikasi pagi awal untuk yang bangun Subuh — 30 minit study window selepas Subuh = paling produktif."
        />
        <SettingRow
          id="ramadan_mode_enabled"
          v-model:checked="form.ramadanModeEnabled"
          v-model:time="form.sahurPushTime"
          has-time
          label="Mod Ramadan"
          description="Push waktu sahur (~4:30am) untuk study sebelum Subuh. Pace lebih ringan waktu Ramadan."
        />
      </section>

      <section class="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 class="text-lg font-bold text-slate-900">🌍 Latar Agama (opsyen)</h2>
        <p class="mt-2 mb-5 text-sm text-slate-500">
          Bagi konteks supaya AI dan content lebih relevan. Tidak diwajibkan.
        </p>

        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div class="min-w-0 flex-1">
            <label for="faith" class="block text-base font-semibold text-slate-900">
              Agama / kepercayaan
            </label>
            <p class="text-sm leading-relaxed text-slate-500">
              Untuk mod rohani yang sesuai. Future: Hindu/Buddhist/Christian content akan ditambah.
            </p>
          </div>
          <select
            id="faith"
            v-model="form.faith"
            name="faith"
            class="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-700 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-300 sm:w-auto sm:shrink-0"
            data-testid="tetapan-faith"
          >
            <option v-for="o in FAITH_OPTIONS" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </select>
        </div>
      </section>

      <button
        type="submit"
        :disabled="!canSave"
        class="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-teal-700 to-cyan-500 px-6 py-3 text-base font-bold text-white shadow-md transition hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="tetapan-submit"
      >
        <LoadingSpinner v-if="saving" />
        <span v-else aria-hidden="true">💾</span>
        Simpan Tetapan
      </button>
    </form>
  </div>
</template>
