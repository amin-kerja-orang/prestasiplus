<script setup lang="ts">
/**
 * Profil kesukaran of one Bahagian (design 4.3 b, US-35): the kind, then the slot groups with TP
 * band, optional exact TP counts and (when "Tetapkan markah mengikut slot" is on) exact marks.
 * "Blok tema" is not offered (D-9). One group per Bahagian for "Mengikut Bahagian" and for choose-N.
 */
import { computed, nextTick, reactive } from 'vue'

import { DsFormField, DsNativeSelect } from '@/ds'

import { emptyGroup, groupSize, type FormSection, type ProfileKind } from '../domain/form'
import { fieldId, type Issue } from '../domain/validate'
import NumField from './NumField.vue'
import SumMeter from './SumMeter.vue'

const props = defineProps<{ index: number; issues: readonly Issue[] }>()
const s = defineModel<FormSection>({ required: true })

const TP = [1, 2, 3, 4, 5, 6].map((n) => ({ label: `TP ${n}`, value: n }))
const choose = computed(() => s.value.ruleType === 'choose')
const m = computed(() => s.value.questionCount ?? 0)
const kindItems = computed(() => {
  const items: { value: ProfileKind; label: string; description: string; disabled?: boolean }[] = [
    {
      value: 'ladder',
      label: 'Tangga mengikut nombor soalan',
      description: 'TP naik mengikut nombor soalan dalam bahagian ini.',
      disabled: choose.value,
    },
    {
      value: 'bahagian',
      label: 'Mengikut Bahagian',
      description: 'Satu jalur TP untuk semua soalan bahagian ini; susunan dalam bahagian tidak diisih.',
    },
  ]
  if (s.value.profileKind === 'tema') {
    items.push({ value: 'tema', label: 'Blok tema', description: 'Tidak boleh disunting di sini.', disabled: true })
  }
  return items
})

const profileErrors = computed(() =>
  props.issues.filter((i) => i.level === 'error' && i.section === props.index && i.part === 'profil'),
)

function setKind(kind: ProfileKind): void {
  const cur = s.value
  const first = cur.groups[0]
  cur.profileKind = kind
  if (kind === 'bahagian' || choose.value || cur.groups.length === 0) {
    const g = emptyGroup(1, m.value || null)
    if (first) {
      g.tpMin = first.tpMin
      g.tpMax = cur.groups[cur.groups.length - 1]?.tpMax ?? first.tpMax
      g.marks = first.marks
    }
    cur.groups = [g]
  }
}

function lock(gi: number): boolean {
  return s.value.profileKind === 'bahagian' || choose.value || (s.value.profileKind === 'ladder' && gi === 0)
}

function setTo(gi: number, to: number | null): void {
  const groups = s.value.groups
  const g = groups[gi]
  if (!g) return
  g.to = to
  const next = groups[gi + 1]
  if (s.value.profileKind === 'ladder' && next && to !== null) next.from = to + 1
}

const covered = computed(() => {
  const gs = s.value.groups.filter((g) => g.from !== null && g.to !== null)
  const slots = new Set<number>()
  for (const g of gs) for (let x = g.from!; x <= g.to!; x += 1) if (x >= 1 && x <= m.value) slots.add(x)
  const missing: number[] = []
  for (let x = 1; x <= m.value; x += 1) if (!slots.has(x)) missing.push(x)
  return { count: slots.size, missing }
})
const missingText = computed(() => {
  const out: string[] = []
  const xs = covered.value.missing
  let i = 0
  while (i < xs.length) {
    let j = i
    while (j + 1 < xs.length && xs[j + 1] === xs[j]! + 1) j += 1
    out.push(i === j ? `${xs[i]}` : `${xs[i]}-${xs[j]}`)
    i = j + 1
  }
  return out.join(', ')
})

const canAdd = computed(() => s.value.profileKind === 'ladder' && !choose.value)
const full = computed(() => (s.value.groups[s.value.groups.length - 1]?.to ?? 0) >= m.value)

async function addGroup(): Promise<void> {
  const last = s.value.groups[s.value.groups.length - 1]
  const from = (last?.to ?? 0) + 1
  const g = emptyGroup(from, m.value || from)
  if (last) {
    g.tpMin = last.tpMin
    g.tpMax = last.tpMax
  }
  s.value.groups.push(g)
  await nextTick()
  document.getElementById(fieldId(props.index, `g${s.value.groups.length - 1}-to`))?.focus()
}

async function removeGroup(gi: number): Promise<void> {
  s.value.groups.splice(gi, 1)
  await nextTick()
  const target = document.getElementById(fieldId(props.index, `g${Math.min(gi, s.value.groups.length - 1)}-to`))
  ;(target ?? document.getElementById(fieldId(props.index, 'add-group')))?.focus()
}

const open = reactive<Record<number, boolean>>({})
const countOf = (gi: number): number =>
  Object.values(s.value.groups[gi]?.tpCounts ?? {}).reduce<number>((n, c) => n + (c ?? 0), 0)
const tpsOf = (gi: number): number[] => {
  const g = s.value.groups[gi]
  if (!g) return []
  const out: number[] = []
  for (let t = g.tpMin; t <= g.tpMax; t += 1) out.push(t)
  return out
}
function setCount(gi: number, tp: number, v: number | null): void {
  const g = s.value.groups[gi]
  if (g) g.tpCounts = { ...g.tpCounts, [tp]: v }
}
</script>

<template>
  <div :id="fieldId(index, 'profil')" class="flex flex-col gap-4" tabindex="-1">
    <fieldset class="min-w-0">
      <legend class="mb-2 text-label text-default">Profil kesukaran</legend>
      <URadioGroup
        :model-value="s.profileKind ?? undefined"
        :items="kindItems"
        :ui="{ item: 'min-h-11' }"
        data-testid="profile-kind"
        @update:model-value="(v: unknown) => setKind(v as ProfileKind)"
      />
      <p v-if="!s.profileKind" class="mt-1 text-caption text-muted">Belum ditetapkan.</p>
      <p v-if="choose" class="mt-1 text-caption text-muted">
        Bahagian pilih N menggunakan satu kumpulan slot.
      </p>
    </fieldset>

    <template v-if="s.profileKind">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h4 class="text-label text-default">Kumpulan slot</h4>
        <SumMeter label="Slot dilitupi" :value="covered.count" :target="m" />
      </div>
      <p v-if="covered.missing.length" class="text-caption text-muted" data-testid="slot-missing">
        Belum dilitupi: {{ missingText }}.
      </p>

      <ul class="flex flex-col gap-3">
        <li
          v-for="(g, gi) in s.groups"
          :key="gi"
          class="min-w-0 rounded-md bg-elevated p-3"
          :data-testid="`slot-group-${gi}`"
        >
          <p class="mb-2 text-label text-highlighted">
            Slot {{ g.from ?? '?' }} - {{ g.to ?? '?' }}
          </p>
          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <DsFormField native :for="fieldId(index, `g${gi}-from`)" label="Slot dari">
              <template #default="f">
                <NumField
                  :id="f.id"
                  v-model="g.from"
                  :min="1"
                  :readonly="lock(gi)"
                  :invalid="f.invalid"
                />
              </template>
            </DsFormField>
            <DsFormField native :for="fieldId(index, `g${gi}-to`)" label="Slot hingga">
              <template #default="f">
                <NumField
                  :id="f.id"
                  :model-value="g.to"
                  :min="1"
                  :readonly="s.profileKind === 'bahagian' || choose"
                  :invalid="f.invalid"
                  @update:model-value="(v) => setTo(gi, v)"
                />
              </template>
            </DsFormField>
            <DsFormField
              native
              :for="fieldId(index, `g${gi}-tpmin`)"
              label="TP minimum"
              :error="g.tpMin > g.tpMax ? 'TP minimum tidak boleh melebihi TP maksimum.' : undefined"
            >
              <template #default="f">
                <DsNativeSelect :id="f.id" v-model="g.tpMin" :items="TP" :invalid="f.invalid" />
              </template>
            </DsFormField>
            <DsFormField native :for="fieldId(index, `g${gi}-tpmax`)" label="TP maksimum">
              <template #default="f">
                <DsNativeSelect :id="f.id" v-model="g.tpMax" :items="TP" :invalid="f.invalid" />
              </template>
            </DsFormField>
          </div>

          <div v-if="s.perSlotMarks" class="mt-3 max-w-xs">
            <DsFormField native :for="fieldId(index, `g${gi}-marks`)" label="Markah setiap soalan">
              <template #default="f">
                <NumField :id="f.id" v-model="g.marks" :min="1" :invalid="f.invalid" />
              </template>
            </DsFormField>
          </div>

          <div class="mt-3 flex flex-wrap items-center gap-2">
            <UButton
              color="neutral"
              variant="soft"
              size="sm"
              class="min-h-11"
              :aria-expanded="!!open[gi]"
              :aria-controls="fieldId(index, `g${gi}-counts`)"
              :label="open[gi] ? 'Sembunyikan kiraan tepat' : 'Tetapkan kiraan tepat'"
              @click="open[gi] = !open[gi]"
            />
            <UButton
              v-if="canAdd && s.groups.length > 1"
              color="error"
              variant="ghost"
              size="sm"
              class="min-h-11"
              icon="i-ph-trash"
              :label="`Buang kumpulan ${gi + 1}`"
              :aria-label="`Buang kumpulan slot ${g.from ?? ''} - ${g.to ?? ''}`"
              @click="removeGroup(gi)"
            />
          </div>

          <div v-show="open[gi]" :id="fieldId(index, `g${gi}-counts`)" class="mt-3 flex flex-col gap-2">
            <p class="text-caption text-muted">
              Pilihan. Jika diisi, kiraan mesti sama dengan bilangan slot dalam kumpulan.
            </p>
            <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
              <DsFormField
                v-for="tp in tpsOf(gi)"
                :key="tp"
                native
                :for="fieldId(index, `g${gi}-c${tp}`)"
                :label="`TP ${tp}`"
              >
                <template #default="f">
                  <NumField
                    :id="f.id"
                    :model-value="g.tpCounts[tp] ?? null"
                    @update:model-value="(v) => setCount(gi, tp, v)"
                  />
                </template>
              </DsFormField>
            </div>
            <SumMeter label="Jumlah kiraan" :value="countOf(gi)" :target="groupSize(g)" unit="slot" />
          </div>
        </li>
      </ul>

      <div v-if="canAdd">
        <UButton
          :id="fieldId(index, 'add-group')"
          color="neutral"
          variant="soft"
          class="min-h-11"
          icon="i-ph-plus"
          label="Tambah kumpulan slot"
          :disabled="full"
          @click="addGroup"
        />
        <p v-if="full" class="mt-1 text-caption text-muted">Semua slot sudah dilitupi.</p>
      </div>
      <ul v-if="profileErrors.length" class="flex flex-col gap-1" data-testid="profile-errors">
        <li
          v-for="e in profileErrors"
          :key="e.id"
          class="flex items-start gap-1 text-caption text-error"
        >
          <UIcon name="i-ph-warning-circle" class="mt-px size-4 shrink-0" aria-hidden="true" />
          <span>{{ e.message }}</span>
        </li>
      </ul>
    </template>
  </div>
</template>
