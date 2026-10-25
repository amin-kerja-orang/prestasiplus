<script setup lang="ts">
/**
 * One extracted question (v2-question-bank 4.8): stem with maths, type and leaf mode (exam schema
 * D1/D2), options + key or parts, the mark scheme, and the DSKP tag. Fields the extractor was unsure
 * of carry a "Sahkan" box that a person must tick (confidence gate).
 */
import { computed, useId } from 'vue'

import {
  DsCluster,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsRtlScope,
  DsStack,
  DsSurface,
  DsText,
} from '@/ds'

import RichText from '../../../components/RichText.vue'
import { KBAT_LEVELS } from '../../../domain/types'
import type { LeafKind } from '../../../domain/types'
import { dskpSource } from '../../../lib/dskp-source'
import type { DskpSubjectState } from '../../../lib/dskp-source'
import { KBAT_LABEL, TAG_COPY, TINGKATAN_OPTIONS, TP_LEVELS } from '../domain/tag-view'
import { useTagEditor } from '../lib/use-tag-editor'
import type { IntakePart, IntakeQType, IntakeQuestion } from '../types'
import DskpSpPicker from './DskpSpPicker.vue'
import SchemeEditor from './SchemeEditor.vue'
import TagAiBadge from './TagAiBadge.vue'
import TagFieldExtras from './TagFieldExtras.vue'
import TagNote from './TagNote.vue'

const props = defineProps<{
  modelValue: IntakeQuestion
  /** The question's subject catalogue; the page loads it once with `useDskpSubject`. */
  dskp: DskpSubjectState
  /** Bank questions have no printed number: hide the field. */
  hideNumber?: boolean
  /** The page locks the editor (batch not Draf, or Sunting waiting for a new version). */
  disabled?: boolean
  /** The page has shown its list of what is missing: empty required tag controls show their message. */
  showErrors?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [IntakeQuestion]; retry: [] }>()

const q = computed(() => props.modelValue)

const TYPES: { value: IntakeQType; label: string }[] = [
  { value: 'mcq', label: 'Objektif (MCQ)' },
  { value: 'structured', label: 'Berstruktur (bahagian)' },
  { value: 'short', label: 'Jawapan pendek' },
  { value: 'essay', label: 'Esei / karangan' },
]
const MODES: { value: LeafKind; label: string }[] = [
  { value: 'working', label: 'Kerja langkah' },
  { value: 'numeric', label: 'Nombor' },
  { value: 'short_text', label: 'Teks pendek' },
  { value: 'match_letter', label: 'Padan huruf' },
  { value: 'essay', label: 'Esei' },
  { value: 'drawing', label: 'Lukisan' },
  { value: 'table_fill', label: 'Isi jadual' },
]
const LETTERS = ['A', 'B', 'C', 'D', 'E']
function set(patch: Partial<IntakeQuestion>): void {
  const next = { ...q.value, ...patch }
  if (next.parts.length > 0) next.marks = next.parts.reduce((n, p) => n + p.marks, 0)
  emit('update:modelValue', next)
}

function setType(t: IntakeQType): void {
  if (t === 'mcq') {
    const options =
      q.value.options.length >= 2
        ? q.value.options
        : LETTERS.slice(0, 4).map((id) => ({ id, text: '' }))
    set({ type: t, options, parts: [], marks: q.value.marks || 1, scheme: q.value.scheme?.kind === 'option' ? q.value.scheme : undefined })
  } else if (t === 'structured') {
    set({
      type: t,
      options: [],
      scheme: undefined,
      parts: q.value.parts.length > 0 ? q.value.parts : [newPart(0)],
    })
  } else set({ type: t, options: [], parts: [], scheme: q.value.scheme?.kind === 'option' ? undefined : q.value.scheme })
}

function newPart(n: number): IntakePart {
  return { id: `${q.value.label}-p${Date.now().toString(36)}${n}`, label: `(${String.fromCharCode(97 + n)})`, prompt: '', marks: 1, mode: 'short_text' }
}

/* options */
function setOption(i: number, text: string): void {
  set({ options: q.value.options.map((o, k) => (k === i ? { ...o, text } : o)) })
}
function addOption(): void {
  const id = LETTERS[q.value.options.length]
  if (id) set({ options: [...q.value.options, { id, text: '' }] })
}
function removeOption(i: number): void {
  const left = q.value.options
    .filter((_, k) => k !== i)
    .map((o, k) => ({ ...o, id: LETTERS[k]! }))
  set({ options: left, scheme: undefined })
}
const key = computed(() => (q.value.scheme?.kind === 'option' ? q.value.scheme.correct : ''))
function setKey(id: string): void {
  set({ scheme: { kind: 'option', marks: q.value.marks || 1, correct: id, reason: q.value.scheme?.kind === 'option' ? q.value.scheme.reason : '' } })
}

/* parts */
function setPart(i: number, patch: Partial<IntakePart>): void {
  set({ parts: q.value.parts.map((p, k) => (k === i ? { ...p, ...patch } : p)) })
}
function addPart(): void {
  set({ parts: [...q.value.parts, newPart(q.value.parts.length)] })
}
function removePart(i: number): void {
  set({ parts: q.value.parts.filter((_, k) => k !== i) })
}

/* tag: the state and the edits of the Tag DSKP block live in `useTagEditor` */
const {
  phase,
  inDskp,
  outside,
  info,
  groups,
  missingUnit,
  sk,
  tpDescription,
  ai,
  changedFrom,
  notice,
  errors,
  setForm,
  setUnit,
  toggleSp,
  setTp,
  setKbat,
  confirm,
} = useTagEditor({
  question: () => props.modelValue,
  dskp: props.dskp,
  commit: (next) => emit('update:modelValue', next),
  showErrors: () => props.showErrors === true,
})
const subjectName = computed(
  () => dskpSource().subject(q.value.tag.subject)?.name ?? q.value.tag.subject,
)
const tpDescId = `tp-desc-${useId()}`
const skLabelId = `sk-label-${useId()}`
const spRtl = computed(() => info.value?.rtlFields.includes('sp') ?? false)
const skRtl = computed(() => info.value?.rtlFields.includes('sk') ?? false)
const loading = computed(() => phase.value === 'loading')
/** Unit can be used: the catalogue is loaded, the tingkatan is T4 or T5 and the page allows it. */
const unitOpen = computed(() => phase.value === 'ready' && inDskp.value && !props.disabled)
/** "Mengikut {Tajuk / Topic / ...} dalam DSKP", or why the list is empty. */
const unitHint = computed(() => {
  if (!inDskp.value || phase.value !== 'ready') return undefined
  return groups.value.length > 0 ? TAG_COPY.unitHint(info.value?.unitNoun ?? '') : TAG_COPY.unitNone
})
/** Text under the TP select when there is no descriptor to show. */
const tpNote = computed(() => {
  switch (tpDescription.value.kind) {
    case 'outside':
      return TAG_COPY.tpOutside
    case 'need-target':
      return TAG_COPY.tpNeedTarget
    case 'need-tp':
      return TAG_COPY.tpNeedTp
    default:
      return TAG_COPY.tpNone
  }
})
const describedBy = (...ids: (string | undefined)[]): string | undefined =>
  ids.filter(Boolean).join(' ') || undefined

function insertMath(field: 'stem'): void {
  set({ [field]: `${q.value[field]} $ $` })
}
</script>

<template>
  <div class="@container flex min-w-0 flex-col gap-5" data-testid="question-editor">
    <UAlert
      v-if="q.needsManual"
      color="warning"
      variant="subtle"
      icon="i-ph-warning"
      title="Perlu semak manual"
      description="Pengekstrak tidak dapat membaca soalan ini sepenuhnya."
    >
      <template #actions>
        <UButton size="sm" color="warning" variant="outline" @click="set({ needsManual: false })">
          Tandakan selesai disemak
        </UButton>
      </template>
    </UAlert>

    <div class="grid gap-4" :class="hideNumber ? '@md:grid-cols-2' : '@md:grid-cols-3'">
      <label v-if="!hideNumber" class="flex min-w-0 flex-col gap-1 text-sm">
        <span class="font-medium">Nombor soalan</span>
        <UInput
          :model-value="q.label"
          type="text"
          class="w-full"
          @update:model-value="set({ label: String($event) })"
        />
      </label>
      <label class="flex min-w-0 flex-col gap-1 text-sm">
        <span class="font-medium">Jenis soalan</span>
        <DsNativeSelect
          :model-value="q.type"
          data-testid="q-type"
          @update:model-value="setType(String($event) as IntakeQType)"
        >
          <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </DsNativeSelect>
      </label>
      <label v-if="q.parts.length === 0" class="flex min-w-0 flex-col gap-1 text-sm">
        <span class="font-medium">Markah</span>
        <UInput
          :model-value="q.marks"
          type="number"
          min="0"
          class="w-full"
          data-testid="q-marks"
          @update:model-value="set({ marks: Number($event) || 0 })"
        />
      </label>
      <p v-else class="self-end pb-3 text-sm text-muted">Markah soalan: {{ q.marks }} (jumlah bahagian)</p>
    </div>

    <!-- stem -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <label :for="`stem-${q.id}`" class="text-sm font-medium">Teks soalan</label>
        <UButton class="shrink-0 whitespace-nowrap" size="md" variant="ghost" color="neutral" icon="i-ph-function" @click="insertMath('stem')">
          Sisip matematik
        </UButton>
      </div>
      <UTextarea
        :id="`stem-${q.id}`"
        :model-value="q.stem"
        :rows="3"
        class="w-full"
        data-testid="q-stem"
        @update:model-value="set({ stem: String($event) })"
      />
      <p class="text-xs text-muted">Gunakan $...$ untuk matematik, cth. $x^2 + 3$.</p>
      <p v-if="q.stem" class="rounded-lg bg-muted p-3 text-sm" aria-label="Pratonton teks soalan">
        <RichText :text="q.stem" />
      </p>
    </div>

    <!-- MCQ -->
    <fieldset v-if="q.type === 'mcq'" class="flex min-w-0 flex-col gap-2">
      <legend class="mb-1 text-sm font-medium">Pilihan jawapan dan kunci</legend>
      <div v-for="(o, i) in q.options" :key="o.id" class="flex min-w-0 items-center gap-2">
        <input
          type="radio"
          :name="`key-${q.id}`"
          :checked="key === o.id"
          class="size-5 shrink-0"
          :aria-label="`Jadikan ${o.id} kunci jawapan`"
          @change="setKey(o.id)"
        />
        <span class="w-6 shrink-0 font-semibold">{{ o.id }}</span>
        <UInput
          :model-value="o.text"
          type="text"
          class="min-w-0 flex-1"
          :aria-label="`Pilihan ${o.id}`"
          @update:model-value="setOption(i, String($event))"
        />
        <UButton
          class="shrink-0"
          icon="i-ph-trash"
          color="error"
          variant="ghost"
          :aria-label="`Buang pilihan ${o.id}`"
          @click="removeOption(i)"
        />
      </div>
      <div>
        <UButton size="sm" variant="outline" color="neutral" icon="i-ph-plus" :disabled="q.options.length >= 5" @click="addOption">
          Tambah pilihan
        </UButton>
      </div>
    </fieldset>

    <!-- parts -->
    <div v-else-if="q.type === 'structured'" class="flex flex-col gap-4">
      <p class="text-sm font-medium">Bahagian soalan</p>
      <div
        v-for="(p, i) in q.parts"
        :key="p.id"
        class="rounded-xl border border-default p-3"
        data-testid="q-part"
      >
        <DsStack gap="sm">
          <div class="grid gap-3 @lg:grid-cols-[6rem_minmax(0,1fr)_6rem]">
            <label class="flex min-w-0 flex-col gap-1 text-sm">
              <span class="text-muted">Label</span>
              <UInput
                :model-value="p.label"
                class="w-full"
                @update:model-value="setPart(i, { label: String($event) })"
              />
            </label>
            <label class="flex min-w-0 flex-col gap-1 text-sm">
              <span class="text-muted">Teks bahagian</span>
              <UInput
                :model-value="p.prompt"
                class="w-full"
                :aria-label="`Teks bahagian ${p.label}`"
                @update:model-value="setPart(i, { prompt: String($event) })"
              />
            </label>
            <label class="flex min-w-0 flex-col gap-1 text-sm">
              <span class="text-muted">Markah</span>
              <UInput
                :model-value="p.marks"
                type="number"
                min="0"
                class="w-full"
                :aria-label="`Markah bahagian ${p.label}`"
                @update:model-value="setPart(i, { marks: Number($event) || 0 })"
              />
            </label>
          </div>
          <DsCluster align="end" :wrap="false">
            <label class="flex w-full min-w-0 flex-col gap-1 text-sm @lg:max-w-xs">
              <span class="text-muted">Mod jawapan</span>
              <DsNativeSelect
                :model-value="p.mode"
                :aria-label="`Mod jawapan ${p.label}`"
                @update:model-value="setPart(i, { mode: String($event) as LeafKind })"
              >
                <option v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
              </DsNativeSelect>
            </label>
            <UButton
              class="shrink-0"
              icon="i-ph-trash"
              color="error"
              variant="ghost"
              :aria-label="`Buang bahagian ${p.label}`"
              @click="removePart(i)"
            />
          </DsCluster>
        </DsStack>
        <DsText v-if="p.lead?.length" variant="caption" tone="muted" data-testid="part-lead">
          Di bawah: <RichText :text="p.lead.map((l) => `${l.label} ${l.prompt}`).join(' ')" />
        </DsText>
        <p v-if="p.prompt" class="mt-2 text-sm text-muted"><RichText :text="p.prompt" /></p>
        <div class="mt-3">
          <SchemeEditor
            :model-value="p.scheme"
            :marks="p.marks"
            :subject="q.tag.subject"
            :prev-part-id="q.parts[i - 1]?.id"
            :testid="`scheme-${p.label}`"
            @update:model-value="setPart(i, { scheme: $event })"
          />
        </div>
      </div>
      <div>
        <UButton size="sm" variant="outline" color="neutral" icon="i-ph-plus" @click="addPart">
          Tambah bahagian
        </UButton>
      </div>
    </div>

    <!-- single leaf -->
    <div v-else class="flex flex-col gap-4">
      <label class="flex max-w-xs flex-col gap-1 text-sm">
        <span class="font-medium">Mod jawapan</span>
        <DsNativeSelect
          :model-value="q.mode"
          @update:model-value="set({ mode: String($event) as LeafKind })"
        >
          <option v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </DsNativeSelect>
      </label>
      <SchemeEditor
        :model-value="q.scheme"
        :marks="q.marks"
        :subject="q.tag.subject"
        @update:model-value="set({ scheme: $event })"
      />
    </div>

    <!-- tag -->
    <DsStack as="fieldset" gap="sm" data-testid="tag-block">
      <DsText as="legend" variant="label">{{ TAG_COPY.legend }}</DsText>
      <DsText variant="caption" tone="muted" data-testid="tag-subject">
        {{ TAG_COPY.subject(subjectName) }}
      </DsText>
      <UAlert
        v-if="q.tag.review === 'perlu-semakan'"
        color="warning"
        variant="subtle"
        icon="i-ph-warning"
        :title="TAG_COPY.reviewTitle"
        :description="TAG_COPY.reviewText"
        data-testid="tag-review-alert"
      />

      <div class="grid gap-3 @3xl:grid-cols-4">
        <DsFormField native :label="TAG_COPY.form" required :error="errors.form">
          <template #default="{ id, describedby, invalid }">
            <DsNativeSelect
              :id="id"
              :model-value="q.tag.formOrigin ?? ''"
              blank
              :placeholder="TAG_COPY.formPlaceholder"
              :disabled="disabled"
              :invalid="invalid"
              :aria-describedby="describedby"
              data-testid="q-form"
              @update:model-value="setForm(String($event))"
            >
              <option v-for="o in TINGKATAN_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
            </DsNativeSelect>
            <TagNote v-if="notice === 'form'" status data-testid="tag-notice">
              {{ TAG_COPY.noticeForm }}
            </TagNote>
          </template>
        </DsFormField>

        <div class="@3xl:col-span-3">
        <DsLoadError
          v-if="phase === 'error'"
          variant="inline"
          :message="TAG_COPY.loadError"
          data-testid="tag-load-error"
          @retry="emit('retry')"
        />
        <DsFormField
          v-else
          native
          :label="TAG_COPY.unit"
          :required="inDskp"
          :loading="loading"
          :hint="unitHint"
          :error="errors.unit"
        >
          <template #label-extra><TagAiBadge :state="ai.unit.badge" /></template>
          <template #default="{ id, describedby, invalid }">
            <DsNativeSelect
              :id="id"
              :model-value="q.tag.unitId ?? ''"
              blank
              :placeholder="TAG_COPY.unitPlaceholder"
              :disabled="!unitOpen"
              :invalid="invalid"
              :aria-describedby="describedby"
              data-testid="q-unit"
              @update:model-value="setUnit(String($event))"
            >
              <option v-if="missingUnit" :value="missingUnit" disabled>
                {{ TAG_COPY.unitMissing(missingUnit) }}
              </option>
              <template v-for="g in groups" :key="g.key">
                <optgroup v-if="g.label" :label="g.label">
                  <option v-for="u in g.units" :key="u.id" :value="u.id">{{ u.label }}</option>
                </optgroup>
                <template v-else>
                  <option v-for="u in g.units" :key="u.id" :value="u.id">{{ u.label }}</option>
                </template>
              </template>
            </DsNativeSelect>
            <TagNote v-if="notice === 'unit'" status data-testid="tag-notice">
              {{ TAG_COPY.noticeUnit }}
            </TagNote>
            <TagFieldExtras
              field="unit"
              :state="ai.unit"
              :changed-label="changedFrom.unit"
              :disabled="disabled"
              @confirm="confirm('tag.unit', $event)"
            />
          </template>
        </DsFormField>
        </div>
      </div>

      <template v-if="phase !== 'error'">
        <DskpSpPicker
          :view="dskp.view.value"
          :unit-id="q.tag.unitId"
          :model-value="q.tag.spIds"
          :loading="loading"
          :disabled="disabled || !inDskp"
          :outside="outside"
          :required="inDskp"
          :rtl="spRtl"
          :error="errors.sp"
          @toggle="toggleSp"
        >
          <template #label-extra><TagAiBadge :state="ai.sp.badge" /></template>
          <TagFieldExtras
            field="sp"
            :state="ai.sp"
            :changed-label="changedFrom.sp"
            :disabled="disabled"
            @confirm="confirm('tag.sp', $event)"
          />
        </DskpSpPicker>

        <DsStack
          gap="xs"
          role="group"
          :aria-labelledby="skLabelId"
          :aria-disabled="outside ? 'true' : undefined"
          data-testid="q-sk"
        >
          <DsText :id="skLabelId" variant="label" as="span">{{ TAG_COPY.sk }}</DsText>
          <USkeleton v-if="loading" class="h-11 w-full" />
          <DsSurface v-else level="soft" padding="sm" radius="chip">
            <DsText v-if="sk.length === 0" variant="caption" tone="muted">{{ TAG_COPY.skEmpty }}</DsText>
            <DsStack v-else as="ul" gap="xs">
              <li v-for="s in sk" :key="s.id" data-testid="sk-row">
                <DsCluster gap="xs" as="span">
                  <DsText variant="body-strong" as="span" tabular dir="ltr">{{ s.code }}</DsText>
                  <UBadge
                    v-if="s.flag"
                    color="warning"
                    variant="subtle"
                    size="sm"
                    icon="i-ph-warning"
                    :title="s.flag.reason"
                  >
                    {{ s.flag.text }}
                  </UBadge>
                </DsCluster>
                <DsRtlScope v-if="skRtl" lang="ms-Arab">{{ s.title }}</DsRtlScope>
                <DsText v-else variant="body" wrap="anywhere">{{ s.title }}</DsText>
              </li>
            </DsStack>
          </DsSurface>
          <DsText variant="caption" tone="muted">{{ TAG_COPY.skHint }}</DsText>
        </DsStack>
      </template>

      <TagNote v-if="outside" data-testid="tag-outside">{{ TAG_COPY.outside }}</TagNote>

      <div class="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
        <DsFormField native :label="TAG_COPY.tp" required :error="errors.tp">
          <template #label-extra><TagAiBadge :state="ai.tp.badge" /></template>
          <template #default="{ id, describedby, invalid }">
            <DsNativeSelect
              :id="id"
              :model-value="q.tag.tp ?? ''"
              blank
              :placeholder="TAG_COPY.tpPlaceholder"
              :disabled="disabled"
              :invalid="invalid"
              :aria-describedby="describedBy(describedby, tpDescId)"
              data-testid="q-tp"
              @update:model-value="setTp($event)"
            >
              <option v-for="n in TP_LEVELS" :key="n" :value="n">TP {{ n }}</option>
            </DsNativeSelect>
            <TagFieldExtras
              field="tp"
              :state="ai.tp"
              :changed-label="changedFrom.tp"
              :disabled="disabled"
              @confirm="confirm('tag.tp', $event)"
            />
          </template>
        </DsFormField>

        <DsFormField native :label="TAG_COPY.kbat" :hint="TAG_COPY.kbatHint">
          <template #label-extra><TagAiBadge :state="ai.kbat.badge" /></template>
          <template #default="{ id, describedby }">
            <DsNativeSelect
              :id="id"
              :model-value="q.tag.kbat ?? ''"
              blank
              :placeholder="TAG_COPY.kbatNone"
              :disabled="disabled"
              :aria-describedby="describedby"
              data-testid="q-kbat"
              @update:model-value="setKbat(String($event))"
            >
              <option v-for="k in KBAT_LEVELS" :key="k" :value="k">{{ KBAT_LABEL[k] }}</option>
            </DsNativeSelect>
            <TagFieldExtras
              field="kbat"
              :state="ai.kbat"
              :changed-label="changedFrom.kbat"
              :disabled="disabled"
              @confirm="confirm('tag.kbat', $event)"
            />
          </template>
        </DsFormField>

        <div class="@md:col-span-2 @3xl:col-span-2">
        <DsStack :id="tpDescId" gap="xs" data-testid="tp-descriptor">
          <USkeleton v-if="loading" class="h-11 w-full" />
          <template v-else-if="tpDescription.kind === 'found'">
            <DsStack v-for="(item, i) in tpDescription.items" :key="i" gap="2xs">
              <DsText variant="label" as="span">{{ item.heading }}</DsText>
              <DsRtlScope v-if="tpDescription.rtl" lang="ms-Arab">{{ item.text }}</DsRtlScope>
              <DsText v-else variant="body" wrap="anywhere">{{ item.text }}</DsText>
              <DsText variant="caption" tone="muted">
                {{ item.range ? `${item.source} · ${item.range}` : item.source }}
              </DsText>
            </DsStack>
          </template>
          <DsText v-else variant="caption" tone="muted">{{ tpNote }}</DsText>
        </DsStack>
        </div>
      </div>
    </DsStack>
  </div>
</template>
