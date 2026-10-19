<script setup lang="ts">
/**
 * "DSKP Tagging (Pilihan)" cascade of S2 / S4 (FR-M04-33..36; FN-M04-1.4.1..1.4.5, DV-M04-06/15).
 *
 * Bidang loads when Subjek and Tahap are both set (#28); setting both again resets Bidang, SK and SP;
 * clearing one only empties the Bidang list (as live, AUD-M04-02: SK, SP, their lists and the posted SP
 * stay). SK is disabled until a Bidang is chosen, SP until an SK is chosen; choosing an SP shows
 * "DSKP tagged". S4 preloads the saved chain and shows it selected (a saved id missing from its new
 * parent list is cleared; a failed lookup keeps the saved ids and shows "Cuba Semula", T4-1) and offers "Buang tag DSKP" whenever a Bidang is selected.
 */
import { computed, onMounted, ref, watch } from 'vue'

import { DsFormField, DsLoadError, DsNativeSelect, DsText } from '@/ds'

import {
  fetchDskpBidang,
  fetchDskpSk,
  fetchDskpSp,
  type BidangOption,
  type SkOption,
  type SpOption,
} from '../api/lookups'
import type { QuestionDetail } from '../api/questions'
import { LOAD_ERROR } from '../lib/ui-errors'

const props = defineProps<{
  subjectId: string
  levelId: string
  /** The saved chain (S4). */
  initial?: QuestionDetail['dskp']
  /** S4: shows "Buang tag DSKP". */
  edit?: boolean
}>()

/** The chosen SP id as text (`''` = none); posted as `dskpSpId`. */
const spId = defineModel<string>('spId', { required: true })

const bidangId = ref('')
const skId = ref('')
const bidangList = ref<BidangOption[]>([])
const skList = ref<SkOption[]>([])
const spList = ref<SpOption[]>([])

const seq = { bidang: 0, sk: 0, sp: 0 }

/** The list a failed lookup left unloaded (shows the §8.2 error with "Cuba Semula"); `null` = none. */
type Failed = 'preload' | 'bidang' | 'sk' | 'sp'
const failed = ref<Failed | null>(null)

/**
 * Loads one list. `undefined` = a newer load replaced this one; `null` = the lookup failed (the
 * lists and the saved ids stay as they are, so a failure never reads as "id absent", T4-1).
 */
async function load<T>(
  level: 'bidang' | 'sk' | 'sp',
  fetcher: () => Promise<T[]>,
  target: { value: T[] },
): Promise<T[] | null | undefined> {
  const token = ++seq[level]
  let list: T[]
  try {
    list = await fetcher()
  } catch {
    if (token !== seq[level]) return undefined
    failed.value = level
    return null
  }
  if (token !== seq[level]) return undefined
  if (failed.value === level) failed.value = null
  target.value = list
  return list
}

const loadBidang = () =>
  load(
    'bidang',
    () => fetchDskpBidang({ subjectId: props.subjectId, educationLevelId: props.levelId }),
    bidangList,
  )
const loadSk = (id: string) => load('sk', () => fetchDskpSk(Number(id)), skList)
const loadSp = (id: string) => load('sp', () => fetchDskpSp(Number(id)), spList)

/** Invalidates the loads in flight of the lists below `from`. */
function cancelBelow(from: 'bidang' | 'sk' | 'sp'): void {
  if (from === 'bidang') seq.sk++
  seq.sp++
}

function resetAll(): void {
  bidangId.value = ''
  skId.value = ''
  spId.value = ''
  skList.value = []
  spList.value = []
  failed.value = null
  cancelBelow('bidang')
}

watch(
  () => [props.subjectId, props.levelId] as const,
  ([subject, level]) => {
    if (subject !== '' && level !== '') {
      resetAll()
      void loadBidang()
    } else {
      seq.bidang++
      bidangList.value = []
      if (failed.value === 'bidang' || failed.value === 'preload') failed.value = null
    }
  },
)

/**
 * S4: loads the saved chain and keeps it selected (DV-M04-15). A saved id that is absent from its
 * freshly loaded parent list is cleared; a failed lookup keeps every saved id.
 */
async function preload(saved: NonNullable<QuestionDetail['dskp']>): Promise<void> {
  const wantBidang = String(saved.bidang.id)
  const wantSk = String(saved.sk.id)
  const wantSp = String(saved.sp.id)
  failed.value = null
  const bidang = await loadBidang()
  if (bidang === undefined) return
  if (bidang === null) {
    failed.value = 'preload'
    return
  }
  if (!bidang.some((b) => String(b.id) === wantBidang)) return resetAll()
  const sk = await loadSk(wantBidang)
  if (sk === undefined) return
  if (sk === null) {
    failed.value = 'preload'
    return
  }
  if (!sk.some((s) => String(s.id) === wantSk)) {
    skId.value = ''
    spId.value = ''
    return
  }
  const sp = await loadSp(wantSk)
  if (sp === undefined) return
  if (sp === null) {
    failed.value = 'preload'
    return
  }
  if (!sp.some((s) => String(s.id) === wantSp)) spId.value = ''
}

onMounted(() => {
  const saved = props.initial
  if (saved) {
    bidangId.value = String(saved.bidang.id)
    skId.value = String(saved.sk.id)
    spId.value = String(saved.sp.id)
    void preload(saved)
  } else if (props.subjectId !== '' && props.levelId !== '') {
    void loadBidang()
  }
})

function retry(): void {
  const what = failed.value
  failed.value = null
  if (what === 'preload' && props.initial) void preload(props.initial)
  else if (what === 'bidang') void loadBidang()
  else if (what === 'sk' && bidangId.value !== '') void loadSk(bidangId.value)
  else if (what === 'sp' && skId.value !== '') void loadSp(skId.value)
}

/** A select shows its placeholder when its value is not among its options. */
const shown = (value: string, list: readonly { id: number }[]): string =>
  list.some((o) => String(o.id) === value) ? value : ''

const bidangModel = computed({
  get: () => shown(bidangId.value, bidangList.value),
  set: (value: string) => {
    failed.value = failed.value === 'bidang' ? failed.value : null
    bidangId.value = value
    skId.value = ''
    spId.value = ''
    skList.value = []
    spList.value = []
    cancelBelow('bidang')
    if (value !== '') void loadSk(value)
  },
})
const skModel = computed({
  get: () => shown(skId.value, skList.value),
  set: (value: string) => {
    if (failed.value !== 'bidang' && failed.value !== 'sk') failed.value = null
    skId.value = value
    spId.value = ''
    spList.value = []
    cancelBelow('sk')
    if (value !== '') void loadSp(value)
  },
})
const spModel = computed({
  get: () => shown(spId.value, spList.value),
  set: (value: string) => {
    spId.value = value
  },
})

function removeTag(): void {
  resetAll()
}
</script>

<template>
  <UCard variant="subtle" data-testid="dskp-block">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h3 class="flex items-center gap-2 text-label text-highlighted">
        <UIcon name="i-ph-tag" class="size-5 text-primary-t" />
        DSKP Tagging <DsText variant="caption" as="span">(Pilihan)</DsText>
      </h3>
      <UButton
        v-if="edit && bidangId !== ''"
        type="button"
        color="error"
        variant="ghost"
        icon="i-ph-x"
        class="min-h-11"
        data-testid="dskp-remove"
        @click="removeTag"
      >
        Buang tag DSKP
      </UButton>
    </div>
    <div class="grid grid-cols-1 items-end gap-3 2xl:grid-cols-3">
      <DsFormField v-slot="{ id }" native for="q-dskp-bidang" label="Bidang">
        <DsNativeSelect :id="id" v-model="bidangModel" data-testid="dskp-bidang">
          <option value="">-- Pilih Bidang --</option>
          <option v-for="b in bidangList" :key="b.id" :value="String(b.id)">
            {{ b.code ? `${b.code} - ${b.name}` : b.name }}
          </option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-slot="{ id }" native for="q-dskp-sk" label="Standard Kandungan">
        <DsNativeSelect
          :id="id"
          v-model="skModel"
          :disabled="bidangId === ''"
          data-testid="dskp-sk"
        >
          <option value="">-- Pilih SK --</option>
          <option v-for="s in skList" :key="s.id" :value="String(s.id)">
            {{ s.code }} - {{ s.description }}
          </option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-slot="{ id }" native for="q-dskp-sp" label="Standard Pembelajaran">
        <DsNativeSelect
          :id="id"
          v-model="spModel"
          name="dskp_sp_id"
          :disabled="skId === ''"
          data-testid="dskp-sp"
        >
          <option value="">-- Pilih SP --</option>
          <option v-for="s in spList" :key="s.id" :value="String(s.id)">
            {{ s.code }} - {{ s.description }}
          </option>
        </DsNativeSelect>
      </DsFormField>
    </div>
    <DsLoadError
      v-if="failed"
      variant="inline"
      class="mt-3"
      :message="LOAD_ERROR"
      testid="dskp-load-error"
      retry-testid="dskp-retry"
      @retry="retry"
    />
    <p
      v-if="spId !== ''"
      class="mt-3 flex items-center gap-2 text-caption text-success"
      data-testid="dskp-tagged"
    >
      <UIcon name="i-ph-check-circle" class="size-4" />
      DSKP tagged
    </p>
  </UCard>
</template>
