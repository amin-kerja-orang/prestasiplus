<script setup lang="ts">
/**
 * S2 `school_admin` section (FR-M02-27…31, BR-09): "Cari Sekolah *" search, the "Sekolah Dipilih" panel
 * with its reset button, the "Janakan Akaun Admin Sekolah" button (disabled without a school code, with
 * the DV-M02-12 warning) and the "Maklumat Dijana" box (name, login e-mail, default password, phone, JPN /
 * PPD badges). The page owns the state (school, generated flag, name, phone), the default password, the
 * clipboard and the "Disalin!" toast: this component emits `generate` and `copy`.
 */
import { computed, ref } from 'vue'

import { useSearchPicker } from '@/composables'

import { DsFormField, DsPanel, DsCluster, DsStack, DsText } from '@/ds'

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

function onInput(value: string): void {
  picker.setTerm(value)
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
</script>

<template>
  <div ref="root" class="flex flex-col gap-4" data-testid="school-admin-generator">
    <!-- FR-M02-27: search -->
    <DsFormField v-if="!school" native for="gen-search" label="Cari Sekolah" required>
      <div class="relative">
        <UInput
          id="gen-search"
          :model-value="term"
          type="text"
          autocomplete="off"
          placeholder="Taipkan nama sekolah atau kod sekolah (cth: JBA0001)..."
          :loading="searching"
          class="w-full"
          data-testid="gen-search"
          @update:model-value="onInput"
          @focus="picker.onFocus()"
        />
        <span v-if="searching" class="sr-only" data-testid="gen-loading">Mencari...</span>
        <DsPanel v-if="showDropdown" behavior="float" padding="none" data-testid="gen-dropdown">
          <UButton
            v-for="item in results"
            :key="item.id"
            type="button"
            block
            color="neutral"
            variant="ghost"
            class="h-auto min-h-11 justify-start text-start whitespace-normal"
            data-testid="gen-result"
            @click="picker.select(item)"
          >
            <span class="flex w-full min-w-0 flex-col">
              <DsText variant="label" tone="highlighted">{{ item.name }}</DsText>
              <span
                class="flex flex-wrap items-center justify-between gap-x-3 text-caption text-muted"
              >
                <span>{{ metaLine(item) }}</span>
                <span>{{ item.code === '' ? 'Tiada kod' : item.code }}</span>
              </span>
            </span>
          </UButton>
          <p v-if="showEmpty" class="p-3 text-center text-label text-muted" data-testid="gen-empty">
            Tiada sekolah dijumpai
          </p>
        </DsPanel>
      </div>
    </DsFormField>

    <!-- FR-M02-28: chosen school -->
    <DsPanel v-else tone="tint" data-testid="gen-chosen">
      <DsCluster align="start" :wrap="false">
        <div class="flex min-w-0 flex-1 flex-col gap-1">
          <DsCluster gap="xs">
            <DsText variant="overline" tone="primary">Sekolah Dipilih</DsText>
            <UBadge v-if="school.code !== ''" :label="school.code" />
          </DsCluster>
          <DsText variant="body" tone="highlighted" wrap="anywhere">{{ school.name }}</DsText>
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
            <span class="inline-flex items-center gap-1">
              <UIcon name="i-ph-bank" class="size-4" aria-hidden="true" />
              {{ school.state }}
            </span>
            <span v-if="school.district" class="inline-flex items-center gap-1">
              <UIcon name="i-ph-buildings" class="size-4" aria-hidden="true" />
              {{ school.district }}
            </span>
            <span class="inline-flex items-center gap-1">
              <UIcon name="i-ph-tag" class="size-4" aria-hidden="true" />
              {{ school.type }}
            </span>
          </div>
        </div>
        <UButton
          type="button"
          color="error"
          variant="ghost"
          icon="i-ph-x-circle"
          title="Reset"
          aria-label="Reset"
          data-testid="gen-reset"
          @click="reset"
        />
      </DsCluster>
    </DsPanel>

    <!-- FR-M02-29: the generate button -->
    <DsStack v-if="school && !generated" gap="xs">
      <div>
        <UButton
          type="button"
          icon="i-ph-magic-wand"
          label="Janakan Akaun Admin Sekolah"
          :loading="generating"
          :disabled="!hasCode || generating"
          data-testid="gen-generate"
          @click="emit('generate')"
        />
      </div>
      <p
        v-if="!hasCode"
        class="flex items-start gap-2 text-label text-warning"
        data-testid="gen-no-code"
      >
        <UIcon name="i-ph-warning" class="mt-1 size-4 shrink-0" aria-hidden="true" />
        Sekolah ini tiada kod KPM. Sila kemaskini kod sekolah di halaman Sekolah terlebih dahulu.
      </p>
    </DsStack>

    <!-- FR-M02-30: generated credentials -->
    <DsPanel v-if="school && generated" tone="inset" data-testid="gen-box">
      <p class="mb-3 flex items-center gap-2 text-overline text-success">
        <UIcon name="i-ph-check-circle" class="size-4" aria-hidden="true" />
        Maklumat Dijana
      </p>
      <div class="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
        <DsFormField native for="gen-name" label="Nama Pentadbir">
          <UInput
            id="gen-name"
            v-model="name"
            type="text"
            name="name"
            required
            class="w-full"
            data-testid="gen-name"
          />
        </DsFormField>
        <DsFormField native for="gen-email" label="ID Login (Emel)">
          <DsCluster gap="2xs" :wrap="false">
            <UInput
              id="gen-email"
              type="text"
              name="email"
              required
              readonly
              :model-value="email"
              class="w-full"
              data-testid="gen-email"
            />
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="i-ph-copy"
              title="Salin"
              aria-label="Salin emel"
              data-testid="gen-copy-email"
              @click="emit('copy', email)"
            />
          </DsCluster>
        </DsFormField>
        <DsFormField native for="gen-password" label="Kata Laluan">
          <DsCluster gap="2xs" :wrap="false">
            <UInput
              id="gen-password"
              type="text"
              readonly
              :model-value="props.password"
              class="w-full"
              data-testid="gen-password"
            />
            <UButton
              type="button"
              color="neutral"
              variant="ghost"
              icon="i-ph-copy"
              title="Salin"
              aria-label="Salin kata laluan"
              data-testid="gen-copy-password"
              @click="emit('copy', props.password)"
            />
          </DsCluster>
        </DsFormField>
        <DsFormField native for="gen-phone" label="Telefon (Pilihan)">
          <UInput
            id="gen-phone"
            v-model="phone"
            type="tel"
            name="phone"
            maxlength="14"
            inputmode="tel"
            placeholder="012-345 6789"
            class="w-full"
            data-testid="gen-phone"
          />
        </DsFormField>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <UBadge
          color="neutral"
          variant="subtle"
          icon="i-ph-bank"
          :label="`JPN: ${school.state}`"
          data-testid="gen-jpn"
        />
        <UBadge
          color="neutral"
          variant="subtle"
          icon="i-ph-buildings"
          :label="`PPD: ${school.district ?? ''}`"
          data-testid="gen-ppd"
        />
      </div>
    </DsPanel>
  </div>
</template>
