<script setup lang="ts">
/**
 * "Pilih Sekolah" card of S5 (FN-M10-3.2.2): 300 ms debounced search from 2 characters
 * (`GET /api/schools/search?q=&limit=15`), a progress bar while searching, results "{nama}" +
 * "{daerah}, {negeri}", "Tiada sekolah dijumpai", and a selected card with a clear button.
 */
import { DsPanel, DsCluster, DsText } from '@/ds'
import { ref } from 'vue'

import { useSearchPicker } from '@/composables'
import { searchSchools, type SchoolSummary } from '@/modules/m02-users-schools'

import { KELAS_COPY, schoolPlace } from './copy'

const emit = defineEmits<{ select: [school: SchoolSummary | null] }>()

const root = ref<HTMLElement | null>(null)
const picker = useSearchPicker<SchoolSummary>({
  search: (term, signal) => searchSchools({ q: term, limit: 15, signal }),
  minChars: 2,
  root,
  onSelect: (school) => emit('select', school),
})
const { term, results, selected, open, searching } = picker

function clear(): void {
  picker.reset()
  emit('select', null)
}
</script>

<template>
  <DsPanel data-testid="school-picker">
    <h2 class="mb-3 flex items-center gap-2 text-subheading text-highlighted">
      <UIcon name="i-ph-buildings-duotone" class="size-5 text-primary-t" />{{
        KELAS_COPY.chooseSchool
      }}
    </h2>

    <DsPanel v-if="selected" tone="inset" data-testid="school-selected">
      <DsCluster justify="between" :wrap="false">
        <div class="min-w-0">
          <DsText
            variant="label"
            as="p"
            tone="highlighted"
            wrap="anywhere"
            data-testid="school-selected-name"
          >
            {{ selected.name }}
          </DsText>
          <DsText variant="caption" wrap="anywhere">{{ schoolPlace(selected) }}</DsText>
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          icon="i-ph-x-circle-duotone"
          :aria-label="KELAS_COPY.clearSchool"
          class="size-11 shrink-0 justify-center"
          data-testid="school-clear"
          @click="clear"
        />
      </DsCluster>
    </DsPanel>

    <div v-else ref="root" class="flex flex-col gap-2">
      <UInput
        type="text"
        :model-value="term"
        :placeholder="KELAS_COPY.schoolPlaceholder"
        :aria-label="KELAS_COPY.chooseSchool"
        autocomplete="off"
        icon="i-ph-magnifying-glass-duotone"
        class="w-full"
        data-testid="school-search"
        @input="picker.setTerm(($event.target as HTMLInputElement).value)"
        @focus="picker.onFocus"
      />
      <UProgress v-if="searching" animation="carousel" size="xs" data-testid="school-spinner" />

      <DsPanel
        v-if="open && term.length >= 2 && !searching"
        tone="inset"
        data-testid="school-results"
      >
        <UButton
          v-for="school in results"
          :key="school.id"
          type="button"
          color="neutral"
          variant="ghost"
          block
          class="h-auto min-h-11 justify-start text-left"
          data-testid="school-result"
          @click="picker.select(school)"
        >
          <span class="flex min-w-0 flex-col">
            <DsText variant="label" tone="highlighted" wrap="anywhere" class="whitespace-normal">{{
              school.name
            }}</DsText>
            <DsText variant="caption" as="span" wrap="anywhere" class="whitespace-normal">{{
              schoolPlace(school)
            }}</DsText>
          </span>
        </UButton>
        <p
          v-if="results.length === 0"
          class="flex items-center justify-center gap-2 px-4 py-4 text-body text-muted"
          data-testid="school-none"
        >
          <UIcon name="i-ph-magnifying-glass-duotone" class="size-4" />{{ KELAS_COPY.schoolNone }}
        </p>
      </DsPanel>
    </div>
  </DsPanel>
</template>
