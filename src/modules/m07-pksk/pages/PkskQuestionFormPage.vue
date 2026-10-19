<script setup lang="ts">
/**
 * S6 `/admin/pksk/questions/create` "Tambah Soalan PKSK" and S7 `/admin/pksk/questions/:id/edit`
 * "Edit Soalan PKSK" (M07-T3; FR-M07-33..44), v2 staff theme. One page for both: `mode="create"` posts a new
 * question ("Simpan Soalan"), `mode="edit"` loads #9 and pre-fills the form ("Kemaskini").
 *
 * - Native HTML validation only (`required`, no `novalidate`, no custom message, FR-M07-38). Fields are grouped
 *   in cards (two columns from `md`); "Kembali" and the submit button sit in a sticky action bar.
 * - S6: changing Bahagian refilters the domain list and resets the domain only (DV-M07-08); while
 *   Bahagian is C the options card is hidden and its inputs are disabled, so a C question can be
 *   saved (DV-M07-05). Options 2-6, "Betul" only for B.
 * - S7: no Bahagian select; the options card follows the saved Bahagian (not rendered for C) and
 *   the domain change does not alter it. An unknown id shows the standard 404 page (FR-M07-18).
 * - 422: the field messages show under the fields in red and the input is kept (L-5, INFERRED).
 *   Success queues the flash and opens S5.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import { useApi, useFlash, usePageMeta } from '@/composables'
import {
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
} from '@/ds'

import {
  createPkskQuestion,
  fetchPkskQuestion,
  updatePkskQuestion,
  type PkskOptionInput,
  type QuestionStatus,
} from '../api/admin'
import { fetchPkskDomains } from '../api/pksk'
import type { Bahagian, PkskLevel } from '../api/types'
import OptionsCard from '../components/OptionsCard.vue'
import {
  BAHAGIAN_CREATE_OPTIONS,
  DIFFICULTY_CREATE_OPTIONS,
  LEVEL_CREATE_OPTIONS,
  QUESTIONS_PATH,
  STATUS_OPTIONS,
  errorLines,
  fieldErrors,
  newOption,
  type OptionRow,
} from '../lib/admin'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: string }>(), { id: '' })

const router = useRouter()
const flash = useFlash()
const pageMeta = usePageMeta()

const editing = computed(() => props.mode === 'edit')
const numericId = computed(() => (/^\d+$/.test(props.id) ? Number(props.id) : null))

// DV-M07-02: the live subtitle prints raw Blade; the rebuild prints the id (follows the id param).
watch(
  () => props.id,
  (id) => {
    if (props.mode === 'edit') {
      pageMeta.setHeader({ title: 'Edit Soalan PKSK', subtitle: `Kemaskini soalan #${id}` })
    }
  },
  { immediate: true },
)

const form = reactive<{
  bahagian: Bahagian | ''
  domainId: string
  level: PkskLevel
  status: QuestionStatus
  text: string
  difficulty: string
  explanation: string
}>({
  bahagian: '',
  domainId: '',
  level: 'T1',
  status: 'approved',
  text: '',
  difficulty: editing.value ? '' : '3',
  explanation: '',
})
const options = ref<OptionRow[]>(
  editing.value ? [] : [newOption(), newOption(), newOption(), newOption()],
)
/** S7: the Bahagian saved with the question (the options card follows it). */
const savedBahagian = ref<Bahagian | null>(null)

// The 15 domains come from #2 (FR-M07-61), never hard-coded.
const {
  data: domains,
  error: domainsError,
  reload: reloadDomains,
} = useApi((signal) => fetchPkskDomains({ signal }))

// S7: #9 pre-fills the form.
const {
  data: loaded,
  error: loadError,
  reload: reloadLoaded,
} = useApi(
  (signal) => fetchPkskQuestion(numericId.value ?? 0, { signal }),
  () => props.id,
  {
    immediate: props.mode === 'edit' && numericId.value !== null,
  },
)

watch(
  loaded,
  (q) => {
    if (!q) return
    savedBahagian.value = q.bahagian
    form.domainId = String(q.pkskDomainId)
    form.level = q.pkskTargetLevel
    form.status = q.status
    form.text = q.questionText
    form.difficulty = q.difficultyLevel === null ? '' : String(q.difficultyLevel)
    form.explanation = q.explanation ?? ''
    options.value = q.options.map((o) => newOption(o.text, o.isCorrect))
  },
  { immediate: true },
)

watch(loadError, (err) => {
  if (isApiError(err) && err.status === 404) setRouteOutcome(404)
})
if (props.mode === 'edit' && numericId.value === null) setRouteOutcome(404)

function retryLoad(): void {
  void reloadDomains()
  if (editing.value) void reloadLoaded()
}

const loadFailed = computed(
  () =>
    loadError.value !== null && !(isApiError(loadError.value) && loadError.value.status === 404),
)
const ready = computed(() => domains.value !== null && (!editing.value || loaded.value !== null))

/** S6: the domains of the chosen Bahagian by plain name (all 15 when none). */
const createDomains = computed(() =>
  (domains.value ?? []).filter((d) => form.bahagian === '' || d.bahagian === form.bahagian),
)

/** DV-M07-08: a Bahagian change resets the domain only (display and value). */
function onBahagianChange(): void {
  form.domainId = ''
}

// Options card visibility (S6: unless Bahagian C; S7: the saved Bahagian is A or B).
const optionsShown = computed(() =>
  editing.value ? savedBahagian.value !== 'C' : form.bahagian !== 'C',
)
const showCorrect = computed(() =>
  editing.value ? savedBahagian.value === 'B' : form.bahagian === 'B',
)

const saving = ref(false)
const topErrors = ref<string[]>([])
const fieldMessages = ref<Record<string, string>>({})
const FIELD_NAMES = [
  'bahagian',
  'pkskDomainId',
  'pkskTargetLevel',
  'status',
  'questionText',
  'difficultyLevel',
]

/** S6: a correct flag is only posted for Bahagian B (a tick kept after switching to A is dropped). */
function optionBody(onlyB = false): PkskOptionInput[] {
  return options.value.map((o) => ({
    text: o.text,
    isCorrect: onlyB && form.bahagian !== 'B' ? false : o.isCorrect,
  }))
}

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  topErrors.value = []
  fieldMessages.value = {}
  const explanation = form.explanation.trim()
  try {
    const result =
      editing.value && numericId.value !== null
        ? await updatePkskQuestion(numericId.value, {
            pkskDomainId: Number(form.domainId),
            pkskTargetLevel: form.level,
            status: form.status,
            questionText: form.text,
            ...(form.difficulty !== '' ? { difficultyLevel: Number(form.difficulty) } : {}),
            explanation,
            ...(optionsShown.value ? { options: optionBody() } : {}),
          })
        : await createPkskQuestion({
            bahagian: form.bahagian as Bahagian,
            pkskDomainId: Number(form.domainId),
            pkskTargetLevel: form.level,
            questionText: form.text,
            difficultyLevel: Number(form.difficulty),
            ...(explanation !== '' ? { explanation } : {}),
            // Bahagian C holds no options: nothing is sent (DV-M07-05).
            ...(form.bahagian !== 'C' ? { options: optionBody(true) } : {}),
          })
    flash.success(result.status)
    await router.push(QUESTIONS_PATH)
  } catch (err) {
    const fields = fieldErrors(err)
    fieldMessages.value = fields
    const unmatched = Object.entries(fields)
      .filter(([name]) => !FIELD_NAMES.includes(name))
      .map(([, text]) => text)
    topErrors.value = Object.keys(fields).length === 0 ? errorLines(err) : unmatched
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage data-testid="pksk-question-form-page">
    <DsLoadError
      v-if="loadFailed || domainsError"
      :message="errorLines(loadError ?? domainsError).join(' ')"
      testid="pksk-form-load-error"
      @retry="retryLoad"
    />

    <DsPanel v-else-if="!ready" data-testid="pksk-form-skeleton">
      <div class="flex flex-col gap-6">
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </div>
    </DsPanel>

    <form
      v-else
      method="post"
      class="flex min-w-0 flex-col gap-6"
      data-testid="pksk-question-form"
      @submit.prevent="submit"
    >
      <UAlert
        v-if="topErrors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        data-testid="pksk-form-alert"
      >
        <template #description>
          <p v-for="m in topErrors" :key="m">{{ m }}</p>
        </template>
      </UAlert>

      <!-- Card 1: Bahagian & Domain (S6) / Domain, Sasaran, Status (S7). -->
      <DsFormSection
        title="Bahagian & Domain"
        icon="squares-four"
        accent="friend"
        :columns="2"
      >
        <DsFormField
          v-if="!editing"
          native
          for="q-bahagian"
          label="Bahagian"
          :error="fieldMessages.bahagian"
        >
          <template #default="{ id: fid, describedby, invalid }">
            <DsNativeSelect
              :id="fid"
              v-model="form.bahagian"
              name="bahagian"
              required
              placeholder="-- Pilih --"
              :items="BAHAGIAN_CREATE_OPTIONS"
              :invalid="invalid"
              :aria-describedby="describedby"
              data-testid="q-bahagian"
              @change="onBahagianChange"
            />
          </template>
        </DsFormField>

        <DsFormField native for="q-domain" label="Domain" :error="fieldMessages.pkskDomainId">
          <template #default="{ id: fid, describedby, invalid }">
            <DsNativeSelect
              :id="fid"
              v-model="form.domainId"
              name="pksk_domain_id"
              required
              :placeholder="editing ? false : '-- Pilih domain --'"
              :invalid="invalid"
              :aria-describedby="describedby"
              data-testid="q-domain"
            >
              <template v-if="editing">
                <option v-for="d in domains ?? []" :key="d.id" :value="String(d.id)">
                  [{{ d.bahagian }}] {{ d.name }}
                </option>
              </template>
              <template v-else>
                <option v-for="d in createDomains" :key="d.id" :value="String(d.id)">
                  {{ d.name }}
                </option>
              </template>
            </DsNativeSelect>
          </template>
        </DsFormField>

        <DsFormField native for="q-level" label="Sasaran" :error="fieldMessages.pkskTargetLevel">
          <template #default="{ id: fid, describedby, invalid }">
            <DsNativeSelect
              :id="fid"
              v-model="form.level"
              name="pksk_target_level"
              required
              :invalid="invalid"
              :aria-describedby="describedby"
              data-testid="q-level"
            >
              <template v-if="editing">
                <option value="T1">Tingkatan 1</option>
                <option value="T4">Tingkatan 4</option>
              </template>
              <template v-else>
                <option v-for="o in LEVEL_CREATE_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </template>
            </DsNativeSelect>
          </template>
        </DsFormField>

        <DsFormField
          v-if="editing"
          native
          for="q-status"
          label="Status"
          :error="fieldMessages.status"
        >
          <template #default="{ id: fid, describedby, invalid }">
            <DsNativeSelect
              :id="fid"
              v-model="form.status"
              name="status"
              required
              :items="STATUS_OPTIONS"
              :invalid="invalid"
              :aria-describedby="describedby"
              data-testid="q-status"
            />
          </template>
        </DsFormField>
      </DsFormSection>

      <!-- Card 2: Soalan. -->
      <DsFormSection title="Soalan" icon="question" accent="heat" :columns="2">
        <div class="sm:col-span-2">
          <DsFormField
            native
            for="q-text"
            :label="editing ? 'Soalan' : 'Teks Soalan'"
            :error="fieldMessages.questionText"
          >
            <template #default="{ id: fid, describedby, invalid }">
              <UTextarea
                :id="fid"
                v-model="form.text"
                name="question_text"
                :rows="5"
                required
                :placeholder="editing ? undefined : 'Tulis soalan di sini...'"
                class="w-full"
                :color="invalid ? 'error' : undefined"
                :aria-describedby="describedby"
                data-testid="q-text"
              />
            </template>
          </DsFormField>
        </div>

        <DsFormField
          native
          for="q-difficulty"
          :label="editing ? 'Kesukaran' : 'Tahap Kesukaran (1-5)'"
          :error="fieldMessages.difficultyLevel"
        >
          <template #default="{ id: fid, describedby, invalid }">
            <DsNativeSelect
              :id="fid"
              v-model="form.difficulty"
              name="difficulty_level"
              :required="!editing"
              :invalid="invalid"
              :aria-describedby="describedby"
              data-testid="q-difficulty"
            >
              <template v-if="editing">
                <option v-for="n in 5" :key="n" :value="String(n)">{{ n }}</option>
              </template>
              <template v-else>
                <option
                  v-for="o in DIFFICULTY_CREATE_OPTIONS"
                  :key="o.value"
                  :value="String(o.value)"
                >
                  {{ o.label }}
                </option>
              </template>
            </DsNativeSelect>
          </template>
        </DsFormField>

        <div class="sm:col-span-2">
          <DsFormField
            native
            for="q-explanation"
            :label="editing ? 'Penjelasan' : 'Penjelasan (Opsional)'"
          >
            <template #default="{ id: fid }">
              <UTextarea
                :id="fid"
                v-model="form.explanation"
                name="explanation"
                :rows="3"
                :placeholder="editing ? undefined : 'Penjelasan jawapan...'"
                class="w-full"
                data-testid="q-explanation"
              />
            </template>
          </DsFormField>
        </div>
      </DsFormSection>

      <!-- Card 3: Pilihan Jawapan (S7: not rendered for a saved Bahagian C). -->
      <OptionsCard
        v-if="!editing || savedBahagian !== 'C'"
        v-model="options"
        :shown="optionsShown"
        :disabled="!editing && form.bahagian === 'C'"
        :suffix="!editing && form.bahagian === 'A'"
        :show-correct="showCorrect"
        :placeholder="editing ? undefined : 'Teks pilihan'"
      />

      <DsFormBar
        :cancel-to="QUESTIONS_PATH"
        cancel-label="Kembali"
        :submit-label="editing ? 'Kemaskini' : 'Simpan Soalan'"
        :saving="saving"
      />
    </form>
  </DsPage>
</template>
