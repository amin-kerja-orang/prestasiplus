<script setup lang="ts">
/**
 * Parent <-> student linker of S2 "Pautkan Anak (Pelajar)" (FR-M02-26) and S3 card "Anak yang Dipautkan"
 * (FR-M02-42). One search box (300 ms, >= 2 characters -> `GET /api/students/search`, max 15), a loading
 * indicator while the request runs, result rows (name, class badge, school badge; an already linked
 * student is dimmed and cannot be clicked), the empty result "Tiada pelajar dijumpai" and the chips of the
 * linked children with a remove button. The chip list is the v-model; the page submits it as
 * `linkedStudentIds`.
 *
 * Picking a result adds a chip and clears the search box (INFERRED: the SRS says only "clicking adds a
 * chip"). Request errors show nothing (SRS 8 "All pickers").
 */
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { DsFormField, DsPanel } from '@/ds'

import { searchStudents, type StudentSearchItem } from '../api/users'
import { SEARCH_MIN_CHARS } from '../lib/user-form-options'

const props = defineProps<{ variant: 'create' | 'edit' }>()

const linked = defineModel<StudentSearchItem[]>({ required: true })

const root = ref<HTMLElement | null>(null)
/** The term whose search last finished, so "Tiada pelajar dijumpai" never shows before the answer. */
const doneTerm = ref('')

const picker = useSearchPicker<StudentSearchItem>({
  minChars: SEARCH_MIN_CHARS,
  root,
  search: async (term, signal) => {
    const rows = await searchStudents(term, { signal })
    doneTerm.value = term
    return rows
  },
})
const { term, results, open, searching } = picker

const isEdit = computed(() => props.variant === 'edit')
const linkedIds = computed(() => new Set(linked.value.map((s) => s.id)))
const longEnough = computed(() => term.value.length >= SEARCH_MIN_CHARS)
const showEmpty = computed(
  () =>
    longEnough.value &&
    !searching.value &&
    doneTerm.value === term.value &&
    results.value.length === 0,
)
const showDropdown = computed(
  () =>
    open.value &&
    longEnough.value &&
    (searching.value || results.value.length > 0 || showEmpty.value),
)

function onInput(value: string): void {
  picker.setTerm(value)
  picker.onFocus() // typing means the box has focus: a list closed by a pick opens again
}

function add(student: StudentSearchItem): void {
  if (linkedIds.value.has(student.id)) return
  linked.value = [...linked.value, student]
  picker.reset()
  doneTerm.value = ''
}

function remove(id: number): void {
  linked.value = linked.value.filter((s) => s.id !== id)
}
</script>

<template>
  <div
    ref="root"
    class="flex flex-col gap-3"
    :data-testid="isEdit ? 'parent-linker-edit' : 'parent-linker'"
  >
    <h3
      v-if="isEdit"
      id="linker-heading"
      class="flex items-center gap-2 text-label text-highlighted"
    >
      <UIcon name="i-ph-baby" class="size-4 text-muted" aria-hidden="true" />
      Anak yang Dipautkan
    </h3>
    <DsFormField
      native
      for="linker-search"
      :label="isEdit ? 'Cari pelajar' : 'Pautkan Anak (Pelajar)'"
    >
      <div class="relative">
        <UInput
          id="linker-search"
          :model-value="term"
          type="text"
          autocomplete="off"
          :placeholder="
            isEdit
              ? 'Cari nama atau emel pelajar untuk dipautkan...'
              : 'Cari nama atau emel pelajar...'
          "
          icon="i-ph-magnifying-glass"
          :loading="searching"
          class="w-full"
          aria-label="Cari pelajar"
          data-testid="linker-search"
          @update:model-value="onInput"
          @focus="picker.onFocus()"
        />

        <DsPanel v-if="showDropdown" tone="float" flush data-testid="linker-dropdown">
          <div
            v-if="searching"
            class="flex min-h-11 items-center justify-center py-3 text-muted"
            data-testid="linker-loading"
          >
            <USkeleton class="h-4 w-24" />
          </div>
          <template v-else>
            <UButton
              v-for="student in results"
              :key="student.id"
              type="button"
              block
              color="neutral"
              variant="ghost"
              class="h-auto min-h-11 justify-start text-start whitespace-normal"
              :disabled="linkedIds.has(student.id)"
              data-testid="linker-result"
              @click="add(student)"
            >
              <span class="flex w-full min-w-0 items-center gap-2">
                <span class="min-w-0 flex-1 truncate">{{ student.name }}</span>
                <UBadge
                  v-if="student.classLevel"
                  color="neutral"
                  variant="subtle"
                  :label="student.classLevel"
                />
                <UBadge
                  v-if="student.schoolName"
                  color="neutral"
                  variant="subtle"
                  class="max-w-40 truncate"
                  :label="student.schoolName"
                />
              </span>
            </UButton>
            <p
              v-if="showEmpty"
              class="flex min-h-11 items-center justify-center gap-2 p-3 text-label text-muted"
              data-testid="linker-empty"
            >
              <UIcon name="i-ph-magnifying-glass" class="size-4" aria-hidden="true" />
              Tiada pelajar dijumpai
            </p>
          </template>
        </DsPanel>
      </div>
    </DsFormField>

    <div v-if="linked.length > 0 || isEdit" class="flex flex-col gap-2" data-testid="linker-chips">
      <p v-if="!isEdit" class="text-overline text-muted">Anak yang dipautkan:</p>
      <ul v-if="linked.length > 0" class="flex flex-col gap-2">
        <DsPanel
          v-for="student in linked"
          :key="student.id"
          as="li"
          tone="inset"
          data-testid="linker-chip"
        >
          <div class="flex min-h-11 items-center gap-2">
            <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
              <span class="max-w-full truncate text-label text-default">{{ student.name }}</span>
              <UBadge
                v-if="student.classLevel"
                color="neutral"
                variant="subtle"
                :label="student.classLevel"
              />
              <UBadge
                v-if="isEdit && student.schoolName"
                color="neutral"
                variant="subtle"
                class="max-w-40 truncate"
                :label="student.schoolName"
              />
            </span>
            <UButton
              type="button"
              color="error"
              variant="ghost"
              icon="i-ph-x-circle"
              :aria-label="isEdit ? 'Buang pautan' : 'Buang'"
              :title="isEdit ? 'Buang pautan' : 'Buang'"
              data-testid="linker-remove"
              @click="remove(student.id)"
            />
          </div>
        </DsPanel>
      </ul>
      <p v-else class="flex items-center gap-2 text-caption text-muted" data-testid="linker-none">
        <UIcon name="i-ph-info" class="size-4 shrink-0" aria-hidden="true" />
        Tiada pelajar dipautkan lagi
      </p>
    </div>

    <p class="flex items-start gap-2 text-caption text-muted">
      <UIcon name="i-ph-info" class="mt-1 size-4 shrink-0" aria-hidden="true" />
      <span v-if="isEdit">
        Tambah atau buang pautan anak. Perubahan disimpan apabila klik "Kemaskini".
      </span>
      <span v-else>Boleh pautkan lebih dari satu pelajar. Boleh juga ditambah kemudian.</span>
    </p>
  </div>
</template>
