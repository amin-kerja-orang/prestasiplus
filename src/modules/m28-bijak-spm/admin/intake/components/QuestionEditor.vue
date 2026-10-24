<script setup lang="ts">
/**
 * One extracted question (v2-question-bank 4.8): stem with maths, type and leaf mode (exam schema
 * D1/D2), options + key or parts, the mark scheme, and the DSKP tag. Fields the extractor was unsure
 * of carry a "Sahkan" box that a person must tick (confidence gate).
 */
import { computed } from 'vue'

import { DsCluster, DsNativeSelect, DsStack, DsText } from '@/ds'

import type { LeafKind } from '../../../domain/types'
import RichText from '../../../components/RichText.vue'
import { unitByCode, unitsFor, tagWithUnit } from '../lib/dskp'
import { fieldName, fieldsToConfirm } from '../domain/validation'
import type { IntakePart, IntakeQType, IntakeQuestion } from '../types'
import SchemeEditor from './SchemeEditor.vue'

const props = defineProps<{
  modelValue: IntakeQuestion
  /** Bank questions have no printed number: hide the field. */
  hideNumber?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [IntakeQuestion] }>()

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

/* tag */
const units = computed(() => unitsFor(q.value.tag.subject))
function setUnit(code: string): void {
  const u = unitByCode(code)
  set({ tag: tagWithUnit(q.value.tag, u) })
}
function setForm(origin: 'T1-T3' | 'T4' | 'T5'): void {
  set({
    tag: {
      ...q.value.tag,
      formOrigin: origin,
      level: origin === 'T1-T3' ? q.value.tag.level : origin,
      ...(origin === 'T1-T3' ? { unit: null, unitLabel: '' } : {}),
    },
  })
}
/** Low-confidence fields to confirm (no unit or SP confirmation for T1-T3). */
const toConfirm = computed(() => fieldsToConfirm(q.value))
const spText = computed(() => q.value.tag.sp.join(', '))
function setSp(text: string): void {
  set({ tag: { ...q.value.tag, sp: text.split(',').map((s) => s.trim()).filter(Boolean) } })
}
function confirm(field: string, on: boolean): void {
  const c = new Set(q.value.confirmed)
  if (on) c.add(field)
  else c.delete(field)
  set({ confirmed: [...c] })
}

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
    <fieldset class="flex min-w-0 flex-col gap-3 border-0 p-0">
      <legend class="p-0 text-sm font-medium">Tag DSKP</legend>
      <div class="grid gap-3 @md:grid-cols-2 @3xl:grid-cols-4">
        <label class="flex min-w-0 flex-col gap-1 text-sm">
          <span class="text-muted">Asal tingkatan</span>
          <DsNativeSelect
            :model-value="q.tag.formOrigin"
            data-testid="q-form"
            @update:model-value="setForm(String($event) as 'T1-T3' | 'T4' | 'T5')"
          >
            <option value="T4">Tingkatan 4</option>
            <option value="T5">Tingkatan 5</option>
            <option value="T1-T3">Tingkatan 1-3 (di luar DSKP)</option>
          </DsNativeSelect>
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-sm @3xl:col-span-2">
          <span class="text-muted">Unit</span>
          <DsNativeSelect
            :model-value="q.tag.unit ?? ''"
            :disabled="q.tag.formOrigin === 'T1-T3'"
            data-testid="q-unit"
            @update:model-value="setUnit(String($event))"
          >
            <option value="">Pilih unit</option>
            <option v-for="u in units" :key="u.code" :value="u.code">
              {{ u.form }} - {{ u.label }}
            </option>
          </DsNativeSelect>
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-sm">
          <span class="text-muted">TP (1-6)</span>
          <UInput
            :model-value="q.tag.tp"
            type="number"
            min="1"
            max="6"
            class="w-full"
            @update:model-value="set({ tag: { ...q.tag, tp: Number($event) || 0 } })"
          />
        </label>
        <label class="flex min-w-0 flex-col gap-1 text-sm @md:col-span-2 @3xl:col-span-4">
          <span class="text-muted">SP (asingkan dengan koma)</span>
          <UInput
            :model-value="spText"
            type="text"
            placeholder="cth. 3.1, 3.2"
            class="w-full"
            data-testid="q-sp"
            @change="setSp(($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
      <div v-if="toConfirm.length > 0" class="flex flex-col gap-1">
        <UCheckbox
          v-for="f in toConfirm"
          :key="f"
          :model-value="q.confirmed.includes(f)"
          :data-testid="`confirm-${f}`"
          @update:model-value="(v: boolean | 'indeterminate') => confirm(f, v === true)"
        >
          <template #label>
            <span class="block min-h-11 cursor-pointer">Saya sahkan {{ fieldName(f) }} (keyakinan rendah)</span>
          </template>
        </UCheckbox>
      </div>
    </fieldset>
  </div>
</template>
