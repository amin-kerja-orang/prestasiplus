<script setup lang="ts">
/**
 * S4 "Sekolah * (taip untuk cari)" picker (FR-M02-52; live `schoolSearch()`): input with the placeholder
 * "-- Cari nama atau kod sekolah..." (the chosen school's name once chosen); focus opens the list; >= 2
 * characters -> school search (300 ms, no `limit`, so up to 20); the dropdown box shows a skeleton while
 * loading, rows "{name} ({code})" + state, and "Tiada sekolah dijumpai" (query >= 2, finished, none).
 * Picking clears the text and shows "Dipilih: {name} ({code})" with a clear button. Request errors show
 * nothing (console only). The chosen school is the v-model.
 */
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { DsFormField, DsPanel } from '@/ds'

import { searchSchools, type SchoolSummary } from '../api/schools'
import { SEARCH_MIN_CHARS } from '../lib/user-form-options'

const school = defineModel<SchoolSummary | null>({ required: true })

const root = ref<HTMLElement | null>(null)
const doneTerm = ref('')

const picker = useSearchPicker<SchoolSummary>({
  minChars: SEARCH_MIN_CHARS,
  root,
  search: async (query, signal) => {
    try {
      const rows = await searchSchools({ q: query, signal })
      doneTerm.value = query
      return rows
    } catch (err) {
      if (!signal.aborted) console.error('Search error:', err)
      throw err
    }
  },
  onSelect: (item) => {
    school.value = item
    picker.setTerm('')
  },
})
const { term, results, open, searching } = picker

const showEmpty = computed(
  () =>
    term.value.length >= SEARCH_MIN_CHARS &&
    !searching.value &&
    doneTerm.value === term.value &&
    results.value.length === 0,
)
const showDropdown = computed(
  () =>
    open.value &&
    term.value.length >= SEARCH_MIN_CHARS &&
    (searching.value || results.value.length > 0 || showEmpty.value),
)

function label(s: SchoolSummary): string {
  return s.code === '' ? s.name : `${s.name} (${s.code})`
}

function onInput(value: string): void {
  picker.setTerm(value)
  picker.onFocus()
}

function clear(): void {
  school.value = null
  picker.reset()
  doneTerm.value = ''
}
</script>

<template>
  <div ref="root" data-testid="bulk-school">
    <DsFormField native for="bulk-school-search" label="Sekolah" required hint="(taip untuk cari)">
      <div class="relative">
        <UInput
          id="bulk-school-search"
          :model-value="term"
          type="text"
          autocomplete="off"
          :placeholder="school ? school.name : '-- Cari nama atau kod sekolah...'"
          icon="i-ph-magnifying-glass"
          class="w-full"
          data-testid="bulk-school-search"
          @update:model-value="onInput"
          @focus="picker.onFocus()"
        />
        <DsPanel v-if="showDropdown" behavior="float" padding="none" data-testid="bulk-school-dropdown">
          <p v-if="searching" class="p-3" data-testid="bulk-school-loading">
            <USkeleton class="h-4 w-full" />
          </p>
          <template v-else>
            <UButton
              v-for="item in results"
              :key="item.id"
              type="button"
              block
              color="neutral"
              variant="ghost"
              class="h-auto min-h-11 justify-start text-start whitespace-normal"
              data-testid="bulk-school-result"
              @click="picker.select(item)"
            >
              <span class="flex min-w-0 flex-col">
                <span class="text-label text-highlighted">{{ label(item) }}</span>
                <span class="text-caption text-muted">{{ item.state }}</span>
              </span>
            </UButton>
            <p
              v-if="showEmpty"
              class="p-3 text-center text-label text-muted"
              data-testid="bulk-school-empty"
            >
              Tiada sekolah dijumpai
            </p>
          </template>
        </DsPanel>
      </div>
      <p
        v-if="school"
        class="flex items-center gap-2 text-label text-success"
        data-testid="bulk-school-chosen"
      >
        <span class="min-w-0 break-words">Dipilih: {{ label(school) }}</span>
        <UButton
          type="button"
          color="error"
          variant="ghost"
          icon="i-ph-x"
          aria-label="Buang sekolah"
          data-testid="bulk-school-clear"
          @click="clear"
        />
      </p>
    </DsFormField>
  </div>
</template>
