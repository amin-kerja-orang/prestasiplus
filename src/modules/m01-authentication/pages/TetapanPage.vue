<script setup lang="ts">
/**
 * S9 `/tetapan` "Tetapan Peribadi" (M01-T7a; FR-M01-46, 48; BR-17), v2 restyle (B09 / A2). Renders in the user shell for
 * Murid / Guru / Admin Sekolah (INFERRED, OQ-6). The controls are independent (no show/hide or
 * enable logic, as live). Save sends every field to `PUT /api/me/settings` and re-renders with the
 * saved values and the green status box (UNVERIFIED COPY).
 */
import { computed, onMounted, reactive, ref } from 'vue'

import { DsPage } from '@/ds'

import { getSettings, saveSettings, type Faith, type UserSettings } from '../api'
import SettingRow from '../components/tetapan/SettingRow.vue'
import { errorLines } from '../lib/error-lines'

/** Reka selects reject an empty item value, so "Tidak nyatakan" uses a sentinel. */
const NO_FAITH = '__tiada'
const FAITH_OPTIONS: { value: string; label: string }[] = [
  { value: NO_FAITH, label: '— Tidak nyatakan —' },
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

const faithModel = computed({
  get: () => (form.faith === '' ? NO_FAITH : form.faith),
  set: (value: string) => {
    form.faith = value === NO_FAITH ? '' : (value as Faith)
  },
})
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
  <DsPage
    title="⚙️ Tetapan Peribadi"
    subtitle="Atur pengalaman PrestasiPlus mengikut keperluan rohani & masa anda."
    data-testid="tetapan-page"
  >
    <UAlert
      v-if="status"
      color="success"
      variant="subtle"
      icon="i-ph-check-circle"
      :title="status"
      data-variant="success"
      data-testid="tetapan-status"
    />
    <UAlert
      v-if="errors.length > 0"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle"
      data-testid="tetapan-alert"
    >
      <template #title>
        <p v-for="line in errors" :key="line">{{ line }}</p>
      </template>
    </UAlert>

    <div
      v-if="loading"
      class="flex flex-col gap-4"
      role="status"
      aria-busy="true"
      data-testid="tetapan-loading"
    >
      <USkeleton class="h-48 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <div v-else-if="loadFailed" class="text-center">
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        size="lg"
        data-testid="tetapan-retry"
        @click="load"
        >Cuba lagi</UButton
      >
    </div>

    <form
      v-else
      class="flex flex-col gap-4 md:gap-6"
      data-testid="tetapan-form"
      @submit.prevent="submit"
    >
      <div class="grid grid-cols-1 items-start gap-4 md:gap-6 xl:grid-cols-2">
        <UCard>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-moon-stars" class="size-5" aria-hidden="true" />
                🕌 Mod Rohani
              </h2>
              <p class="text-caption text-muted">
                Personalisasi pembelajaran ikut nilai keagamaan anda. Boleh toggle off bila-bila
                masa.
              </p>
            </div>

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
          </div>
        </UCard>

        <UCard>
          <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
              <h2 class="flex items-center gap-2 text-subheading text-highlighted">
                <UIcon name="i-ph-globe-hemisphere-west" class="size-5" aria-hidden="true" />
                🌍 Latar Agama (opsyen)
              </h2>
              <p class="text-caption text-muted">
                Bagi konteks supaya AI dan content lebih relevan. Tidak diwajibkan.
              </p>
            </div>

            <div class="flex min-h-14 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div class="min-w-0 flex-1">
                <label for="faith" class="block text-label text-highlighted">
                  Agama / kepercayaan
                </label>
                <p class="text-caption text-muted">
                  Untuk mod rohani yang sesuai. Future: Hindu/Buddhist/Christian content akan
                  ditambah.
                </p>
              </div>
              <USelect
                id="faith"
                v-model="faithModel"
                name="faith"
                :items="FAITH_OPTIONS"
                size="lg"
                class="w-full sm:w-auto sm:shrink-0"
                data-testid="tetapan-faith"
              />
            </div>
          </div>
        </UCard>
      </div>

      <div class="flex justify-end">
        <UButton
          type="submit"
          color="primary"
          size="lg"
          icon="i-ph-floppy-disk"
          :loading="saving"
          :disabled="!canSave"
          data-testid="tetapan-submit"
          >Simpan Tetapan</UButton
        >
      </div>
    </form>
  </DsPage>
</template>
