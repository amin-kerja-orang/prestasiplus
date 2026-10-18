<script setup lang="ts">
/**
 * S3 "Sekolah" picker (FR-M02-41; the M01 `adminSchoolPicker` behaviour). With a school it shows a chip
 * (icon, name, "{type} · {state} · {district}") and a clear button. Cleared, it shows a state
 * select (short labels, 6.13) and the input "Taip nama sekolah (min. 2 huruf)...": 300 ms debounce, a search
 * runs when the query has >= 2 characters or a state is chosen (`limit=20`); the dropdown shows when open and
 * there are results or the query has >= 2 characters; the input shows a spinner while searching; the empty
 * result reads "Tiada sekolah dijumpai" (query >= 2, search finished, none). Request errors show nothing
 * (console "Search error:"). The chosen school is the v-model.
 */
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { DsFormField, DsNativeSelect, DsPanel } from '@/ds'

import { searchSchools, type SchoolSummary } from '../api/schools'
import { schoolMeta, SEARCH_MIN_CHARS, STATE_FILTER_OPTIONS } from '../lib/user-form-options'

const school = defineModel<SchoolSummary | null>({ required: true })

defineProps<{ required?: boolean }>()

const root = ref<HTMLElement | null>(null)
const state = ref('')
const doneTerm = ref('')

const picker = useSearchPicker<SchoolSummary>({
  // The threshold is applied in `search`: a state alone also triggers a search.
  minChars: 0,
  root,
  search: async (query, signal) => {
    if (query.length < SEARCH_MIN_CHARS && state.value === '') {
      doneTerm.value = ''
      return []
    }
    try {
      const rows = await searchSchools({ q: query, state: state.value || null, limit: 20, signal })
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
    term.value.length >= SEARCH_MIN_CHARS &&
    !searching.value &&
    doneTerm.value === term.value &&
    results.value.length === 0,
)
const showDropdown = computed(
  () => open.value && (results.value.length > 0 || term.value.length >= SEARCH_MIN_CHARS),
)

function onInput(value: string): void {
  picker.setTerm(value)
  picker.onFocus() // typing means the box has focus: a list closed by a pick opens again
}

function onState(): void {
  picker.setTerm(term.value)
  picker.onFocus()
}

function clear(): void {
  school.value = null
  picker.reset()
  state.value = ''
  doneTerm.value = ''
}
</script>

<template>
  <div ref="root" data-testid="admin-school">
    <DsFormField native for="admin-school-search" label="Sekolah" :required="required">
      <DsPanel v-if="school" tone="tint" data-testid="admin-school-chip">
        <div class="flex min-h-14 items-center gap-3">
          <UIcon name="i-ph-buildings" class="size-6 shrink-0 text-primary-t" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span
              class="block truncate text-label text-highlighted"
              data-testid="admin-school-name"
            >
              {{ school.name }}
            </span>
            <span class="block text-caption break-words text-muted">{{ schoolMeta(school) }}</span>
          </span>
          <UButton
            type="button"
            color="error"
            variant="ghost"
            icon="i-ph-x-circle"
            aria-label="Buang sekolah"
            data-testid="admin-school-clear"
            @click="clear"
          />
        </div>
      </DsPanel>

      <div v-else class="flex flex-col gap-2 sm:flex-row">
        <DsNativeSelect
          v-model="state"
          aria-label="Negeri"
          class="sm:w-48 sm:shrink-0"
          data-testid="admin-school-state"
          @change="onState"
        >
          <option v-for="o in STATE_FILTER_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </DsNativeSelect>
        <div class="relative min-w-0 flex-1">
          <UInput
            id="admin-school-search"
            :model-value="term"
            type="text"
            autocomplete="off"
            placeholder="Taip nama sekolah (min. 2 huruf)..."
            :loading="searching"
            class="w-full"
            data-testid="admin-school-search"
            @update:model-value="onInput"
            @focus="picker.onFocus()"
          />
          <span v-if="searching" class="sr-only" data-testid="admin-school-loading"
            >Mencari...</span
          >
          <DsPanel v-if="showDropdown" behavior="float" padding="none" data-testid="admin-school-dropdown">
            <UButton
              v-for="item in results"
              :key="item.id"
              type="button"
              block
              color="neutral"
              variant="ghost"
              class="h-auto min-h-11 justify-start text-start whitespace-normal"
              data-testid="admin-school-result"
              @click="picker.select(item)"
            >
              <span class="flex min-w-0 flex-col">
                <span class="text-label text-highlighted">{{ item.name }}</span>
                <span class="text-caption text-muted">{{ schoolMeta(item) }}</span>
              </span>
            </UButton>
            <p
              v-if="showEmpty"
              class="p-3 text-center text-label text-muted"
              data-testid="admin-school-empty"
            >
              Tiada sekolah dijumpai
            </p>
          </DsPanel>
        </div>
      </div>
    </DsFormField>
  </div>
</template>
