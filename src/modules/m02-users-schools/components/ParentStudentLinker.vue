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
 * chip"). Request errors show nothing (SRS §8 "All pickers").
 */
import { Baby, CircleX, Info, LoaderCircle, Search } from '@lucide/vue'
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

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

function onInput(event: Event): void {
  picker.setTerm((event.target as HTMLInputElement).value)
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

const INPUT =
  'w-full rounded-xl border-2 py-2.5 pr-3.5 pl-10 text-sm outline-none transition min-h-11 focus:ring-2'
const BADGE = 'inline-block max-w-[10rem] truncate rounded-full px-2 py-0.5 text-xs font-semibold'
</script>

<template>
  <div
    ref="root"
    :class="isEdit ? 'rounded-2xl border border-pink-200 bg-pink-50 p-4' : ''"
    :data-testid="isEdit ? 'parent-linker-edit' : 'parent-linker'"
  >
    <h3
      v-if="isEdit"
      id="linker-heading"
      class="mb-3 flex items-center gap-2 text-sm font-bold text-slate-800"
    >
      <Baby class="h-4 w-4 text-pink-500" aria-hidden="true" />
      Anak yang Dipautkan
    </h3>
    <label
      v-else
      for="linker-search"
      class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700"
    >
      <Baby class="h-4 w-4 text-pink-500" aria-hidden="true" />
      Pautkan Anak (Pelajar)
    </label>

    <div class="relative">
      <Search
        class="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        id="linker-search"
        type="text"
        autocomplete="off"
        :placeholder="
          isEdit
            ? 'Cari nama atau emel pelajar untuk dipautkan...'
            : 'Cari nama atau emel pelajar...'
        "
        :value="term"
        :class="[
          INPUT,
          isEdit
            ? 'border-pink-200 bg-white focus:border-pink-400 focus:ring-pink-200'
            : 'border-slate-200 focus:border-pink-400 focus:ring-pink-200',
        ]"
        data-testid="linker-search"
        @input="onInput"
        @focus="picker.onFocus()"
      />

      <div
        v-if="showDropdown"
        class="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        data-testid="linker-dropdown"
      >
        <div
          v-if="searching"
          class="flex min-h-11 items-center justify-center py-3 text-pink-500"
          data-testid="linker-loading"
        >
          <LoaderCircle class="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
        <template v-else>
          <button
            v-for="student in results"
            :key="student.id"
            type="button"
            :class="[
              'flex min-h-11 w-full items-center gap-2 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0',
              linkedIds.has(student.id) ? 'cursor-not-allowed opacity-40' : 'hover:bg-pink-50',
            ]"
            data-testid="linker-result"
            @click="add(student)"
          >
            <span class="min-w-0 flex-1 truncate text-slate-800">{{ student.name }}</span>
            <span v-if="student.classLevel" :class="[BADGE, 'bg-indigo-100 text-indigo-700']">
              {{ student.classLevel }}
            </span>
            <span v-if="student.schoolName" :class="[BADGE, 'bg-emerald-100 text-emerald-700']">
              {{ student.schoolName }}
            </span>
          </button>
          <p
            v-if="showEmpty"
            class="flex min-h-11 items-center justify-center gap-2 px-3 py-3 text-sm text-slate-500"
            data-testid="linker-empty"
          >
            <Search class="h-4 w-4" aria-hidden="true" />
            Tiada pelajar dijumpai
          </p>
        </template>
      </div>
    </div>

    <div v-if="linked.length > 0 || isEdit" class="mt-3" data-testid="linker-chips">
      <p v-if="!isEdit" class="mb-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        Anak yang dipautkan:
      </p>
      <ul v-if="linked.length > 0" class="space-y-2">
        <li
          v-for="student in linked"
          :key="student.id"
          class="flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pr-1 pl-3 text-sm"
          data-testid="linker-chip"
        >
          <span class="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
            <span class="max-w-full truncate text-slate-800">{{ student.name }}</span>
            <span v-if="student.classLevel" :class="[BADGE, 'bg-indigo-100 text-indigo-700']">
              {{ student.classLevel }}
            </span>
            <span
              v-if="isEdit && student.schoolName"
              :class="[BADGE, 'bg-emerald-100 text-emerald-700']"
            >
              {{ student.schoolName }}
            </span>
          </span>
          <button
            type="button"
            :title="isEdit ? 'Buang pautan' : 'Buang'"
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-300"
            data-testid="linker-remove"
            @click="remove(student.id)"
          >
            <CircleX class="h-5 w-5" aria-hidden="true" />
          </button>
        </li>
      </ul>
      <p v-else class="flex items-center gap-2 text-xs text-pink-700" data-testid="linker-none">
        <Info class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Tiada pelajar dipautkan lagi
      </p>
    </div>

    <p
      class="mt-2 flex items-start gap-1.5 text-xs"
      :class="isEdit ? 'text-pink-700' : 'text-slate-500'"
    >
      <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span v-if="isEdit">
        Tambah atau buang pautan anak. Perubahan disimpan apabila klik "Kemaskini".
      </span>
      <span v-else>Boleh pautkan lebih dari satu pelajar. Boleh juga ditambah kemudian.</span>
    </p>
  </div>
</template>
