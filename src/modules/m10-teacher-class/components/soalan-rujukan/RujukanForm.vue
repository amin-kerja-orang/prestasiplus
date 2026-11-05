<script setup lang="ts">
/**
 * The form of `/guru/soalan-guru/cipta` and `/:id/sunting` (PRD-20 R1-GUR-44a; FR-GUR-44a-2, -3, -5, -7, -8): one private
 * multiple-choice question with an optional reference link. Subjek, Tahap (Tingkatan 1 to 5), Bab, SP, TP, Aras
 * (required only where they exist, `dskp-rule.ts`, D112), Kesukaran (1 to 5 stars; min(5, TP) until it is touched), the
 * text, the Pautan Rujukan (http or https only) and four options with one correct radio each. No native validation
 * (`novalidate`): every missing field shows its BM text under the field and nothing is sent. Server `fields` show under
 * their field too and the typed values are kept.
 */
import {
  DsCluster,
  DsFormField,
  DsFormSection,
  DsGrid,
  DsLoadError,
  DsNativeSelect,
  DsPanel,
  DsStack,
  DsText,
} from '@/ds'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'

import { COGNITIVE_OPTIONS } from '@/modules/m04-question-bank'

import type { PersonalQuestion, PersonalQuestionRequest } from '../../api/personal-questions-types'
import { fetchLevelOptions, fetchSubjectOptions, type NamedLookup } from '../soalan/data'
import { DSKP_EMPTY, TP_VALUES, dskpRequired } from '../soalan/dskp-rule'
import {
  chapterLabel,
  COPY,
  DIFFICULTY_OPTIONS,
  difficultyFromTp,
  OPTION_LETTERS,
  spLabel,
} from '../soalan/lib'
import { buildBody, emptyValues, validateForm, valuesOf, type RujukanField } from './form'
import { useDskpPair } from './use-dskp-pair'

const props = withDefaults(
  defineProps<{
    saving: boolean
    general: string[]
    fields: Record<string, string>
    /** The saved question of the edit page: every field is preloaded. */
    initial?: PersonalQuestion
    cancelTo?: string
  }>(),
  { initial: undefined, cancelTo: '/guru/soalan-guru' },
)
const emit = defineEmits<{ submit: [body: PersonalQuestionRequest] }>()

const v = reactive(props.initial ? valuesOf(props.initial) : emptyValues())
const difficultyTouched = ref(props.initial !== undefined)

// --- lookups ---------------------------------------------------------------------------------
const levels = ref<NamedLookup[]>([])
const subjects = ref<NamedLookup[]>([])
const levelId = computed({ get: () => v.levelId, set: (x: string) => (v.levelId = x) })
const subjectId = computed({ get: () => v.subjectId, set: (x: string) => (v.subjectId = x) })
const pair = useDskpPair(levelId, subjectId)
const lookupError = ref(false)

async function loadLookups(): Promise<void> {
  lookupError.value = false
  try {
    ;[levels.value, subjects.value] = await Promise.all([
      fetchLevelOptions(),
      fetchSubjectOptions(),
    ])
  } catch {
    lookupError.value = true
  }
}
onMounted(loadLookups)

/** The edit preload: load the lists of the saved pair and re-select the saved Bab / SP once they arrive. */
if (props.initial) {
  const saved = { chapterId: v.chapterId, spId: v.spId }
  void pair.load().then(() => {
    if (pair.chapters.value.some((c) => String(c.id) === saved.chapterId))
      v.chapterId = saved.chapterId
    if (pair.sps.value.some((s) => String(s.id) === saved.spId)) v.spId = saved.spId
  })
}
watch(
  () => [v.levelId, v.subjectId] as const,
  () => {
    v.chapterId = ''
    v.spId = ''
    void pair.load()
  },
)

const need = computed(() => dskpRequired(pair.ctx.value))
const chapterOptions = computed(() =>
  pair.chapters.value.map((c) => ({ value: String(c.id), label: chapterLabel(c) })),
)
const spOptions = computed(() =>
  pair.sps.value.map((s) => ({ value: String(s.id), label: spLabel(s) })),
)

// --- Kesukaran: min(5, TP) once a TP is chosen and until the teacher touches it ----------------
watch(
  () => v.tp,
  (tp) => {
    const n = Number(tp)
    if (!difficultyTouched.value && tp !== '' && Number.isInteger(n)) {
      v.difficulty = String(difficultyFromTp(n))
    }
  },
)
function pickDifficulty(value: string | number): void {
  difficultyTouched.value = true
  v.difficulty = String(value)
}

// --- submit and errors -----------------------------------------------------------------------
const clientErrors = ref<Partial<Record<RujukanField, string>>>({})
/** The text under a field: the client check first, else the server's `fields.<name>`. */
const err = (name: RujukanField): string | undefined =>
  clientErrors.value[name] ?? props.fields[name]
const errorCount = computed(() => Object.keys(clientErrors.value).length)

const FOCUS_ID: Record<RujukanField, string> = {
  subjectId: 'r-subject',
  educationLevelId: 'r-level',
  chapterId: 'r-chapter',
  spIds: 'r-sp',
  tp: 'r-tp',
  cognitiveLevel: 'r-aras',
  difficulty: 'r-difficulty',
  text: 'r-text',
  referenceUrl: 'r-url',
  options: 'r-option-0',
  correctIndex: 'r-correct-0',
}

async function submit(): Promise<void> {
  const found = validateForm(v, pair.ctx.value)
  clientErrors.value = found
  const first = (Object.keys(FOCUS_ID) as RujukanField[]).find((k) => found[k] !== undefined)
  if (first) {
    await nextTick()
    const id = FOCUS_ID[first]
    ;(document.getElementById(id) ?? document.querySelector<HTMLElement>(`[id^="${id}"]`))?.focus()
    return
  }
  emit('submit', buildBody(v))
}
</script>

<template>
  <DsStack as="form" novalidate data-testid="rujukan-form" @submit.prevent="submit">
    <UAlert
      v-if="general.length"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      role="alert"
      data-testid="form-errors"
    >
      <template #description>
        <p v-for="(m, i) in general" :key="i">{{ m }}</p>
      </template>
    </UAlert>
    <UAlert
      v-if="errorCount > 0"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      role="alert"
      :description="`${String(errorCount)} medan perlu dibetulkan.`"
      data-testid="form-banner"
    />
    <DsLoadError
      v-if="lookupError"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      variant="inline"
      testid="rujukan-lookup-error"
      @retry="loadLookups"
    />

    <DsFormSection
      title="Soalan MCQ Peribadi"
      description="Soalan ini hanya kelihatan kepada pelajar anda melalui Misi Harian."
      icon="book-open"
      accent="action"
      data-testid="rujukan-info"
    >
      <DsGrid :cols="{ base: 1, md: 2 }">
        <DsFormField native label="Subjek" for="r-subject" required :error="err('subjectId')">
          <template #default="{ id, describedby, invalid }">
            <DsNativeSelect
              :id="id"
              v-model="v.subjectId"
              name="subject_id"
              :aria-describedby="describedby"
              :invalid="invalid"
              data-testid="r-subject"
            >
              <option value="">-- Pilih subjek --</option>
              <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
            </DsNativeSelect>
          </template>
        </DsFormField>
        <DsFormField native label="Tahap" for="r-level" required :error="err('educationLevelId')">
          <template #default="{ id, describedby, invalid }">
            <DsNativeSelect
              :id="id"
              v-model="v.levelId"
              name="education_level_id"
              :aria-describedby="describedby"
              :invalid="invalid"
              data-testid="r-level"
            >
              <option value="">-- Pilih tahap --</option>
              <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
            </DsNativeSelect>
          </template>
        </DsFormField>
      </DsGrid>

      <DsLoadError
        v-if="pair.lookupFailed.value"
        :message="COPY.loadFailed"
        :retry-label="COPY.retry"
        variant="inline"
        testid="dskp-lookup-error"
        @retry="pair.load"
      />
      <DsGrid :cols="{ base: 1, md: 2 }">
        <DsFormField
          native
          label="Bab"
          for="r-chapter"
          :required="need.chapterId"
          :error="err('chapterId')"
        >
          <template #default="{ id, describedby, invalid }">
            <DsNativeSelect
              :id="id"
              v-model="v.chapterId"
              name="chapter_id"
              :disabled="!pair.ready.value || pair.chapters.value.length === 0"
              :aria-describedby="describedby"
              :invalid="invalid"
              data-testid="r-chapter"
            >
              <option value="">
                {{ pair.noChapters.value ? DSKP_EMPTY.chapter : '-- Pilih bab --' }}
              </option>
              <option v-for="c in chapterOptions" :key="c.value" :value="c.value">
                {{ c.label }}
              </option>
            </DsNativeSelect>
          </template>
        </DsFormField>
        <DsFormField native label="SP" for="r-sp" :required="need.spIds" :error="err('spIds')">
          <template #default="{ id, describedby, invalid }">
            <DsNativeSelect
              :id="id"
              v-model="v.spId"
              name="sp_id"
              :disabled="!pair.ready.value || pair.sps.value.length === 0"
              :aria-describedby="describedby"
              :invalid="invalid"
              data-testid="r-sp"
            >
              <option value="">{{ pair.noSps.value ? DSKP_EMPTY.sp : '-- Pilih SP --' }}</option>
              <option v-for="o in spOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </DsNativeSelect>
          </template>
        </DsFormField>
        <DsFormField native label="TP" for="r-tp" :required="need.tp" :error="err('tp')">
          <template #default="{ id, describedby, invalid }">
            <DsNativeSelect
              :id="id"
              v-model="v.tp"
              name="tp"
              :aria-describedby="describedby"
              :invalid="invalid"
              data-testid="r-tp"
            >
              <option value="">-- Pilih TP --</option>
              <option v-for="n in TP_VALUES" :key="n" :value="String(n)">{{ n }}</option>
            </DsNativeSelect>
          </template>
        </DsFormField>
        <DsFormField
          native
          label="Aras Pemikiran"
          for="r-aras"
          :required="need.cognitiveLevel"
          :error="err('cognitiveLevel')"
        >
          <template #default="{ id, describedby, invalid }">
            <DsNativeSelect
              :id="id"
              v-model="v.cognitiveLevel"
              name="cognitive_level"
              :aria-describedby="describedby"
              :invalid="invalid"
              data-testid="r-aras"
            >
              <option value="">-- Pilih aras --</option>
              <option v-for="c in COGNITIVE_OPTIONS" :key="c.value" :value="c.value">
                {{ c.label }}
              </option>
            </DsNativeSelect>
          </template>
        </DsFormField>
      </DsGrid>

      <DsFormField native label="Kesukaran" for="r-difficulty" required :error="err('difficulty')">
        <template #default="{ id, describedby, invalid }">
          <DsNativeSelect
            :id="id"
            :model-value="v.difficulty"
            name="difficulty"
            :aria-describedby="describedby"
            :invalid="invalid"
            data-testid="r-difficulty"
            @update:model-value="pickDifficulty"
          >
            <option value="">-- Pilih kesukaran --</option>
            <option v-for="d in DIFFICULTY_OPTIONS" :key="d.value" :value="String(d.value)">
              {{ d.label }}
            </option>
          </DsNativeSelect>
        </template>
      </DsFormField>

      <DsFormField native label="Teks Soalan" for="r-text" required :error="err('text')">
        <template #default="{ id, describedby, invalid }">
          <UTextarea
            :id="id"
            v-model="v.text"
            name="text"
            :rows="4"
            maxlength="2000"
            :aria-describedby="describedby"
            :aria-invalid="invalid ? 'true' : undefined"
            class="w-full"
            data-testid="r-text"
          />
        </template>
      </DsFormField>

      <DsFormField
        native
        label="Pautan Rujukan (pilihan)"
        for="r-url"
        hint="Video YouTube, Anyflip, PDF atau apa-apa link rujukan."
        :error="err('referenceUrl')"
      >
        <template #default="{ id, describedby, invalid }">
          <UInput
            :id="id"
            v-model="v.referenceUrl"
            type="url"
            name="reference_url"
            inputmode="url"
            :aria-describedby="describedby"
            :aria-invalid="invalid ? 'true' : undefined"
            class="w-full"
            data-testid="r-url"
          />
        </template>
      </DsFormField>

      <DsStack as="fieldset" gap="sm" data-testid="r-options">
        <DsText as="legend" variant="label" tone="default">
          Pilihan Jawapan <span aria-hidden="true">*</span> (pilih jawapan betul)
        </DsText>
        <DsPanel
          v-for="(letter, i) in OPTION_LETTERS"
          :key="letter"
          tone="inset"
          :data-testid="`r-option-row-${String(i)}`"
        >
          <DsCluster :wrap="false" gap="sm">
            <URadioGroup
              :id="`r-correct-${String(i)}`"
              :model-value="v.correct === i ? i : undefined"
              :legend="`Pilihan ${letter} ialah jawapan betul`"
              :items="[{ label: letter, value: i }]"
              class="min-h-11 shrink-0"
              :data-testid="`r-correct-${String(i)}`"
              @update:model-value="v.correct = i"
            />
            <UInput
              :id="`r-option-${String(i)}`"
              v-model="v.options[i]"
              type="text"
              :name="`options[${String(i)}][text]`"
              maxlength="500"
              :aria-label="`Pilihan ${letter}`"
              class="min-w-0 grow"
              :data-testid="`r-option-${String(i)}`"
            />
          </DsCluster>
        </DsPanel>
        <DsText variant="caption" tone="muted">Butang radio menandakan jawapan yang betul.</DsText>
        <DsText v-if="err('options')" variant="caption" tone="error" role="alert">{{
          err('options')
        }}</DsText>
        <DsText v-if="err('correctIndex')" variant="caption" tone="error" role="alert">{{
          err('correctIndex')
        }}</DsText>
      </DsStack>
    </DsFormSection>

    <DsCluster justify="between" :wrap="false">
      <UButton
        :to="cancelTo"
        color="neutral"
        variant="ghost"
        icon="i-ph-x"
        class="min-h-11"
        data-testid="form-cancel"
        >Batal</UButton
      >
      <UButton
        type="submit"
        :loading="saving"
        :disabled="saving"
        :icon="saving ? undefined : 'i-ph-paper-plane-tilt-duotone'"
        class="min-h-11"
        data-testid="form-submit"
        >{{ saving ? 'Menyimpan...' : 'Simpan Soalan' }}</UButton
      >
    </DsCluster>
  </DsStack>
</template>
