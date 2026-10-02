<script setup lang="ts">
/**
 * S5 "Pelajar Sedia Ada ({used} orang)" (FR-M02-60). The toggle opens the panel; the first opening calls
 * `GET /api/admin/schools/:id/students`. The panel has "Cari nama / email / ID..." (300 ms) and a class
 * select ("Semua Kelas" + D1–D6 for a primary school, T1–T5 otherwise), both reloading the list; the table
 * "#", "Nama", "Email / ID Delima", "Kelas" scrolls inside the panel; "Memuatkan..." while loading,
 * "Tiada pelajar dijumpai" when empty and the 200-row notice at 200 rows. Errors are silent (console).
 */
import { ChevronDown, Info, LoaderCircle, Search, Users } from '@lucide/vue'
import { ref, watch } from 'vue'

import { useDebounce } from '@/composables'

import { fetchSchoolStudents, type ExistingStudent } from '../api/imports'
import { EXISTING_STUDENTS_CAP, existingClassFilter } from '../lib/import-options'

const props = defineProps<{
  schoolId: number
  schoolType: string
  used: number
}>()

const opened = ref(false)
const loading = ref(false)
const rows = ref<ExistingStudent[]>([])
const search = ref('')
const classLevel = ref('')
let loaded = false
let controller: AbortController | null = null

async function load(): Promise<void> {
  controller?.abort()
  const current = new AbortController()
  controller = current
  loading.value = true
  try {
    const found = await fetchSchoolStudents(props.schoolId, {
      search: search.value.trim() === '' ? null : search.value.trim(),
      classLevel: classLevel.value === '' ? null : classLevel.value,
      signal: current.signal,
    })
    if (controller !== current) return
    rows.value = found
  } catch (err) {
    if (controller !== current) return
    rows.value = []
    console.error('Fetch students error:', err)
  } finally {
    if (controller === current) {
      loading.value = false
      controller = null
    }
  }
}

const debouncedLoad = useDebounce(() => void load(), 300)

function toggle(): void {
  opened.value = !opened.value
  if (opened.value && !loaded) {
    loaded = true
    void load()
  }
}

watch(search, () => debouncedLoad())
watch(classLevel, () => {
  debouncedLoad.cancel()
  void load()
})
</script>

<template>
  <div data-testid="existing-students">
    <button
      type="button"
      class="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-blue-200 bg-blue-50 px-3.5 py-2.5 text-left text-sm font-semibold text-blue-700 transition hover:bg-blue-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300"
      data-testid="existing-toggle"
      @click="toggle"
    >
      <span class="flex items-center gap-2">
        <Users class="h-4 w-4" aria-hidden="true" />
        Pelajar Sedia Ada ({{ used }} orang)
      </span>
      <ChevronDown :class="['h-4 w-4 transition', opened && 'rotate-180']" aria-hidden="true" />
    </button>

    <div
      v-if="opened"
      class="mt-2 rounded-xl border border-blue-200 bg-white"
      data-testid="existing-panel"
    >
      <div class="flex flex-col gap-2 border-b border-slate-100 p-3 sm:flex-row">
        <div class="relative min-w-0 flex-1">
          <Search
            class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            v-model="search"
            type="text"
            autocomplete="off"
            placeholder="Cari nama / email / ID..."
            class="min-h-11 w-full rounded-lg border border-slate-200 bg-blue-50/50 py-2 pr-3 pl-9 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300"
            data-testid="existing-search"
          />
        </div>
        <select
          v-model="classLevel"
          class="min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-300 sm:w-40"
          data-testid="existing-class"
        >
          <option value="">Semua Kelas</option>
          <option v-for="o in existingClassFilter(schoolType)" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
      </div>

      <p
        v-if="loading"
        class="flex items-center justify-center gap-2 p-6 text-sm text-slate-500"
        data-testid="existing-loading"
      >
        <LoaderCircle class="h-4 w-4 animate-spin" aria-hidden="true" />
        Memuatkan...
      </p>
      <p
        v-else-if="rows.length === 0"
        class="flex items-center justify-center gap-2 p-6 text-sm text-slate-500"
        data-testid="existing-empty"
      >
        <Search class="h-4 w-4" aria-hidden="true" />
        Tiada pelajar dijumpai
      </p>
      <div v-else class="max-h-96 overflow-auto" data-testid="existing-scroll">
        <table class="w-full min-w-[32rem] text-left text-xs sm:text-sm">
          <thead class="sticky top-0 bg-slate-50 text-xs font-semibold text-slate-600">
            <tr>
              <th scope="col" class="px-3 py-2">#</th>
              <th scope="col" class="px-3 py-2">Nama</th>
              <th scope="col" class="px-3 py-2">Email / ID Delima</th>
              <th scope="col" class="px-3 py-2">Kelas</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(s, i) in rows"
              :key="s.id"
              class="border-t border-slate-100"
              data-testid="existing-row"
            >
              <td class="px-3 py-2 text-slate-400">{{ i + 1 }}</td>
              <td class="px-3 py-2 text-slate-800">{{ s.name }}</td>
              <td class="px-3 py-2 break-all text-slate-600">
                {{ s.email }}
                <span v-if="s.idDelima" class="ml-1 text-blue-600">{{ s.idDelima }}</span>
              </td>
              <td class="px-3 py-2">
                <span
                  v-if="s.classLevel"
                  class="rounded bg-blue-100 px-1.5 py-0.5 text-xs font-semibold text-blue-700"
                >
                  {{ s.classLevel }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p
        v-if="!loading && rows.length >= EXISTING_STUDENTS_CAP"
        class="flex items-center justify-center gap-2 border-t border-amber-300 bg-amber-50 px-3 py-2 text-center text-xs text-amber-700"
        data-testid="existing-cap"
      >
        <Info class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Menunjukkan 200 pertama sahaja. Gunakan carian untuk cari pelajar tertentu.
      </p>
    </div>
  </div>
</template>
