<script setup lang="ts">
/**
 * S5 "Pelajar Sedia Ada ({used} orang)" (FR-M02-60). The toggle opens the panel; the first opening calls
 * `GET /api/admin/schools/:id/students`. The panel has "Cari nama / email / ID..." (300 ms) and a class
 * select ("Semua Kelas" + D1–D6 for a primary school, T1–T5 otherwise), both reloading the list; the table
 * "#", "Nama", "Email / ID Delima", "Kelas" scrolls inside the panel (cards below `md`); "Memuatkan..."
 * while loading, "Tiada pelajar dijumpai" when empty and the 200-row notice at 200 rows. Errors are silent
 * (console).
 */
import { ref, watch } from 'vue'

import { useDebounce } from '@/composables'

import { fetchSchoolStudents, type ExistingStudent } from '../api/imports'
import { EXISTING_STUDENTS_CAP, existingClassFilter } from '../lib/import-options'
import CardCell from './native/CardCell.vue'
import CardRow from './native/CardRow.vue'
import CardTable from './native/CardTable.vue'
import NativeSelect from './native/NativeSelect.vue'

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

const COLUMNS = [
  { key: 'no', label: '#' },
  { key: 'name', label: 'Nama' },
  { key: 'email', label: 'Email / ID Delima' },
  { key: 'class', label: 'Kelas' },
]

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
  <div class="flex flex-col gap-3" data-testid="existing-students">
    <UButton
      type="button"
      block
      color="neutral"
      variant="soft"
      icon="i-ph-users"
      :trailing-icon="opened ? 'i-ph-caret-up' : 'i-ph-caret-down'"
      :label="`Pelajar Sedia Ada (${String(used)} orang)`"
      :aria-expanded="opened"
      data-testid="existing-toggle"
      @click="toggle"
    />

    <UCard v-if="opened" data-testid="existing-panel">
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2 sm:flex-row">
          <UInput
            v-model="search"
            type="text"
            autocomplete="off"
            placeholder="Cari nama / email / ID..."
            icon="i-ph-magnifying-glass"
            aria-label="Cari pelajar"
            size="lg"
            class="min-w-0 flex-1"
            data-testid="existing-search"
          />
          <NativeSelect
            v-model="classLevel"
            aria-label="Kelas"
            class="sm:w-48"
            data-testid="existing-class"
          >
            <option value="">Semua Kelas</option>
            <option v-for="o in existingClassFilter(schoolType)" :key="o.value" :value="o.value">
              {{ o.label }}
            </option>
          </NativeSelect>
        </div>

        <p
          v-if="loading"
          class="flex items-center justify-center gap-2 p-6 text-label text-muted"
          data-testid="existing-loading"
        >
          <UIcon name="i-ph-spinner-gap" class="size-4" aria-hidden="true" />
          Memuatkan...
        </p>
        <p
          v-else-if="rows.length === 0"
          class="flex items-center justify-center gap-2 p-6 text-label text-muted"
          data-testid="existing-empty"
        >
          <UIcon name="i-ph-magnifying-glass" class="size-4" aria-hidden="true" />
          Tiada pelajar dijumpai
        </p>
        <div v-else class="max-h-96 overflow-auto" data-testid="existing-scroll">
          <CardTable :columns="COLUMNS" caption="Pelajar sedia ada">
            <CardRow v-for="(s, i) in rows" :key="s.id" data-testid="existing-row">
              <CardCell label="#">{{ i + 1 }}</CardCell>
              <CardCell label="Nama">{{ s.name }}</CardCell>
              <CardCell label="Email / ID Delima">
                <span class="break-all">
                  {{ s.email }}
                  <span v-if="s.idDelima" class="text-primary">{{ s.idDelima }}</span>
                </span>
              </CardCell>
              <CardCell label="Kelas">
                <UBadge v-if="s.classLevel" color="neutral" variant="subtle" :label="s.classLevel" />
              </CardCell>
            </CardRow>
          </CardTable>
        </div>
        <p
          v-if="!loading && rows.length >= EXISTING_STUDENTS_CAP"
          class="flex items-center justify-center gap-2 text-center text-caption text-warning"
          data-testid="existing-cap"
        >
          <UIcon name="i-ph-info" class="size-4 shrink-0" aria-hidden="true" />
          Menunjukkan 200 pertama sahaja. Gunakan carian untuk cari pelajar tertentu.
        </p>
      </div>
    </UCard>
  </div>
</template>
