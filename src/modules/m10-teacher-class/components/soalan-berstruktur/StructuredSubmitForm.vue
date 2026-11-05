<script setup lang="ts">
/**
 * The teacher form of "Soalan Berstruktur" (R1-GUR-44b field table, S6-T17): Tingkatan, Subjek, Bab, SP, TP,
 * Aras Pemikiran, Kesukaran, "Rangsangan" (text and an optional image), 1 to 10 repeatable sub-questions
 * (text, Markah 1 to 20, Skema Jawapan, Aras) and "Jumlah markah". It validates with the PRD's BM texts
 * (`validate`), keeps what was typed on a refusal, and emits `submit` with the checked values; the page uploads
 * the image and calls the API. Bab, SP, TP and Aras are required only where the Subjek + Tingkatan has chapters
 * or DSKP nodes (D112). `Buang` stays pressable at one part and answers with the PRD message instead of removing it.
 * The same form edits an own submission (`initial`).
 */
import { computed, reactive, ref, watch } from 'vue'

import {
  DsCluster,
  DsFileField,
  DsFormField,
  DsFormSection,
  DsGrid,
  DsNativeSelect,
  DsPanel,
  DsStack,
  DsText,
} from '@/ds'

import { fetchBidang, fetchChapters, fetchSk, fetchSp } from '../../api/guru'
import type { ChapterOption } from '../../api/types'
import {
  canAddPart,
  canRemovePart,
  COGNITIVE_LEVELS,
  DIFFICULTY_OPTIONS,
  emptyPart,
  emptyValues,
  fieldKeyOf,
  imageError,
  MAX_MARKS,
  MAX_PARTS,
  MIN_MARKS,
  PART_TEXT_MAX,
  SCHEME_MAX,
  STIMULUS_MAX,
  STRUCTURED_COPY,
  TP_OPTIONS,
  totalMarksText,
  validate,
  defaultDifficulty,
  type StructuredFormValues,
} from '../../lib/structured-form'
import { fetchLevelOptions, fetchSubjectOptions, type NamedLookup } from '../soalan/data'

const props = defineProps<{
  saving: boolean
  /** 422 `fields` / server messages of the last attempt, keyed like the API (`parts.0.marks`). */
  fields: Record<string, string>
  /** The saved values of an own submission (edit). */
  initial?: StructuredFormValues | null
  /** The saved image token of an edit; kept when no new file is chosen. */
  hasSavedImage?: boolean
}>()
const emit = defineEmits<{
  submit: [values: StructuredFormValues, image: File | null]
  cancel: []
}>()

const v = reactive<StructuredFormValues>(props.initial ?? emptyValues())
const image = ref<File | null>(null)
const local = ref<Record<string, string>>({})
const partsNotice = ref('')

const errors = computed<Record<string, string>>(() => {
  const merged: Record<string, string> = {}
  for (const [k, msg] of Object.entries(props.fields)) merged[fieldKeyOf(k)] = msg
  return { ...merged, ...local.value }
})

// --- lookups -------------------------------------------------------------------------------
const levels = ref<NamedLookup[]>([])
const subjects = ref<NamedLookup[]>([])
const chapters = ref<ChapterOption[]>([])
const sps = ref<{ id: number | string; label: string }[]>([])
const lookupsFor = ref('')
let seq = 0

void (async () => {
  try {
    const [l, s] = await Promise.all([fetchLevelOptions(), fetchSubjectOptions()])
    levels.value = l.filter((x) => /^Tingkatan/.test(x.name))
    subjects.value = s
  } catch {
    levels.value = []
    subjects.value = []
  }
})()

/** Bab of the chosen Subjek + Tingkatan, and every SP of its DSKP (Bidang -> SK -> SP, flattened). */
async function loadCurriculum(subjectId: string, levelId: string): Promise<void> {
  const token = ++seq
  const query = { subjectId: Number(subjectId), educationLevelId: Number(levelId) }
  try {
    const [bab, bidang] = await Promise.all([fetchChapters(query), fetchBidang(query)])
    const sks = (await Promise.all(bidang.map((b) => fetchSk(b.id)))).flat()
    const spLists = await Promise.all(sks.map((sk) => fetchSp(sk.id)))
    if (token !== seq) return
    chapters.value = [...bab].sort((a, b) => (a.chapterNumber ?? 0) - (b.chapterNumber ?? 0))
    sps.value = spLists.flat().map((s) => ({ id: s.id, label: `${s.code} ${s.description}` }))
  } catch {
    if (token !== seq) return
    chapters.value = []
    sps.value = []
  }
  if (token === seq) lookupsFor.value = `${subjectId}|${levelId}`
}

watch(
  () => [v.subjectId, v.levelId] as const,
  ([subjectId, levelId], old) => {
    const saved = props.initial
    // The saved Bab / SP of an edit survive the first load; any later change of Subjek or Tingkatan resets them.
    if (
      old !== undefined &&
      !(saved && saved.subjectId === subjectId && saved.levelId === levelId)
    ) {
      v.chapterId = ''
      v.spId = ''
    }
    chapters.value = []
    sps.value = []
    lookupsFor.value = ''
    seq += 1
    if (subjectId !== '' && levelId !== '') void loadCurriculum(subjectId, levelId)
  },
  { immediate: true },
)

const ready = computed(() => lookupsFor.value === `${v.subjectId}|${v.levelId}`)
const hasChapters = computed(() => ready.value && chapters.value.length > 0)
const hasDskpNodes = computed(() => ready.value && sps.value.length > 0)

// --- Kesukaran default (44-F1) and the parts' Aras default ------------------------------------
let difficultyTouched = v.difficulty !== ''
let settingDefault = false
// Any change that is not the TP default is the teacher's own choice.
watch(
  () => v.difficulty,
  () => {
    if (!settingDefault) difficultyTouched = true
  },
  { flush: 'sync' },
)
watch(
  () => v.tp,
  (tp) => {
    if (difficultyTouched) return
    settingDefault = true
    v.difficulty = defaultDifficulty(tp)
    settingDefault = false
  },
)
watch(
  () => v.cognitiveLevel,
  (now, before) => {
    // A part that still carries the question's previous Aras follows it.
    for (const p of v.parts) if (p.cognitiveLevel === before) p.cognitiveLevel = now
  },
)

// --- parts -----------------------------------------------------------------------------------
function addPart(): void {
  if (!canAddPart(v.parts.length)) return
  partsNotice.value = ''
  v.parts.push(emptyPart(v.cognitiveLevel))
}
function removePart(index: number): void {
  if (!canRemovePart(v.parts.length)) {
    partsNotice.value = STRUCTURED_COPY.partsMin
    return
  }
  partsNotice.value = ''
  v.parts.splice(index, 1)
}
const partLetter = (i: number): string => String.fromCharCode(97 + i)
const totalText = computed(() => totalMarksText(v.parts))

// --- image -----------------------------------------------------------------------------------
function onImage(value: File | File[] | null): void {
  const file = Array.isArray(value) ? (value[0] ?? null) : value
  image.value = file
  const { stimulusImage: _gone, ...rest } = local.value
  void _gone
  local.value =
    file && imageError(file) ? { ...rest, stimulusImage: imageError(file) as string } : rest
}

// --- submit ----------------------------------------------------------------------------------
function submit(): void {
  if (props.saving) return
  const found = validate(
    v,
    { hasChapters: hasChapters.value, hasDskpNodes: hasDskpNodes.value },
    image.value,
  )
  local.value = found
  if (Object.keys(found).length > 0) {
    partsNotice.value = ''
    return
  }
  emit('submit', v, image.value)
}

const errorList = computed(() => Object.values(errors.value))
const err = (k: string): string | undefined => errors.value[k]
</script>

<template>
  <DsStack as="form" gap="md" novalidate data-testid="structured-form" @submit.prevent="submit">
    <UAlert
      v-if="errorList.length"
      color="error"
      variant="subtle"
      icon="i-ph-warning-circle-duotone"
      role="alert"
      data-testid="form-errors"
    >
      <template #description>
        <p v-for="(m, i) in errorList" :key="i">{{ m }}</p>
      </template>
    </UAlert>

    <DsFormSection title="Maklumat Soalan" icon="tag" accent="action" data-testid="info-card">
      <DsGrid :cols="{ base: 1, md: 2 }" gap="md">
        <DsFormField
          v-slot="{ id }"
          native
          for="s-level"
          label="Tingkatan"
          required
          :error="err('educationLevelId')"
        >
          <DsNativeSelect
            :id="id"
            v-model="v.levelId"
            name="education_level_id"
            data-testid="s-level"
          >
            <option value="">-- Pilih tingkatan --</option>
            <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField
          v-slot="{ id }"
          native
          for="s-subject"
          label="Subjek"
          required
          :error="err('subjectId')"
        >
          <DsNativeSelect :id="id" v-model="v.subjectId" name="subject_id" data-testid="s-subject">
            <option value="">-- Pilih subjek --</option>
            <option v-for="s in subjects" :key="s.id" :value="String(s.id)">{{ s.name }}</option>
          </DsNativeSelect>
        </DsFormField>

        <DsFormField
          v-slot="{ id }"
          native
          for="s-chapter"
          label="Bab"
          :required="hasChapters"
          :error="err('chapterId')"
          :hint="ready && !hasChapters ? STRUCTURED_COPY.noChapters : undefined"
        >
          <DsNativeSelect
            :id="id"
            v-model="v.chapterId"
            name="chapter_id"
            :disabled="!hasChapters"
            data-testid="s-chapter"
          >
            <option value="">-- Pilih bab --</option>
            <option v-for="c in chapters" :key="c.id" :value="String(c.id)">
              {{ c.chapterNumber === null ? c.name : `${String(c.chapterNumber)}. ${c.name}` }}
            </option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField
          v-slot="{ id }"
          native
          for="s-sp"
          label="SP"
          :required="hasDskpNodes"
          :error="err('spIds')"
        >
          <DsNativeSelect
            :id="id"
            v-model="v.spId"
            name="sp_id"
            :disabled="!hasDskpNodes"
            data-testid="s-sp"
          >
            <option value="">-- Pilih SP --</option>
            <option v-for="s in sps" :key="s.id" :value="String(s.id)">{{ s.label }}</option>
          </DsNativeSelect>
        </DsFormField>

        <DsFormField
          v-slot="{ id }"
          native
          for="s-tp"
          label="TP"
          :required="hasDskpNodes"
          :error="err('tp')"
        >
          <DsNativeSelect :id="id" v-model="v.tp" name="tp" data-testid="s-tp">
            <option value="">-- Pilih TP --</option>
            <option v-for="t in TP_OPTIONS" :key="t.value" :value="t.value">{{ t.label }}</option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField
          v-slot="{ id }"
          native
          for="s-aras"
          label="Aras Pemikiran"
          :required="hasDskpNodes"
          :error="err('cognitiveLevel')"
        >
          <DsNativeSelect
            :id="id"
            v-model="v.cognitiveLevel"
            name="cognitive_level"
            data-testid="s-aras"
          >
            <option value="">-- Pilih aras --</option>
            <option v-for="a in COGNITIVE_LEVELS" :key="a.value" :value="a.value">
              {{ a.label }}
            </option>
          </DsNativeSelect>
        </DsFormField>

        <DsFormField
          v-slot="{ id }"
          native
          for="s-difficulty"
          label="Kesukaran"
          required
          :error="err('difficultyLevel')"
        >
          <DsNativeSelect
            :id="id"
            v-model="v.difficulty"
            name="difficulty_level"
            data-testid="s-difficulty"
          >
            <option value="">-- Pilih kesukaran --</option>
            <option v-for="d in DIFFICULTY_OPTIONS" :key="d.value" :value="d.value">
              {{ d.label }}
            </option>
          </DsNativeSelect>
        </DsFormField>
      </DsGrid>
    </DsFormSection>

    <DsFormSection title="Rangsangan" icon="question" accent="heat" data-testid="stimulus-card">
      <DsStack gap="md">
        <DsFormField
          v-slot="{ id }"
          native
          for="s-stimulus"
          label="Rangsangan"
          :error="err('stimulus')"
        >
          <UTextarea
            :id="id"
            v-model="v.stimulus"
            name="stimulus"
            :rows="4"
            :maxlength="STIMULUS_MAX + 1"
            data-testid="s-stimulus"
          />
        </DsFormField>
        <DsFormField label="Imej rangsangan" name="s-image" :error="err('stimulusImage')">
          <DsFileField
            :model-value="image"
            name="stimulus_image"
            accept="image/jpeg,image/png,image/webp"
            data-testid="s-image"
            @update:model-value="onImage"
          />
        </DsFormField>
        <DsText
          v-if="hasSavedImage && !image"
          variant="caption"
          tone="muted"
          data-testid="s-image-saved"
        >
          Imej rangsangan yang disimpan dikekalkan.
        </DsText>
      </DsStack>
    </DsFormSection>

    <DsFormSection title="Sub-Soalan" icon="list" accent="win" data-testid="parts-card">
      <DsStack gap="md">
        <DsText v-if="err('parts')" variant="caption" tone="error" role="alert">
          {{ err('parts') }}
        </DsText>
        <DsPanel v-for="(p, i) in v.parts" :key="p.key" tone="inset" data-testid="s-part">
          <DsStack gap="md">
            <DsCluster justify="between" :wrap="false">
              <DsText variant="label" tone="highlighted">Sub-Soalan ({{ partLetter(i) }})</DsText>
              <UButton
                type="button"
                color="neutral"
                :variant="canRemovePart(v.parts.length) ? 'soft' : 'ghost'"
                icon="i-ph-trash"
                size="xl"
                :aria-disabled="!canRemovePart(v.parts.length)"
                data-testid="s-part-remove"
                @click="removePart(i)"
                >Buang</UButton
              >
            </DsCluster>
            <DsFormField
              v-slot="{ id }"
              native
              :for="`s-part-${p.key}-text`"
              label="Teks sub-soalan"
              required
              :error="err(`parts.${i}.text`)"
            >
              <UTextarea
                :id="id"
                v-model="p.text"
                :name="`parts[${i}][text]`"
                :rows="3"
                :maxlength="PART_TEXT_MAX + 1"
                data-testid="s-part-text"
              />
            </DsFormField>
            <DsGrid :cols="{ base: 1, md: 2 }" gap="md">
              <DsFormField
                v-slot="{ id }"
                native
                :for="`s-part-${p.key}-marks`"
                label="Markah"
                required
                :error="err(`parts.${i}.marks`)"
              >
                <UInput
                  :id="id"
                  v-model="p.marks"
                  :name="`parts[${i}][marks]`"
                  type="number"
                  inputmode="numeric"
                  :min="MIN_MARKS"
                  :max="MAX_MARKS"
                  size="xl"
                  data-testid="s-part-marks"
                />
              </DsFormField>
              <DsFormField
                v-slot="{ id }"
                native
                :for="`s-part-${p.key}-aras`"
                label="Aras Pemikiran"
                :error="err(`parts.${i}.cognitiveLevel`)"
              >
                <DsNativeSelect
                  :id="id"
                  v-model="p.cognitiveLevel"
                  :name="`parts[${i}][cognitive_level]`"
                  data-testid="s-part-aras"
                >
                  <option value="">-- Pilih aras --</option>
                  <option v-for="a in COGNITIVE_LEVELS" :key="a.value" :value="a.value">
                    {{ a.label }}
                  </option>
                </DsNativeSelect>
              </DsFormField>
            </DsGrid>
            <DsFormField
              v-slot="{ id }"
              native
              :for="`s-part-${p.key}-scheme`"
              label="Skema Jawapan"
              required
              :error="err(`parts.${i}.scheme`)"
            >
              <UTextarea
                :id="id"
                v-model="p.scheme"
                :name="`parts[${i}][scheme]`"
                :rows="3"
                :maxlength="SCHEME_MAX + 1"
                data-testid="s-part-scheme"
              />
            </DsFormField>
          </DsStack>
        </DsPanel>

        <DsText
          v-if="partsNotice"
          variant="caption"
          tone="error"
          role="alert"
          data-testid="s-parts-notice"
        >
          {{ partsNotice }}
        </DsText>
        <DsCluster justify="between">
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            icon="i-ph-plus"
            size="xl"
            :disabled="v.parts.length >= MAX_PARTS"
            data-testid="s-part-add"
            @click="addPart"
            >Tambah Sub-Soalan</UButton
          >
          <DsText variant="label" tone="highlighted" role="status" data-testid="s-total">
            {{ totalText }}
          </DsText>
        </DsCluster>
      </DsStack>
    </DsFormSection>

    <DsCluster>
      <UButton
        type="submit"
        :loading="saving"
        :disabled="saving"
        :icon="saving ? undefined : 'i-ph-paper-plane-tilt'"
        size="xl"
        data-testid="form-submit"
        >{{ saving ? 'Menyimpan...' : 'Hantar untuk Semakan' }}</UButton
      >
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        size="xl"
        data-testid="form-cancel"
        @click="emit('cancel')"
        >Batal</UButton
      >
    </DsCluster>
  </DsStack>
</template>
