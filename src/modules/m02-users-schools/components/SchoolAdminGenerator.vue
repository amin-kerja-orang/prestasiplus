<script setup lang="ts">
/**
 * S2 `school_admin` section (FR-M02-27…31, BR-09): "Cari Sekolah *" search, the "Sekolah Dipilih" panel
 * with its reset button, the "Janakan Akaun Admin Sekolah" button (disabled without a school code, with
 * the DV-M02-12 warning) and the "Maklumat Dijana" box (name, login e-mail, default password, phone, JPN /
 * PPD badges). The page owns the state (school, generated flag, name, phone), the default password, the
 * clipboard and the "Disalin!" toast: this component emits `generate` and `copy`.
 */
import {
  Building,
  CircleCheck,
  CircleX,
  Copy,
  Landmark,
  LoaderCircle,
  Search,
  Tag,
  TriangleAlert,
  WandSparkles,
} from '@lucide/vue'
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { searchSchools, type SchoolSummary } from '../api/schools'
import { generatedAdminEmail, SEARCH_MIN_CHARS } from '../lib/user-form-options'

const school = defineModel<SchoolSummary | null>('school', { required: true })
const generated = defineModel<boolean>('generated', { required: true })
const name = defineModel<string>('name', { required: true })
const phone = defineModel<string>('phone', { required: true })

const props = defineProps<{
  /** The configured school-admin default password (SEC-M02-01), shown read-only once generated. */
  password: string
  generating?: boolean
}>()

const emit = defineEmits<{ generate: []; copy: [value: string] }>()

const root = ref<HTMLElement | null>(null)
const doneTerm = ref('')

const picker = useSearchPicker<SchoolSummary>({
  minChars: SEARCH_MIN_CHARS,
  root,
  search: async (term, signal) => {
    const rows = await searchSchools({ q: term, signal })
    doneTerm.value = term
    return rows
  },
  onSelect: (item) => {
    school.value = item
    generated.value = false
  },
})
const { term, results, open, searching } = picker

const hasCode = computed(() => (school.value?.code ?? '') !== '')
const email = computed(() => generatedAdminEmail(school.value?.code ?? ''))
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
    (results.value.length > 0 || showEmpty.value),
)

function onInput(event: Event): void {
  picker.setTerm((event.target as HTMLInputElement).value)
  picker.onFocus() // typing means the box has focus: a list closed by a pick opens again
}

/** FR-M02-28: clears the school and any generated credentials, and shows the search again. */
function reset(): void {
  school.value = null
  generated.value = false
  picker.reset()
  doneTerm.value = ''
}

function metaLine(s: SchoolSummary): string {
  return [s.state, s.district, s.type].filter((v) => v !== null && v !== '').join(' • ')
}

const FIELD =
  'min-h-11 w-full rounded-xl border-2 px-3.5 py-2.5 text-sm outline-none transition focus:ring-2'
const LABEL = 'mb-1 block text-xs font-semibold text-slate-600'
const READONLY = 'border-emerald-200 bg-emerald-50 font-mono text-slate-800'
const EDITABLE = 'border-slate-200 bg-white focus:border-blue-400 focus:ring-blue-300'
const COPY_BUTTON =
  'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 transition hover:bg-emerald-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300'
</script>

<template>
  <div ref="root" class="space-y-4" data-testid="school-admin-generator">
    <!-- FR-M02-27: search -->
    <div v-if="!school">
      <label
        for="gen-search"
        class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700"
      >
        <Search class="h-4 w-4 text-indigo-500" aria-hidden="true" />
        Cari Sekolah <span class="-ml-1.5 text-red-500">*</span>
      </label>
      <div class="relative">
        <input
          id="gen-search"
          type="text"
          autocomplete="off"
          placeholder="Taipkan nama sekolah atau kod sekolah (cth: JBA0001)..."
          :value="term"
          :class="[FIELD, EDITABLE, 'pr-10']"
          data-testid="gen-search"
          @input="onInput"
          @focus="picker.onFocus()"
        />
        <LoaderCircle
          v-if="searching"
          class="absolute top-1/2 right-3.5 h-4 w-4 -translate-y-1/2 animate-spin text-indigo-500"
          aria-hidden="true"
          data-testid="gen-loading"
        />
        <div
          v-if="showDropdown"
          class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          data-testid="gen-dropdown"
        >
          <button
            v-for="item in results"
            :key="item.id"
            type="button"
            class="block min-h-11 w-full border-b border-slate-100 px-3 py-2 text-left hover:bg-indigo-50"
            data-testid="gen-result"
            @click="picker.select(item)"
          >
            <span class="block text-sm font-bold text-slate-800">{{ item.name }}</span>
            <span
              class="flex flex-wrap items-center justify-between gap-x-3 text-xs text-slate-500"
            >
              <span>{{ metaLine(item) }}</span>
              <span class="font-mono">{{ item.code === '' ? 'Tiada kod' : item.code }}</span>
            </span>
          </button>
          <p
            v-if="showEmpty"
            class="px-3 py-3 text-center text-sm text-slate-500"
            data-testid="gen-empty"
          >
            Tiada sekolah dijumpai
          </p>
        </div>
      </div>
    </div>

    <!-- FR-M02-28: chosen school -->
    <div
      v-else
      class="relative rounded-2xl border border-indigo-200 bg-linear-to-br from-indigo-50 to-white p-4"
      data-testid="gen-chosen"
    >
      <div class="flex flex-wrap items-center gap-2 pr-12">
        <span class="text-xs font-bold tracking-wide text-indigo-600 uppercase"
          >Sekolah Dipilih</span
        >
        <span
          v-if="school.code !== ''"
          class="rounded-md bg-indigo-600 px-2 py-0.5 font-mono text-xs font-bold text-white"
        >
          {{ school.code }}
        </span>
      </div>
      <p class="mt-1 text-base font-bold break-words text-slate-800">{{ school.name }}</p>
      <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
        <span class="inline-flex items-center gap-1.5">
          <Landmark class="h-3.5 w-3.5 text-blue-500" aria-hidden="true" />
          {{ school.state }}
        </span>
        <span v-if="school.district" class="inline-flex items-center gap-1.5">
          <Building class="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
          {{ school.district }}
        </span>
        <span class="inline-flex items-center gap-1.5">
          <Tag class="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
          {{ school.type }}
        </span>
      </div>
      <button
        type="button"
        title="Reset"
        class="absolute top-1 right-1 inline-flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        data-testid="gen-reset"
        @click="reset"
      >
        <CircleX class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>

    <!-- FR-M02-29: the generate button -->
    <div v-if="school && !generated" class="space-y-2">
      <button
        type="button"
        :disabled="!hasCode || generating"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-emerald-500 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:from-emerald-600 hover:to-teal-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="gen-generate"
        @click="emit('generate')"
      >
        <LoaderCircle v-if="generating" class="h-4 w-4 animate-spin" aria-hidden="true" />
        <WandSparkles v-else class="h-4 w-4" aria-hidden="true" />
        Janakan Akaun Admin Sekolah
      </button>
      <p
        v-if="!hasCode"
        class="flex items-start gap-2 text-sm text-amber-700"
        data-testid="gen-no-code"
      >
        <TriangleAlert class="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Sekolah ini tiada kod KPM. Sila kemaskini kod sekolah di halaman Sekolah terlebih dahulu.
      </p>
    </div>

    <!-- FR-M02-30: generated credentials -->
    <div
      v-if="school && generated"
      class="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4"
      data-testid="gen-box"
    >
      <p
        class="mb-3 flex items-center gap-2 text-sm font-bold tracking-wide text-emerald-700 uppercase"
      >
        <CircleCheck class="h-4 w-4" aria-hidden="true" />
        Maklumat Dijana
      </p>
      <div class="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
        <div>
          <label for="gen-name" :class="LABEL">Nama Pentadbir</label>
          <input
            id="gen-name"
            v-model="name"
            type="text"
            name="name"
            required
            :class="[FIELD, EDITABLE]"
            data-testid="gen-name"
          />
        </div>
        <div>
          <label for="gen-email" :class="LABEL">ID Login (Emel)</label>
          <div class="flex items-center gap-1">
            <input
              id="gen-email"
              type="text"
              name="email"
              required
              readonly
              :value="email"
              :class="[FIELD, READONLY]"
              data-testid="gen-email"
            />
            <button
              type="button"
              title="Salin"
              :class="COPY_BUTTON"
              data-testid="gen-copy-email"
              @click="emit('copy', email)"
            >
              <Copy class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div>
          <label for="gen-password" :class="LABEL">Kata Laluan</label>
          <div class="flex items-center gap-1">
            <input
              id="gen-password"
              type="text"
              readonly
              :value="props.password"
              :class="[FIELD, READONLY]"
              data-testid="gen-password"
            />
            <button
              type="button"
              title="Salin"
              :class="COPY_BUTTON"
              data-testid="gen-copy-password"
              @click="emit('copy', props.password)"
            >
              <Copy class="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div>
          <label for="gen-phone" :class="LABEL">Telefon (Pilihan)</label>
          <input
            id="gen-phone"
            v-model="phone"
            type="tel"
            name="phone"
            maxlength="14"
            inputmode="tel"
            placeholder="012-345 6789"
            :class="[FIELD, EDITABLE]"
            data-testid="gen-phone"
          />
        </div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2 border-t border-emerald-200 pt-3">
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700"
          data-testid="gen-jpn"
        >
          <Landmark class="h-3.5 w-3.5" aria-hidden="true" />
          JPN: {{ school.state }}
        </span>
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700"
          data-testid="gen-ppd"
        >
          <Building class="h-3.5 w-3.5" aria-hidden="true" />
          PPD: {{ school.district ?? '' }}
        </span>
      </div>
    </div>
  </div>
</template>
