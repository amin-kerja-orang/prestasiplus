<script setup lang="ts">
/**
 * The shared stimulus of a question (D90, T13) on the stimulus API (T32). A figure, passage or table that several questions
 * refer to ("Rajah 1" for S1 and S2) is ONE group: stored once, shown once with every member under it, no marks. The author
 * creates the group from a saved question (a stimulus plus at least one more question), edits its stimuli (1 to 3), and adds,
 * removes and reorders its members; member changes are saved together. A group with a served member is read-only here.
 */
import { computed, ref, watch } from 'vue'

import { DsCallout, DsCluster, DsFormField, DsHeading, DsLoadError, DsStack, DsSurface, DsText } from '@/ds'

import {
  addGroupMember,
  createGroup,
  createStimulus,
  dissolveGroup,
  fetchGroup,
  fetchStudioQuestion,
  removeGroupMember,
  reorderGroupMembers,
  searchQuestions,
  setGroupStimuli,
  updateStimulus,
  type QuestionPick,
} from '../../api/studio'
import {
  addMember,
  type GroupView,
  memberIssues,
  moveMember,
  planMembers,
  removeMember,
  type GroupMember,
} from '../../lib/studio/group-members'
import {
  blankStimulus,
  stimulusFormOf,
  stimulusIssue,
  toCreateBody,
  toUpdateBody,
  type StimulusForm,
} from '../../lib/studio/stimulus'
import { errorLines, LOAD_ERROR } from '../../lib/ui-errors'
import StudioStimulusEditor from './StudioStimulusEditor.vue'

const props = withDefaults(defineProps<{ disabled?: boolean; currentQuestionId?: string | null; testid?: string }>(), {
  disabled: false,
  currentQuestionId: null,
  testid: 'studio-group',
})
const groupId = defineModel<string | null>('groupId', { required: true })
const emit = defineEmits<{ changed: [view: GroupView | null] }>()

const SERVING = ['approved', 'published']
const view = ref<GroupView | null>(null)
const members = ref<GroupMember[]>([])
const saved = ref<Record<string, StimulusForm>>({})
const forms = ref<Record<string, StimulusForm>>({})
const loading = ref(false)
const loadFailed = ref(false)
const busy = ref(false)
const notice = ref('')
const problems = ref<string[]>([])
const fresh = ref<StimulusForm>(blankStimulus())
const adding = ref<StimulusForm>(blankStimulus())
const showAddStimulus = ref(false)
const attachId = ref('')
const search = ref('')
const found = ref<QuestionPick[]>([])
const searching = ref(false)
const picks = ref<GroupMember[]>([])

const locked = computed(() => props.disabled || view.value?.locked === true)
const savedMembers = computed(() => view.value?.members ?? [])
const dirty = computed(() => planMembers(savedMembers.value, members.value) !== null)
const issues = computed(() => memberIssues(members.value))
const stimulusFull = computed(() => (view.value?.stimuli.length ?? 0) >= 3)
const canCreate = computed(() => props.currentQuestionId !== null && picks.value.length >= 1)

function adopt(next: GroupView | null): void {
  view.value = next
  members.value = next ? [...next.members] : []
  const f = next ? Object.fromEntries(next.stimuli.map((s) => [s.id, stimulusFormOf(s)])) : {}
  saved.value = f
  forms.value = JSON.parse(JSON.stringify(f)) as Record<string, StimulusForm>
  emit('changed', next)
}

/** The group and the stem, number and status of each member (the group read carries ids only). */
async function read(id: string): Promise<GroupView> {
  const g = await fetchGroup(id)
  const list: GroupMember[] = []
  let served = false
  for (let i = 0; i < g.questionIds.length; i += 6) {
    const chunk = await Promise.all(g.questionIds.slice(i, i + 6).map((q) => fetchStudioQuestion(q)))
    for (const q of chunk) {
      list.push({ id: q.id, numberLabel: q.numberLabel ?? '', stem: q.questionText.slice(0, 120) })
      if (SERVING.includes(q.status)) served = true
    }
  }
  return { id: g.id, stimuli: g.stimuli, members: list, locked: served }
}

let seq = 0
async function load(id: string | null): Promise<void> {
  const token = ++seq
  problems.value = []
  loadFailed.value = false
  if (id === null) return adopt(null)
  loading.value = true
  try {
    const v = await read(id)
    if (token === seq) adopt(v)
  } catch {
    if (token === seq) {
      loadFailed.value = true
      adopt(null)
    }
  } finally {
    if (token === seq) loading.value = false
  }
}
watch(groupId, (id) => void load(id), { immediate: true })

/** Runs one step; shows the server text on success and its problems on failure. */
async function run<T>(call: () => Promise<{ data: T; status: string }>): Promise<T | null> {
  busy.value = true
  notice.value = ''
  problems.value = []
  try {
    const res = await call()
    notice.value = res.status
    return res.data
  } catch (err) {
    problems.value = errorLines(err)
    return null
  } finally {
    busy.value = false
  }
}

/** Reads the group again but keeps the text of the step that just ran (a refusal must stay visible). */
async function reload(): Promise<void> {
  const keep = { problems: problems.value, notice: notice.value }
  if (groupId.value !== null) await load(groupId.value)
  problems.value = keep.problems
  notice.value = keep.notice
}

async function create(): Promise<void> {
  const me = props.currentQuestionId
  const issue = stimulusIssue(fresh.value)
  if (issue !== null) {
    problems.value = [issue]
    return
  }
  if (me === null || picks.value.length < 1) {
    problems.value = ['Pilih sekurang-kurangnya satu soalan lain untuk dikongsi.']
    return
  }
  const g = await run(async () => {
    const s = await createStimulus(toCreateBody(fresh.value))
    const label = fresh.value.label.trim() === '' ? null : fresh.value.label.trim()
    return createGroup({ label, stimulusIds: [s.data.id], questionIds: [me, ...picks.value.map((p) => p.id)] })
  })
  if (g) {
    fresh.value = blankStimulus()
    picks.value = []
    groupId.value = g.id
    await load(g.id)
  }
}

function attach(): void {
  const id = attachId.value.trim()
  const me = props.currentQuestionId
  if (id === '' || me === null) return
  void run(() => addGroupMember(id, me)).then((g) => {
    if (g) {
      attachId.value = ''
      groupId.value = g.id
    }
  })
}

async function saveStimulus(id: string): Promise<void> {
  const now = forms.value[id]
  const before = saved.value[id]
  if (!now || !before) return
  const issue = stimulusIssue(now)
  if (issue !== null) {
    problems.value = [issue]
    return
  }
  const body = toUpdateBody(now, before)
  if (body === null) return
  if (await run(() => updateStimulus(id, body))) await reload()
}

async function dropStimulus(id: string): Promise<void> {
  const v = view.value
  if (!v) return
  if (await run(() => setGroupStimuli(v.id, v.stimuli.filter((s) => s.id !== id).map((s) => s.id)))) await reload()
}

async function addStimulus(): Promise<void> {
  const v = view.value
  if (!v) return
  const issue = stimulusIssue(adding.value)
  if (issue !== null) {
    problems.value = [issue]
    return
  }
  const ok = await run(async () => {
    const s = await createStimulus(toCreateBody(adding.value))
    return setGroupStimuli(v.id, [...v.stimuli.map((x) => x.id), s.data.id])
  })
  if (ok) {
    adding.value = blankStimulus()
    showAddStimulus.value = false
    await reload()
  }
}

/** Takes out, adds, then orders: the calls of the stimulus API; the first refusal stops and the list is read again. */
async function saveMembers(): Promise<void> {
  const v = view.value
  const plan = v ? planMembers(v.members, members.value) : null
  if (!v || !plan) return
  const done = await run(async () => {
    for (const q of plan.remove) await removeGroupMember(v.id, q)
    for (const q of plan.add) await addGroupMember(v.id, q)
    const last = await reorderGroupMembers(v.id, plan.order)
    return last
  })
  await reload()
  if (done === null) return
}

async function dissolve(): Promise<void> {
  const v = view.value
  if (!v) return
  if (await run(() => dissolveGroup(v.id))) {
    groupId.value = null
    adopt(null)
  }
}

function up(id: string): void {
  members.value = moveMember(members.value, id, -1)
}
function down(id: string): void {
  members.value = moveMember(members.value, id, 1)
}
function drop(id: string): void {
  members.value = removeMember(members.value, id)
}
function discard(): void {
  members.value = [...savedMembers.value]
}

let searchSeq = 0
async function doSearch(): Promise<void> {
  const q = search.value.trim()
  const token = ++searchSeq
  if (q.length < 2) {
    found.value = []
    return
  }
  searching.value = true
  try {
    const res = await searchQuestions(q)
    const taken = new Set([...members.value.map((m) => m.id), ...picks.value.map((m) => m.id), props.currentQuestionId ?? ''])
    if (token === searchSeq) found.value = res.data.filter((r) => !taken.has(r.id))
  } catch {
    if (token === searchSeq) problems.value = [LOAD_ERROR]
  } finally {
    if (token === searchSeq) searching.value = false
  }
}

function pick(row: QuestionPick): void {
  const member: GroupMember = { id: row.id, numberLabel: '', stem: row.questionText.slice(0, 120) }
  if (view.value) {
    const res = addMember(members.value, member)
    if (res.ok) members.value = res.members
    else problems.value = [res.message]
  } else {
    picks.value = [...picks.value, member]
  }
  found.value = found.value.filter((r) => r.id !== row.id)
}
function unpick(id: string): void {
  picks.value = picks.value.filter((p) => p.id !== id)
}

const preview = (m: GroupMember): string => (m.stem.length > 90 ? `${m.stem.slice(0, 90)}…` : m.stem)
</script>

<template>
  <DsStack gap="md" :data-testid="testid">
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" :testid="`${testid}-error`" :retry-testid="`${testid}-retry`" @retry="load(groupId)" />
    <DsText v-else-if="loading" variant="body" tone="muted" :data-testid="`${testid}-loading`">Memuatkan…</DsText>

    <!-- No group yet -->
    <template v-else-if="view === null">
      <DsText variant="body" tone="muted" :data-testid="`${testid}-none`">
        Soalan ini tidak berkongsi rangsangan. Cipta satu rangsangan kongsi jika beberapa soalan merujuk Rajah, petikan atau jadual yang sama.
      </DsText>
      <DsCallout v-if="currentQuestionId === null" tone="info" :data-testid="`${testid}-save-first`">
        Simpan draf soalan ini dahulu. Kumpulan dicipta daripada soalan yang sudah disimpan, bersama sekurang-kurangnya satu soalan lain.
      </DsCallout>
      <template v-else>
        <StudioStimulusEditor v-model="fresh" :testid="`${testid}-new`" :disabled="disabled" />
        <DsHeading :level="3">Soalan lain yang berkongsi rangsangan ini</DsHeading>
        <DsStack as="ul" gap="xs" :data-testid="`${testid}-picks`">
          <DsSurface v-for="p in picks" :key="p.id" as="li" level="soft" padding="sm" shadow="none">
            <DsCluster gap="xs" :wrap="false">
              <DsText variant="body" truncate>{{ preview(p) }}</DsText>
              <UButton type="button" color="error" variant="soft" :disabled="disabled" :data-testid="`${testid}-pick-${p.id}-remove`" @click="unpick(p.id)">Keluarkan</UButton>
            </DsCluster>
          </DsSurface>
        </DsStack>
        <DsFormField v-slot="{ id }" native label="Cari soalan untuk dikongsi" :for="`${testid}-search`">
          <UInput :id="id" v-model="search" :disabled="disabled" placeholder="Taip sekurang-kurangnya 2 huruf" :data-testid="`${testid}-search`" @update:model-value="doSearch" />
        </DsFormField>
        <DsStack v-if="found.length > 0" as="ul" gap="xs" :data-testid="`${testid}-found`">
          <DsSurface v-for="r in found" :key="r.id" as="li" level="soft" padding="sm" shadow="none">
            <DsCluster gap="xs" :wrap="false">
              <DsText variant="body" truncate>{{ r.questionText }}</DsText>
              <UButton type="button" color="primary" variant="soft" :disabled="disabled" :data-testid="`${testid}-found-${r.id}-add`" @click="pick(r)">Tambah</UButton>
            </DsCluster>
          </DsSurface>
        </DsStack>
        <DsCluster gap="sm" align="end">
          <UButton type="button" color="primary" :loading="busy" :disabled="disabled || !canCreate" :data-testid="`${testid}-create`" @click="create">
            Cipta rangsangan kongsi
          </UButton>
          <DsFormField v-slot="{ id }" native label="Atau sertai kumpulan sedia ada (ID)" :for="`${testid}-attach-id`">
            <UInput :id="id" v-model="attachId" inputmode="numeric" :disabled="disabled" :data-testid="`${testid}-attach-id`" @keydown.enter.prevent="attach" />
          </DsFormField>
          <UButton type="button" color="neutral" variant="soft" :disabled="disabled || attachId.trim() === ''" :data-testid="`${testid}-attach`" @click="attach">
            Sertai
          </UButton>
        </DsCluster>
      </template>
    </template>

    <!-- The group -->
    <template v-else>
      <DsCallout v-if="view.locked" tone="warning" :data-testid="`${testid}-locked`">
        Kumpulan ini mempunyai soalan yang sedang diterbitkan. Arkibkan soalan itu dahulu sebelum mengubah kumpulan.
      </DsCallout>

      <DsText variant="body" tone="muted" :data-testid="`${testid}-id`">Kumpulan #{{ view.id }}</DsText>

      <DsStack as="section" gap="md" aria-label="Rangsangan kumpulan">
        <DsStack v-for="(s, i) in view.stimuli" :key="s.id" gap="sm" :data-testid="`${testid}-stimulus-${s.id}`">
          <DsHeading :level="3">Rangsangan {{ i + 1 }}</DsHeading>
          <StudioStimulusEditor v-if="forms[s.id]" :model-value="forms[s.id] as StimulusForm" :kind-locked="true" :testid="`${testid}-s-${s.id}`" :disabled="locked" @update:model-value="forms[s.id] = $event" />
          <DsCluster gap="sm">
            <UButton type="button" color="primary" variant="soft" :loading="busy" :disabled="locked" :data-testid="`${testid}-s-${s.id}-save`" @click="saveStimulus(s.id)">
              Simpan rangsangan
            </UButton>
            <UButton v-if="view.stimuli.length > 1" type="button" color="error" variant="soft" :disabled="locked" :data-testid="`${testid}-s-${s.id}-remove`" @click="dropStimulus(s.id)">
              Buang rangsangan
            </UButton>
          </DsCluster>
        </DsStack>
        <template v-if="!stimulusFull">
          <UButton v-if="!showAddStimulus" type="button" color="neutral" variant="soft" :disabled="locked" :data-testid="`${testid}-add-stimulus`" @click="showAddStimulus = true">
            Tambah rangsangan
          </UButton>
          <DsStack v-else gap="sm">
            <StudioStimulusEditor v-model="adding" :testid="`${testid}-adding`" :disabled="locked" />
            <DsCluster gap="sm">
              <UButton type="button" color="primary" :loading="busy" :disabled="locked" :data-testid="`${testid}-adding-save`" @click="addStimulus">Simpan rangsangan</UButton>
              <UButton type="button" color="neutral" variant="soft" @click="showAddStimulus = false">Batal</UButton>
            </DsCluster>
          </DsStack>
        </template>
      </DsStack>

      <DsStack as="section" gap="sm" aria-label="Soalan dalam kumpulan">
        <DsHeading :level="3">Soalan dalam kumpulan ({{ members.length }})</DsHeading>
        <DsText variant="body" tone="muted">Rangsangan dipaparkan sekali, dengan semua soalan di bawahnya. Kumpulan tidak membawa markah.</DsText>
        <DsStack as="ul" gap="xs" :data-testid="`${testid}-members`">
          <DsSurface v-for="(m, i) in members" :key="m.id" as="li" level="soft" padding="sm" shadow="none" :data-testid="`${testid}-member-${m.id}`">
            <DsCluster gap="xs" :wrap="false">
              <DsText variant="label" tabular :data-testid="`${testid}-member-${m.id}-pos`">{{ i + 1 }}</DsText>
              <DsText variant="body" truncate>
                <DsText v-if="m.id === currentQuestionId" as="strong" variant="body-strong">Soalan ini · </DsText>{{ m.numberLabel ? `${m.numberLabel}. ` : '' }}{{ preview(m) || `Soalan #${m.id}` }}
              </DsText>
              <UButton type="button" color="neutral" variant="soft" aria-label="Naikkan" :disabled="locked || i === 0" :data-testid="`${testid}-member-${m.id}-up`" @click="up(m.id)" >Naik</UButton>
              <UButton type="button" color="neutral" variant="soft" aria-label="Turunkan" :disabled="locked || i === members.length - 1" :data-testid="`${testid}-member-${m.id}-down`" @click="down(m.id)" >Turun</UButton>
              <UButton type="button" color="error" variant="soft" aria-label="Keluarkan daripada kumpulan" :disabled="locked" :data-testid="`${testid}-member-${m.id}-remove`" @click="drop(m.id)">Keluarkan</UButton>
            </DsCluster>
          </DsSurface>
        </DsStack>

        <DsFormField v-slot="{ id }" native label="Cari soalan untuk ditambah" :for="`${testid}-search`">
          <UInput :id="id" v-model="search" :disabled="locked" placeholder="Taip sekurang-kurangnya 2 huruf" :data-testid="`${testid}-search`" @update:model-value="doSearch" />
        </DsFormField>
        <DsStack v-if="found.length > 0" as="ul" gap="xs" :data-testid="`${testid}-found`">
          <DsSurface v-for="r in found" :key="r.id" as="li" level="soft" padding="sm" shadow="none">
            <DsCluster gap="xs" :wrap="false">
              <DsText variant="body" truncate>{{ r.questionText }}</DsText>
              <UButton type="button" color="primary" variant="soft" :disabled="locked" :data-testid="`${testid}-found-${r.id}-add`" @click="pick(r)">Tambah</UButton>
            </DsCluster>
          </DsSurface>
        </DsStack>
        <DsText v-else-if="searching" variant="caption" tone="muted">Mencari…</DsText>

        <DsStack v-if="issues.length > 0" as="ul" gap="2xs" :data-testid="`${testid}-issues`">
          <DsText v-for="m in issues" :key="m" as="li" variant="caption" tone="warning">{{ m }}</DsText>
        </DsStack>
        <DsCluster gap="sm">
          <UButton type="button" color="primary" :loading="busy" :disabled="locked || !dirty" :data-testid="`${testid}-save-members`" @click="saveMembers">Simpan susunan</UButton>
          <UButton type="button" color="neutral" variant="soft" :disabled="!dirty" :data-testid="`${testid}-discard`" @click="discard">Buang perubahan</UButton>
          <UButton type="button" color="error" variant="soft" :disabled="locked" :data-testid="`${testid}-dissolve`" @click="dissolve">Bubarkan kumpulan</UButton>
        </DsCluster>
      </DsStack>
    </template>

    <DsText v-if="notice" variant="body" tone="success" role="status" :data-testid="`${testid}-notice`">{{ notice }}</DsText>
    <DsStack v-if="problems.length > 0" gap="2xs" role="alert" :data-testid="`${testid}-problems`">
      <DsText v-for="p in problems" :key="p" variant="body" tone="error">{{ p }}</DsText>
    </DsStack>
  </DsStack>
</template>
