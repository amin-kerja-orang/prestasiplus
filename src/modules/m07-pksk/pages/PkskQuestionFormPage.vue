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
import { DsPage } from '@/ds'

import {
  createPkskQuestion,
  fetchPkskQuestion,
  updatePkskQuestion,
  type PkskOptionInput,
  type QuestionStatus,
} from '../api/admin'
import { fetchPkskDomains } from '../api/pksk'
import type { Bahagian, PkskLevel } from '../api/types'
import AdminAlert from '../components/admin/AdminAlert.vue'
import AdminField from '../components/admin/AdminField.vue'
import AdminFormBar from '../components/admin/AdminFormBar.vue'
import AdminSection from '../components/admin/AdminSection.vue'
import NativeSelect from '../components/admin/native/NativeSelect.vue'
import OptionsCard from '../components/admin/OptionsCard.vue'
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
const { data: domains, error: domainsError } = useApi((signal) => fetchPkskDomains({ signal }))

// S7: #9 pre-fills the form.
const { data: loaded, error: loadError } = useApi(
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

const invalid = (name: string): boolean => fieldMessages.value[name] !== undefined

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
    <AdminAlert
      v-if="loadFailed || domainsError"
      :messages="errorLines(loadError ?? domainsError)"
      data-testid="pksk-form-load-error"
    />

    <UCard v-else-if="!ready" data-testid="pksk-form-skeleton">
      <div class="flex flex-col gap-6">
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </div>
    </UCard>

    <form
      v-else
      method="post"
      class="flex min-w-0 flex-col gap-6"
      data-testid="pksk-question-form"
      @submit.prevent="submit"
    >
      <AdminAlert :messages="topErrors" data-testid="pksk-form-alert" />

      <!-- Card 1: Bahagian & Domain (S6) / Domain, Sasaran, Status (S7). -->
      <AdminSection title="Bahagian & Domain" icon="i-ph-squares-four" accent="friend">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <AdminField
            v-if="!editing"
            for="q-bahagian"
            label="Bahagian"
            :error="fieldMessages.bahagian"
          >
            <NativeSelect
              id="q-bahagian"
              v-model="form.bahagian"
              name="bahagian"
              required
              :aria-invalid="invalid('bahagian') ? 'true' : undefined"
              data-testid="q-bahagian"
              @change="onBahagianChange"
            >
              <option value="">-- Pilih --</option>
              <option v-for="o in BAHAGIAN_CREATE_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </NativeSelect>
          </AdminField>

          <AdminField for="q-domain" label="Domain" :error="fieldMessages.pkskDomainId">
            <NativeSelect
              id="q-domain"
              v-model="form.domainId"
              name="pksk_domain_id"
              required
              :aria-invalid="invalid('pkskDomainId') ? 'true' : undefined"
              data-testid="q-domain"
            >
              <template v-if="editing">
                <option v-for="d in domains ?? []" :key="d.id" :value="String(d.id)">
                  [{{ d.bahagian }}] {{ d.name }}
                </option>
              </template>
              <template v-else>
                <option value="">-- Pilih domain --</option>
                <option v-for="d in createDomains" :key="d.id" :value="String(d.id)">
                  {{ d.name }}
                </option>
              </template>
            </NativeSelect>
          </AdminField>

          <AdminField for="q-level" label="Sasaran" :error="fieldMessages.pkskTargetLevel">
            <NativeSelect
              id="q-level"
              v-model="form.level"
              name="pksk_target_level"
              required
              :aria-invalid="invalid('pkskTargetLevel') ? 'true' : undefined"
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
            </NativeSelect>
          </AdminField>

          <AdminField v-if="editing" for="q-status" label="Status" :error="fieldMessages.status">
            <NativeSelect
              id="q-status"
              v-model="form.status"
              name="status"
              required
              :aria-invalid="invalid('status') ? 'true' : undefined"
              data-testid="q-status"
            >
              <option v-for="o in STATUS_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </NativeSelect>
          </AdminField>
        </div>
      </AdminSection>

      <!-- Card 2: Soalan. -->
      <AdminSection title="Soalan" icon="i-ph-question" accent="heat">
        <AdminField
          for="q-text"
          :label="editing ? 'Soalan' : 'Teks Soalan'"
          :error="fieldMessages.questionText"
        >
          <UTextarea
            id="q-text"
            v-model="form.text"
            name="question_text"
            :rows="5"
            required
            :placeholder="editing ? undefined : 'Tulis soalan di sini...'"
            size="md"
            class="w-full"
            :color="invalid('questionText') ? 'error' : undefined"
            data-testid="q-text"
          />
        </AdminField>

        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <AdminField
            for="q-difficulty"
            :label="editing ? 'Kesukaran' : 'Tahap Kesukaran (1-5)'"
            :error="fieldMessages.difficultyLevel"
          >
            <NativeSelect
              id="q-difficulty"
              v-model="form.difficulty"
              name="difficulty_level"
              :required="!editing"
              :aria-invalid="invalid('difficultyLevel') ? 'true' : undefined"
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
            </NativeSelect>
          </AdminField>
        </div>

        <AdminField for="q-explanation" :label="editing ? 'Penjelasan' : 'Penjelasan (Opsional)'">
          <UTextarea
            id="q-explanation"
            v-model="form.explanation"
            name="explanation"
            :rows="3"
            :placeholder="editing ? undefined : 'Penjelasan jawapan...'"
            size="md"
            class="w-full"
            data-testid="q-explanation"
          />
        </AdminField>
      </AdminSection>

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

      <AdminFormBar
        :cancel-to="QUESTIONS_PATH"
        cancel-label="Kembali"
        cancel-testid="form-back"
        :submit-label="editing ? 'Kemaskini' : 'Simpan Soalan'"
        :saving="saving"
      />
    </form>
  </DsPage>
</template>
