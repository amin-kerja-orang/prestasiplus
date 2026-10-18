<script setup lang="ts">
/**
 * One extracted question (v2-question-bank 4.8): stem with maths, type and leaf mode (exam schema
 * D1/D2), options + key or parts, the mark scheme, and the DSKP tag. Fields the extractor was unsure
 * of carry a "Sahkan" box that a person must tick (confidence gate).
 */
import { computed } from 'vue'

import type { LeafKind } from '../../../domain/types'
import RichText from '../../../components/RichText.vue'
import { unitByCode, unitsFor, tagWithUnit } from '../lib/dskp'
import { fieldName } from '../domain/validation'
import type { IntakePart, IntakeQType, IntakeQuestion } from '../types'
import SchemeEditor from './SchemeEditor.vue'

const props = defineProps<{ modelValue: IntakeQuestion }>()
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
  <div class="flex flex-col gap-5" data-testid="question-editor">
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

    <div class="grid gap-4 sm:grid-cols-3">
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Nombor soalan</span>
        <input
          :value="q.label"
          type="text"
          class="min-h-11 rounded-lg border border-default bg-default px-3"
          @input="set({ label: ($event.target as HTMLInputElement).value })"
        />
      </label>
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Jenis soalan</span>
        <select
          :value="q.type"
          class="min-h-11 rounded-lg border border-default bg-default px-3"
          data-testid="q-type"
          @change="setType(($event.target as HTMLSelectElement).value as IntakeQType)"
        >
          <option v-for="t in TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
        </select>
      </label>
      <label v-if="q.parts.length === 0" class="flex flex-col gap-1 text-sm">
        <span class="font-medium">Markah</span>
        <input
          :value="q.marks"
          type="number"
          min="0"
          class="min-h-11 rounded-lg border border-default bg-default px-3"
          data-testid="q-marks"
          @input="set({ marks: Number(($event.target as HTMLInputElement).value) || 0 })"
        />
      </label>
      <p v-else class="self-end pb-3 text-sm text-muted">Markah soalan: {{ q.marks }} (jumlah bahagian)</p>
    </div>

    <!-- stem -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between gap-2">
        <label :for="`stem-${q.id}`" class="text-sm font-medium">Teks soalan</label>
        <UButton size="xs" variant="ghost" color="neutral" icon="i-ph-function" @click="insertMath('stem')">
          Sisip matematik
        </UButton>
      </div>
      <textarea
        :id="`stem-${q.id}`"
        :value="q.stem"
        rows="3"
        class="w-full rounded-lg border border-default bg-default p-3"
        data-testid="q-stem"
        @input="set({ stem: ($event.target as HTMLTextAreaElement).value })"
      />
      <p class="text-xs text-muted">Gunakan $...$ untuk matematik, cth. $x^2 + 3$.</p>
      <p v-if="q.stem" class="rounded-lg bg-muted p-3 text-sm" aria-label="Pratonton teks soalan">
        <RichText :text="q.stem" />
      </p>
    </div>

    <!-- MCQ -->
    <fieldset v-if="q.type === 'mcq'" class="flex flex-col gap-2">
      <legend class="mb-1 text-sm font-medium">Pilihan jawapan dan kunci</legend>
      <div v-for="(o, i) in q.options" :key="o.id" class="flex items-center gap-2">
        <input
          type="radio"
          :name="`key-${q.id}`"
          :checked="key === o.id"
          class="size-5 shrink-0"
          :aria-label="`Jadikan ${o.id} kunci jawapan`"
          @change="setKey(o.id)"
        />
        <span class="w-6 shrink-0 font-semibold">{{ o.id }}</span>
        <input
          :value="o.text"
          type="text"
          class="min-h-11 min-w-0 flex-1 rounded-lg border border-default bg-default px-3"
          :aria-label="`Pilihan ${o.id}`"
          @input="setOption(i, ($event.target as HTMLInputElement).value)"
        />
        <UButton
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
        <div class="grid gap-3 sm:grid-cols-[6rem_1fr_6rem_10rem_auto]">
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted">Label</span>
            <input
              :value="p.label"
              class="min-h-11 rounded-lg border border-default bg-default px-3"
              @input="setPart(i, { label: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted">Teks bahagian</span>
            <input
              :value="p.prompt"
              class="min-h-11 rounded-lg border border-default bg-default px-3"
              :aria-label="`Teks bahagian ${p.label}`"
              @input="setPart(i, { prompt: ($event.target as HTMLInputElement).value })"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted">Markah</span>
            <input
              :value="p.marks"
              type="number"
              min="0"
              class="min-h-11 rounded-lg border border-default bg-default px-3"
              :aria-label="`Markah bahagian ${p.label}`"
              @input="setPart(i, { marks: Number(($event.target as HTMLInputElement).value) || 0 })"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            <span class="text-muted">Mod jawapan</span>
            <select
              :value="p.mode"
              class="min-h-11 rounded-lg border border-default bg-default px-2"
              :aria-label="`Mod jawapan ${p.label}`"
              @change="setPart(i, { mode: ($event.target as HTMLSelectElement).value as LeafKind })"
            >
              <option v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
            </select>
          </label>
          <UButton
            class="self-end"
            icon="i-ph-trash"
            color="error"
            variant="ghost"
            :aria-label="`Buang bahagian ${p.label}`"
            @click="removePart(i)"
          />
        </div>
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
        <select
          :value="q.mode"
          class="min-h-11 rounded-lg border border-default bg-default px-3"
          @change="set({ mode: ($event.target as HTMLSelectElement).value as LeafKind })"
        >
          <option v-for="m in MODES" :key="m.value" :value="m.value">{{ m.label }}</option>
        </select>
      </label>
      <SchemeEditor
        :model-value="q.scheme"
        :marks="q.marks"
        :subject="q.tag.subject"
        @update:model-value="set({ scheme: $event })"
      />
    </div>

    <!-- tag -->
    <fieldset class="flex flex-col gap-3 rounded-xl border border-default p-3">
      <legend class="px-1 text-sm font-medium">Tag DSKP</legend>
      <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted">Asal tingkatan</span>
          <select
            :value="q.tag.formOrigin"
            class="min-h-11 rounded-lg border border-default bg-default px-3"
            data-testid="q-form"
            @change="setForm(($event.target as HTMLSelectElement).value as 'T1-T3' | 'T4' | 'T5')"
          >
            <option value="T4">Tingkatan 4</option>
            <option value="T5">Tingkatan 5</option>
            <option value="T1-T3">Tingkatan 1-3 (di luar DSKP)</option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm lg:col-span-2">
          <span class="text-muted">Unit</span>
          <select
            :value="q.tag.unit ?? ''"
            :disabled="q.tag.formOrigin === 'T1-T3'"
            class="min-h-11 rounded-lg border border-default bg-default px-3"
            data-testid="q-unit"
            @change="setUnit(($event.target as HTMLSelectElement).value)"
          >
            <option value="">Pilih unit</option>
            <option v-for="u in units" :key="u.code" :value="u.code">
              {{ u.form }} - {{ u.label }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted">TP (1-6)</span>
          <input
            :value="q.tag.tp"
            type="number"
            min="1"
            max="6"
            class="min-h-11 rounded-lg border border-default bg-default px-3"
            @input="set({ tag: { ...q.tag, tp: Number(($event.target as HTMLInputElement).value) || 0 } })"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm sm:col-span-2 lg:col-span-4">
          <span class="text-muted">SP (asingkan dengan koma)</span>
          <input
            :value="spText"
            type="text"
            placeholder="cth. 3.1, 3.2"
            class="min-h-11 rounded-lg border border-default bg-default px-3"
            data-testid="q-sp"
            @change="setSp(($event.target as HTMLInputElement).value)"
          />
        </label>
      </div>
      <div v-if="q.lowFields.length > 0" class="flex flex-col gap-1">
        <UCheckbox
          v-for="f in q.lowFields"
          :key="f"
          :model-value="q.confirmed.includes(f)"
          :label="`Saya sahkan ${fieldName(f)} (keyakinan rendah)`"
          :data-testid="`confirm-${f}`"
          @update:model-value="(v: boolean | 'indeterminate') => confirm(f, v === true)"
        />
      </div>
    </fieldset>
  </div>
</template>
