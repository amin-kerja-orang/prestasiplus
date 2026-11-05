<script setup lang="ts">
/**
 * Editor of one Tracking A set (`/admin/spm/tracking-a/:set/sunting`, R1-ADM-Q-17, API-BIJAK-13). The list is a local draft until `Simpan` (one
 * transaction). A stimulus group is one row: added, swapped, moved and removed whole (FR-ADM-Q17.6). `Isi set` takes the candidates in order and stops
 * at a group that does not fit; the admin decides (PO 15). `Naik`/`Turun` replace the V2 drag handles (D-20). `:set = baharu` opens on `Tambah Set`
 * alone (D-21). The editor never creates a question: `Buka di laman berasingan` opens the bank editor (FR-ADM-Q17.4).
 */
import {
  TRACKING_A_KIND,
  TRACKING_A_MESSAGES as COPY,
  TRACKING_A_PROPOSED_COPY as PROPOSED,
  TRACKING_A_SET_NO_MAX,
  TRACKING_A_YEAR_DEFAULT,
  TRACKING_A_YEAR_MIN,
  type SpmAdminTrackingASet,
} from '@pp/contract'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFlash, usePageMeta } from '@/composables'
import { DsBadge, DsCallout, DsCluster, DsDefinitionList, DsFormField, DsHeading, DsLink, DsListRow, DsLoadError, DsNativeSelect, DsPage, DsPanel, DsRowActions, DsSplit, DsStack, DsText, type RowAction } from '@/ds'

import { ADMIN_ROUTES } from '../../papers/ui'
import { KANDUNGAN_ROUTES, TRACKING_NEW_SET, TrackingRefusal, type LaneSubject } from '../api'
import { kandunganServer } from '../client'
import { fillTrackingSet, moveTrackingUnit, swapTrackingUnit, trackingCount, trackingFree, trackingUnitKey, type TrackingUnit } from '../lanes'

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const pageMeta = usePageMeta()
const server = kandunganServer()

const setParam = computed(() => String(route.params.set ?? ''))
const isNew = computed(() => setParam.value === TRACKING_NEW_SET)

const loading = ref(false)
const loadError = ref(false)
const set = ref<SpmAdminTrackingASet | null>(null)
const draft = ref<TrackingUnit[]>([])
const dirty = ref(false)
const saving = ref(false)
const notice = ref('')
const selectedKey = ref('')
const pick = ref('')

const target = computed(() => set.value?.targetCount ?? 0)
const current = computed(() => trackingCount(draft.value))
const needed = computed(() => Math.max(0, target.value - current.value))
const isFull = computed(() => set.value !== null && needed.value === 0)
const options = computed(() => trackingFree(draft.value, set.value?.candidateItems ?? []))
const selected = computed(() => draft.value.find((u) => trackingUnitKey(u) === selectedKey.value) ?? null)
const fieldItems = computed(() =>
  set.value
    ? [
        { key: 'subject', label: 'Subjek', value: set.value.subject },
        { key: 'year', label: 'Tahun', value: String(set.value.year) },
        { key: 'setNo', label: 'Set', value: String(set.value.setNo) },
        { key: 'target', label: PROPOSED.targetFieldLabel, value: set.value.targetCount },
      ]
    : [],
)

/** Row number of each unit in the current draft: a group takes as many numbers as it has questions. */
const numbers = computed(() => {
  let next = 1
  return draft.value.map((u) => {
    const first = next
    next += u.questions
    return u.questions === 1 ? String(first) : `${String(first)}-${String(next - 1)}`
  })
})
const optionLabel = (u: TrackingUnit): string => (u.kind === 'group' ? PROPOSED.groupRow(u.label, u.questions) : `#${u.id} · ${u.label}`)

function adopt(s: SpmAdminTrackingASet): void {
  set.value = s
  draft.value = s.items.map((i) => ({ kind: i.kind, id: i.id, questions: i.questions, label: i.label, members: i.members }))
  dirty.value = false
  selectedKey.value = ''
  pick.value = ''
  // D-22: the editor's own title; the tab adds the one brand suffix of the app (`formatTabTitle`).
  pageMeta.setTitle(`${s.subject} · ${String(s.year)} · Set ${String(s.setNo)}`)
  pageMeta.setHeader({ title: 'Tracking A' })
}

async function load(): Promise<void> {
  notice.value = ''
  set.value = null
  draft.value = []
  loadError.value = false
  if (isNew.value) {
    openAdd()
    return
  }
  loading.value = true
  try {
    adopt(await server.trackingSet(setParam.value))
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}
function change(units: TrackingUnit[]): void {
  draft.value = units
  dirty.value = true
  notice.value = ''
}

function fill(): void {
  if (!set.value) return
  const res = fillTrackingSet(draft.value, set.value.candidateItems, target.value)
  if (res.added > 0) change(res.units)
  if (res.stopped) notice.value = COPY.groupNoFit(res.stopped.label, res.stopped.questions, res.stopped.free)
  else if (res.added === 0) notice.value = COPY.fillNone
}

function addPicked(): void {
  const unit = options.value.find((u) => trackingUnitKey(u) === pick.value)
  if (!unit) return
  if (unit.questions > needed.value) {
    notice.value = COPY.groupNoFit(unit.label, unit.questions, needed.value)
    return
  }
  change([...draft.value, unit])
  pick.value = ''
}

/** Fresh candidates, because time may have passed since the page opened. The row may be gone by the time they arrive. */
async function swap(unit: TrackingUnit): Promise<void> {
  if (!set.value) return
  notice.value = ''
  const key = trackingUnitKey(unit)
  let fresh: SpmAdminTrackingASet
  try {
    fresh = await server.trackingSet(set.value.id)
  } catch {
    notice.value = COPY.swapFailed
    return
  }
  const index = draft.value.findIndex((u) => trackingUnitKey(u) === key)
  if (index < 0) {
    notice.value = COPY.swapGone
    return
  }
  const next = swapTrackingUnit(draft.value, index, fresh.candidateItems, fresh.targetCount)
  if (!next) {
    notice.value = COPY.swapNone
    return
  }
  change(next)
}

function remove(unit: TrackingUnit): void {
  const key = trackingUnitKey(unit)
  if (selectedKey.value === key) selectedKey.value = ''
  change(draft.value.filter((u) => trackingUnitKey(u) !== key))
}

const rowActions = (unit: TrackingUnit, index: number): RowAction[] => [
  { label: 'tukar', testid: `set-swap-${unit.id}`, onSelect: () => void swap(unit) },
  { label: 'buang', testid: `set-remove-${unit.id}`, onSelect: () => remove(unit) },
  { label: 'Naik', testid: `set-up-${unit.id}`, disabled: index === 0, onSelect: () => change(moveTrackingUnit(draft.value, index, -1)) },
  { label: 'Turun', testid: `set-down-${unit.id}`, disabled: index === draft.value.length - 1, onSelect: () => change(moveTrackingUnit(draft.value, index, 1)) },
]

async function save(): Promise<void> {
  if (!set.value) return
  if (draft.value.length === 0) {
    notice.value = COPY.saveEmpty
    return
  }
  saving.value = true
  notice.value = ''
  try {
    adopt(await server.saveTrackingSet(set.value.id, { items: draft.value.map((u) => ({ kind: u.kind, id: u.id })) }))
    flash.show({ type: 'success', message: COPY.saved })
  } catch (e) {
    notice.value = (e as Error).message
  } finally {
    saving.value = false
  }
}


/* ------------------------------------------------------------------------------- Tambah Set */

const adding = ref(false)
const subjects = ref<LaneSubject[]>([])
const addForm = reactive({ subjectId: '', year: TRACKING_A_YEAR_DEFAULT, setNo: 1 })
const addErrors = reactive<Record<string, string>>({ subjectId: '', year: '', setNo: '' })
const creating = ref(false)
const addError = ref('')
const years = computed(() => {
  const max = new Date().getFullYear() + 1
  return Array.from({ length: max - TRACKING_A_YEAR_MIN + 1 }, (_, i) => max - i)
})

function openAdd(): void {
  adding.value = true
  addForm.subjectId = set.value?.subjectId ?? ''
  addForm.year = set.value?.year ?? TRACKING_A_YEAR_DEFAULT
  addForm.setNo = 1
  Object.assign(addErrors, { subjectId: '', year: '', setNo: '' })
  addError.value = ''
  if (subjects.value.length === 0) {
    void server.trackingLane({ page: 1, pageSize: 1 }).then(
      (lane) => (subjects.value = lane.setSubjects),
      () => (addError.value = 'Tidak dapat memuatkan senarai.'),
    )
  }
}

function closeAdd(): void {
  if (isNew.value) void router.push({ name: KANDUNGAN_ROUTES.trackingA })
  adding.value = false
}

async function createSet(): Promise<void> {
  Object.assign(addErrors, { subjectId: '', year: '', setNo: '' })
  if (addForm.subjectId === '') {
    addErrors.subjectId = COPY.subjectRequired
    return
  }
  const setNo = Number(addForm.setNo)
  if (!Number.isInteger(setNo) || setNo < 1 || setNo > TRACKING_A_SET_NO_MAX) {
    addErrors.setNo = PROPOSED.setNoRange
    return
  }
  creating.value = true
  try {
    const created = await server.createTrackingSet({ subjectId: addForm.subjectId, year: Number(addForm.year), setNo })
    adding.value = false
    await router.push({ name: KANDUNGAN_ROUTES.trackingAEdit, params: { set: created.id } })
  } catch (e) {
    if (e instanceof TrackingRefusal) Object.assign(addErrors, e.fields)
    else addError.value = (e as Error).message
  } finally {
    creating.value = false
  }
}
watch(setParam, () => void load(), { immediate: true })
</script>

<template>
  <DsPage layout="detail" :back-to="{ name: KANDUNGAN_ROUTES.trackingA }" data-testid="tracking-editor">
    <DsPanel v-if="adding" :title="PROPOSED.addHeading" data-testid="tracking-add-form">
      <DsStack gap="sm">
        <DsFormField label="Subjek" required native :error="addErrors.subjectId">
          <DsNativeSelect v-model="addForm.subjectId" aria-label="Subjek" data-testid="tracking-add-subject">
            <option value="">{{ PROPOSED.subjectPlaceholder }}</option>
            <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField label="Tahun" required native :error="addErrors.year">
          <DsNativeSelect v-model="addForm.year" aria-label="Tahun" data-testid="tracking-add-year">
            <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
          </DsNativeSelect>
        </DsFormField>
        <DsFormField label="Set" required native :error="addErrors.setNo">
          <UInput v-model.number="addForm.setNo" type="number" :min="1" :max="TRACKING_A_SET_NO_MAX" aria-label="Set" data-testid="tracking-add-setno" />
        </DsFormField>
        <DsText v-if="addError" as="p" variant="caption" tone="error" role="alert">{{ addError }}</DsText>
        <DsCluster gap="xs">
          <UButton label="Tambah Set" :loading="creating" data-testid="tracking-add-submit" @click="createSet()" />
          <UButton :label="PROPOSED.addCancel" color="neutral" variant="ghost" data-testid="tracking-add-cancel" @click="closeAdd()" />
        </DsCluster>
      </DsStack>
    </DsPanel>

    <DsLoadError v-if="loadError" message="Tidak dapat memuatkan set." @retry="load()" />
    <DsText v-else-if="loading" as="p" variant="body" tone="muted" data-testid="tracking-loading">{{ COPY.loading }}</DsText>

    <DsSplit v-if="set" ratio="8-4" data-testid="tracking-split">
      <DsStack gap="md">
        <DsPanel>
          <DsStack gap="sm">
            <DsCluster gap="xs">
              <DsHeading :level="2">{{ COPY.sectionHeading }}</DsHeading>
              <DsBadge :label="TRACKING_A_KIND" data-testid="tracking-kind" />
              <DsText variant="body" data-testid="tracking-counter">{{ current }} / {{ target }}</DsText>
            </DsCluster>
            <DsDefinitionList :items="fieldItems" data-testid="tracking-fields" />
            <DsText v-if="dirty" as="p" variant="caption" tone="muted" data-testid="tracking-unsaved">{{ PROPOSED.unsaved }}</DsText>
            <DsCallout v-if="notice" tone="error" :description="notice" data-testid="tracking-notice" />

            <DsText v-if="draft.length === 0" as="p" variant="body" tone="muted" data-testid="tracking-empty">{{ COPY.empty }}</DsText>
            <DsStack v-else gap="sm" data-testid="tracking-rows">
              <DsPanel v-for="(unit, index) in draft" :key="trackingUnitKey(unit)" :data-testid="`tracking-row-${unit.id}`" :data-kind="unit.kind" padding="sm">
                <DsStack gap="xs">
                  <DsListRow
                    button
                    density="tight"
                    :title="`${numbers[index]}. ${unit.kind === 'group' ? PROPOSED.groupRow(unit.label, unit.questions) : unit.label}`"
                    :data-testid="`tracking-select-${unit.id}`"
                    @select="selectedKey = trackingUnitKey(unit)"
                  />
                  <template v-for="m in unit.members" :key="m.id">
                    <DsText v-if="unit.kind === 'group'" as="p" variant="caption" tone="muted" wrap="anywhere">{{ m.stem }}</DsText>
                    <DsText v-if="!m.servable" as="p" variant="caption" tone="error" :data-testid="`tracking-unserved-${m.id}`">
                      {{ m.statusWord ? `${m.statusWord} · ` : '' }}{{ COPY.notServed }}
                    </DsText>
                  </template>
                  <DsRowActions :actions="rowActions(unit, index)" :inline="4" />
                </DsStack>
              </DsPanel>
            </DsStack>
          </DsStack>
        </DsPanel>

        <DsPanel data-testid="tracking-fill-block">
          <DsStack gap="sm">
            <template v-if="!isFull">
              <DsCluster gap="sm">
                <UButton label="Isi set" color="neutral" variant="outline" data-testid="tracking-fill" @click="fill()" />
                <DsText variant="body" data-testid="tracking-needed">{{ COPY.needed(needed) }}</DsText>
              </DsCluster>
              <DsText as="p" variant="caption" tone="muted" data-testid="tracking-available">{{ COPY.available(set.subject, set.candidates) }}</DsText>
              <DsFormField :label="PROPOSED.pickLabel" native>
                <DsNativeSelect v-model="pick" :aria-label="PROPOSED.pickLabel" data-testid="tracking-pick">
                  <option value="">{{ PROPOSED.pickPlaceholder }}</option>
                  <option v-for="u in options" :key="trackingUnitKey(u)" :value="trackingUnitKey(u)">{{ optionLabel(u) }}</option>
                </DsNativeSelect>
              </DsFormField>
              <DsCluster gap="xs">
                <UButton :label="PROPOSED.pickAdd" color="neutral" variant="outline" :disabled="pick === ''" data-testid="tracking-pick-add" @click="addPicked()" />
              </DsCluster>
            </template>
            <DsText v-else as="p" variant="body" data-testid="tracking-full">{{ COPY.complete }}</DsText>
          </DsStack>
        </DsPanel>

        <DsCluster gap="xs">
          <UButton label="Simpan" :loading="saving" data-testid="tracking-save" @click="save()" />
          <UButton label="Tambah Set" color="neutral" variant="outline" data-testid="tracking-add-open" @click="openAdd()" />
        </DsCluster>
      </DsStack>

      <template #aside>
        <DsPanel :title="COPY.paneHeading" data-testid="tracking-pane">
          <DsStack gap="sm">
            <DsText v-if="!selected" as="p" variant="body" tone="muted" data-testid="tracking-pane-empty">{{ COPY.paneEmpty }}</DsText>
            <template v-else>
              <DsStack v-for="m in selected.members" :key="m.id" gap="2xs">
                <DsText as="p" variant="body" wrap="anywhere">{{ m.stem }}</DsText>
                <DsLink :to="{ name: ADMIN_ROUTES.bankEdit, params: { qid: m.id } }" :data-testid="`tracking-open-${m.id}`">{{ COPY.paneOpen }}</DsLink>
              </DsStack>
            </template>
          </DsStack>
        </DsPanel>
      </template>
    </DsSplit>
  </DsPage>
</template>
