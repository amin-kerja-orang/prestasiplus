<script setup lang="ts">
/**
 * Mark-scheme editor for one leaf (exam schema D4): marking points with the subject's own code
 * letters, marks per point, accepted alternatives, one "mana-mana N" group and the own-figure-
 * carried-forward (ECF) flag. An `accepted` scheme (short answer values) is the other kind.
 */
import { computed } from 'vue'

import { DsNativeSelect } from '@/ds'

import type { PointCode, PointDef, SchemeDef } from '../../../domain/types'
import { CODE_NAMES, codesForSubject, pointTag, schemeTotal } from '../domain/marks'

const props = defineProps<{
  modelValue: SchemeDef | undefined
  /** Marks the leaf is worth. */
  marks: number
  subject: string
  /** Id of the previous part, the source of an ECF carry. */
  prevPartId?: string
  testid?: string
}>()
const emit = defineEmits<{ 'update:modelValue': [SchemeDef | undefined] }>()

const codes = computed(() => codesForSubject(props.subject))
const kind = computed(() => (props.modelValue?.kind === 'accepted' ? 'accepted' : 'points'))
const scheme = computed(() => props.modelValue)
const points = computed<PointDef[]>(() =>
  props.modelValue?.kind === 'points' ? props.modelValue.points : [],
)
const group = computed(() =>
  props.modelValue?.kind === 'points' ? props.modelValue.groups?.[0] : undefined,
)
const total = computed(() => schemeTotal(props.modelValue))
const mismatch = computed(() => props.modelValue !== undefined && total.value !== props.marks)

function setPoints(next: PointDef[], anyN = group.value?.anyN ?? 0, inGroup?: string[]): void {
  const ids = (inGroup ?? group.value?.pointIds ?? []).filter((id) => next.some((p) => p.id === id))
  const draft: SchemeDef = {
    kind: 'points',
    marks: 0,
    points: next,
    ...(ids.length > 0 ? { groups: [{ id: 'g1', anyN: Math.max(1, anyN || 1), pointIds: ids }] } : {}),
  }
  emit('update:modelValue', { ...draft, marks: schemeTotal(draft) })
}

function addPoint(): void {
  const code: PointCode = codes.value[0] ?? 'K'
  const n = points.value.length + 1
  setPoints([
    ...points.value,
    { id: `pt${Date.now().toString(36)}${n}`, code, marks: 1, label: '', match: { type: 'step', accept: [''] } },
  ])
}
function patch(i: number, p: Partial<PointDef>): void {
  setPoints(points.value.map((x, k) => (k === i ? { ...x, ...p } : x)))
}
function remove(i: number): void {
  setPoints(points.value.filter((_, k) => k !== i))
}
function setAlt(i: number, text: string): void {
  const accept = text.split('\n').map((s) => s.trim())
  patch(i, { match: { type: 'step', accept: accept.length > 0 ? accept : [''] } })
}
function altText(p: PointDef): string {
  return p.match.type === 'step' ? p.match.accept.join('\n') : ''
}
function toggleGroup(i: number, on: boolean): void {
  const id = points.value[i]!.id
  const ids = new Set(group.value?.pointIds ?? [])
  if (on) ids.add(id)
  else ids.delete(id)
  setPoints(points.value, group.value?.anyN ?? 1, [...ids])
}
function setAnyN(n: number): void {
  setPoints(points.value, n)
}
function toggleEcf(i: number, on: boolean): void {
  const p = points.value[i]!
  if (on && props.prevPartId)
    patch(i, {
      ecf: { fromPart: props.prevPartId, rule: { op: 'same' }, note: 'Ikut jawapan sendiri' },
    })
  else {
    const rest = { ...p }
    delete rest.ecf
    setPoints(points.value.map((x, k) => (k === i ? rest : x)))
  }
}

function switchKind(k: 'points' | 'accepted'): void {
  if (k === 'points') emit('update:modelValue', { kind: 'points', marks: 0, points: [] })
  else
    emit('update:modelValue', {
      kind: 'accepted',
      marks: props.marks,
      values: [{ v: '' }],
    })
}
const acceptedText = computed(() =>
  props.modelValue?.kind === 'accepted' ? props.modelValue.values.map((v) => v.v).join('\n') : '',
)
function setAccepted(text: string): void {
  emit('update:modelValue', {
    kind: 'accepted',
    marks: props.marks,
    values: text.split('\n').map((v) => ({ v: v.trim() })),
  })
}
</script>

<template>
  <div class="@container flex min-w-0 flex-col gap-3" :data-testid="testid ?? 'scheme-editor'">
    <div class="flex flex-wrap items-center justify-between gap-2">
      <p class="font-medium">Skema pemarkahan</p>
      <div class="flex gap-1" role="group" aria-label="Jenis skema">
        <UButton
          size="sm"
          :variant="kind === 'points' ? 'solid' : 'outline'"
          color="neutral"
          @click="kind !== 'points' && switchKind('points')"
        >
          Mata markah
        </UButton>
        <UButton
          size="sm"
          :variant="kind === 'accepted' ? 'solid' : 'outline'"
          color="neutral"
          @click="kind !== 'accepted' && switchKind('accepted')"
        >
          Jawapan diterima
        </UButton>
      </div>
    </div>

    <template v-if="kind === 'points'">
      <p v-if="points.length === 0" class="text-sm text-muted">
        Belum ada mata markah. Tambah mata pertama.
      </p>
      <ol class="flex flex-col gap-3">
        <li
          v-for="(p, i) in points"
          :key="p.id"
          class="rounded-xl border border-default bg-elevated/40 p-3"
          data-testid="scheme-point"
        >
          <div class="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 @lg:grid-cols-[6rem_5rem_minmax(0,1fr)_auto]">
            <label class="flex min-w-0 flex-col gap-1 text-sm">
              <span class="text-muted">Kod</span>
              <DsNativeSelect
                :model-value="p.code"
                :aria-label="`Kod mata ${i + 1}`"
                @update:model-value="patch(i, { code: String($event) as PointCode })"
              >
                <option v-for="c in codes" :key="c" :value="c" :title="CODE_NAMES[c]">{{ c }}</option>
              </DsNativeSelect>
            </label>
            <label class="flex min-w-0 flex-col gap-1 text-sm">
              <span class="text-muted">Markah</span>
              <UInput
                :model-value="p.marks"
                type="number"
                min="0"
                class="w-full"
                :aria-label="`Markah mata ${i + 1}`"
                @update:model-value="patch(i, { marks: Number($event) || 0 })"
              />
            </label>
            <label class="col-span-3 flex min-w-0 flex-col gap-1 text-sm @lg:col-span-1">
              <span class="text-muted">Penerangan ({{ pointTag(points, i) }})</span>
              <UInput
                :model-value="p.label"
                type="text"
                class="w-full"
                :aria-label="`Penerangan mata ${i + 1}`"
                @update:model-value="
                  patch(i, {
                    label: String($event),
                    match: {
                      type: 'step',
                      accept: [String($event), ...altText(p).split('\n').slice(1)],
                    },
                  })
                "
              />
            </label>
            <UButton
              icon="i-ph-trash"
              color="error"
              variant="ghost"
              :aria-label="`Buang mata ${pointTag(points, i)}`"
              @click="remove(i)"
            />
          </div>
          <details class="mt-2">
            <summary class="min-h-11 cursor-pointer py-2 text-sm text-muted">
              Jawapan alternatif ({{ Math.max(0, altText(p).split('\n').filter(Boolean).length - 1) }})
            </summary>
            <UTextarea
              :model-value="altText(p)"
              :rows="3"
              class="w-full"
              :aria-label="`Jawapan diterima mata ${pointTag(points, i)}, satu setiap baris`"
              @update:model-value="setAlt(i, String($event))"
            />
            <p class="text-xs text-muted">Satu bentuk setiap baris. Mana-mana satu diterima.</p>
          </details>
          <div class="mt-1 flex flex-wrap gap-x-5 gap-y-1">
            <UCheckbox
              :model-value="group?.pointIds.includes(p.id) ?? false"
              label="Dalam kumpulan mana-mana N"
              @update:model-value="(v: boolean | 'indeterminate') => toggleGroup(i, v === true)"
            />
            <UCheckbox
              :model-value="!!p.ecf"
              :disabled="!prevPartId && !p.ecf"
              label="Ikut jawapan sendiri (ECF)"
              @update:model-value="(v: boolean | 'indeterminate') => toggleEcf(i, v === true)"
            />
          </div>
        </li>
      </ol>

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          icon="i-ph-plus"
          size="sm"
          variant="outline"
          color="neutral"
          data-testid="scheme-add-point"
          @click="addPoint"
        >
          Tambah mata
        </UButton>
        <label v-if="group" class="flex items-center gap-2 text-sm">
          Mana-mana
          <UInput
            :model-value="group.anyN"
            type="number"
            min="1"
            :max="group.pointIds.length"
            class="w-20"
            aria-label="Bilangan mata yang dikira"
            @update:model-value="setAnyN(Number($event) || 1)"
          />
          daripada {{ group.pointIds.length }}
        </label>
      </div>
    </template>

    <template v-else>
      <label class="flex flex-col gap-1 text-sm">
        <span class="text-muted">Jawapan diterima (satu setiap baris)</span>
        <UTextarea
          :model-value="acceptedText"
          :rows="3"
          class="w-full"
          @update:model-value="setAccepted(String($event))"
        />
      </label>
    </template>

    <p
      class="text-sm"
      :class="mismatch ? 'text-error' : 'text-muted'"
      :role="mismatch ? 'alert' : undefined"
      data-testid="scheme-total"
    >
      Jumlah skema: {{ scheme ? total : 0 }} daripada {{ marks }} markah<template v-if="mismatch">
        . Jumlah mesti sama.</template
      >
    </p>
  </div>
</template>
