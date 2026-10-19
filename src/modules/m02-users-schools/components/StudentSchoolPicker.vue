<script setup lang="ts">
/**
 * S2 "Sekolah" picker of the `student` and `teacher` roles (FR-M02-25): input "Cari nama sekolah...",
 * 300 ms debounce, >= 2 characters -> `GET /api/schools/search?q=` (no limit, server default 20). As live:
 * no loading indicator, no empty text, no clear button; focus opens the list and a click outside closes
 * it; rows read "{name} ({type}, {state})"; the chosen name shows under the input. The chosen school
 * is the v-model, kept by the page so it survives a role change.
 */
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { DsFormField, DsPanel, DsText } from '@/ds'

import { searchSchools, type SchoolSummary } from '../api/schools'
import { SEARCH_MIN_CHARS } from '../lib/user-form-options'

const school = defineModel<SchoolSummary | null>({ required: true })

const root = ref<HTMLElement | null>(null)

const picker = useSearchPicker<SchoolSummary>({
  minChars: SEARCH_MIN_CHARS,
  root,
  search: (term, signal) => searchSchools({ q: term, signal }),
  onSelect: (item) => {
    school.value = item
  },
})
const { term, results, open } = picker

const showDropdown = computed(() => open.value && results.value.length > 0)

function onInput(value: string): void {
  picker.setTerm(value)
  picker.onFocus() // typing means the box has focus: a list closed by a pick opens again
}
</script>

<template>
  <div ref="root" data-testid="std-school">
    <DsFormField native for="std-school-search" label="Sekolah">
      <div class="relative">
        <UInput
          id="std-school-search"
          :model-value="term"
          type="text"
          autocomplete="off"
          placeholder="Cari nama sekolah..."
          icon="i-ph-magnifying-glass"
          class="w-full"
          data-testid="std-school-search"
          @update:model-value="onInput"
          @focus="picker.onFocus()"
        />
        <DsPanel
          v-if="showDropdown"
          behavior="float"
          padding="none"
          data-testid="std-school-dropdown"
        >
          <UButton
            v-for="item in results"
            :key="item.id"
            type="button"
            block
            color="neutral"
            variant="ghost"
            class="h-auto min-h-11 justify-start text-start whitespace-normal"
            data-testid="std-school-result"
            @click="picker.select(item)"
          >
            {{ item.name }} ({{ item.type }}, {{ item.state }})
          </UButton>
        </DsPanel>
      </div>
      <DsText v-if="school" variant="caption" tone="success" data-testid="std-school-chosen">
        {{ school.name }}
      </DsText>
    </DsFormField>
  </div>
</template>
