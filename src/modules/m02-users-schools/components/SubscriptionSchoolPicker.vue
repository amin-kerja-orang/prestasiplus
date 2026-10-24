<script setup lang="ts">
/**
 * S13 "Sekolah *" picker (FR-M02-84): input "Taip nama atau kod sekolah...", 300 ms debounce, >= 2
 * characters -> `/api/schools/search?q=&limit=15`; focus shows the previous results; a spinner while
 * loading; rows name + "{code} — {district}, {state}"; `Tiada sekolah dijumpai` when a finished search
 * of >= 2 characters finds none; picking hides the input and shows a selected card with a clear button.
 * The chosen school is the v-model.
 */
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { DsFormField, DsPanel, DsSurface } from '@/ds'

import { searchSchools, type SchoolSummary } from '../api/schools'

const school = defineModel<SchoolSummary | null>({ required: true })

const MIN_CHARS = 2
const root = ref<HTMLElement | null>(null)
const doneTerm = ref('')

const picker = useSearchPicker<SchoolSummary>({
  minChars: MIN_CHARS,
  root,
  search: async (query, signal) => {
    try {
      const rows = await searchSchools({ q: query, limit: 15, signal })
      doneTerm.value = query
      return rows
    } catch (err) {
      if (!signal.aborted) console.error('Search error:', err)
      throw err
    }
  },
  onSelect: (item) => {
    school.value = item
  },
})
const { term, results, open, searching } = picker

const showEmpty = computed(
  () =>
    term.value.length >= MIN_CHARS &&
    !searching.value &&
    doneTerm.value === term.value &&
    results.value.length === 0,
)
const showDropdown = computed(() => open.value && (results.value.length > 0 || showEmpty.value))

function meta(item: SchoolSummary): string {
  const place = [item.district, item.state].filter((v) => v !== null && v !== '').join(', ')
  return `${item.code} — ${place}`
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
  <div ref="root" data-testid="sub-school">
    <DsFormField native for="sub-school-search" label="Sekolah" required>
      <DsPanel v-if="school" tone="tint" data-testid="sub-school-chip">
        <div class="flex min-h-14 items-center gap-3">
          <span class="min-w-0 flex-1">
            <span
              class="block text-label break-words text-highlighted"
              data-testid="sub-school-name"
              >{{ school.name }}</span
            >
            <span class="block text-caption break-words text-muted">{{ meta(school) }}</span>
          </span>
          <UButton
            type="button"
            color="error"
            variant="ghost"
            icon="i-ph-x-circle"
            aria-label="Buang sekolah"
            data-testid="sub-school-clear"
            @click="clear"
          />
        </div>
      </DsPanel>

      <div v-else>
        <UInput
          id="sub-school-search"
          :model-value="term"
          type="text"
          autocomplete="off"
          placeholder="Taip nama atau kod sekolah..."
          :loading="searching"
          class="w-full"
          data-testid="sub-school-search"
          @update:model-value="onInput"
          @focus="picker.onFocus()"
        />
        <span v-if="searching" class="sr-only" data-testid="sub-school-loading">Mencari...</span>
        <!-- In flow, not `behavior="float"`: the form section card clips its overflow (SWX4, DV-M02-28). -->
        <DsSurface
          v-if="showDropdown"
          level="elevated"
          shadow="lift"
          padding="none"
          data-testid="sub-school-dropdown"
        >
          <div class="max-h-64 overflow-y-auto">
            <UButton
              v-for="item in results"
              :key="item.id"
              type="button"
              block
              color="neutral"
              variant="ghost"
              class="h-auto min-h-11 justify-start text-start whitespace-normal"
              data-testid="sub-school-result"
              @click="picker.select(item)"
            >
              <span class="flex min-w-0 flex-col">
                <span class="text-label text-highlighted">{{ item.name }}</span>
                <span class="text-caption text-muted">{{ meta(item) }}</span>
              </span>
            </UButton>
            <p
              v-if="showEmpty"
              class="flex items-center justify-center gap-2 p-3 text-center text-label text-muted"
              data-testid="sub-school-empty"
            >
              <UIcon name="i-ph-magnifying-glass-minus" class="size-4" aria-hidden="true" />
              Tiada sekolah dijumpai
            </p>
          </div>
        </DsSurface>
      </div>
    </DsFormField>
  </div>
</template>
