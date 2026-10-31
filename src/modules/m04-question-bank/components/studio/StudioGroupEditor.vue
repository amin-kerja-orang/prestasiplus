<script setup lang="ts">
/**
 * The shared stimulus of a question (D90, T13). A figure, passage or table that several questions refer to ("Rajah 1" for S1
 * and S2) is ONE group: it is stored once, shown once with every member question under it, and carries no marks. Here the
 * author creates the group, edits its stimuli (1 to 3), and adds, removes and reorders its member questions; the order is
 * saved in one call. A group is read-only while one of its questions is being served.
 */
import { computed, ref, watch } from 'vue'

import { DsCallout, DsCluster, DsFormField, DsHeading, DsLoadError, DsStack, DsSurface, DsText } from '@/ds'

import {
  addStudioStimulus,
  createStudioGroup,
  dissolveStudioGroup,
  fetchStudioGroup,
  patchStudioStimulus,
  removeStudioStimulus,
  searchQuestions,
  setStudioGroupMembers,
  type QuestionPick,
  type StudioGroup,
} from '../../api/studio'
import {
  addMember,
  memberIds,
  memberIssues,
  membersChanged,
  moveMember,
  removeMember,
  type GroupMember,
} from '../../lib/studio/group-members'
import {
  blankStimulus,
  stimulusFormOf,
  stimulusHasContent,
  STIMULUS_EMPTY,
  toStimulusInput,
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
const emit = defineEmits<{ changed: [group: StudioGroup | null] }>()

const group = ref<StudioGroup | null>(null)
const members = ref<GroupMember[]>([])
const forms = ref<Record<string, StimulusForm>>({})
const loading = ref(false)
const loadFailed = ref(false)
const busy = ref(false)
const notice = ref('')
const problems = ref<string[]>([])
const fresh = ref<StimulusForm>(blankStimulus())
const adding = ref<StimulusForm>(blankStimulus('passage'))
const showAddStimulus = ref(false)
const attachId = ref('')
const search = ref('')
const found = ref<QuestionPick[]>([])
const searching = ref(false)

const locked = computed(() => props.disabled || group.value?.locked === true)
const dirty = computed(() => group.value !== null && membersChanged(toMembers(group.value), members.value))
const issues = computed(() => memberIssues(members.value))
const stimulusFull = computed(() => (group.value?.stimuli.length ?? 0) >= 3)

const toMembers = (g: StudioGroup): GroupMember[] => g.members.map((m) => ({ id: m.id, numberLabel: m.numberLabel ?? '', stem: m.stem }))

function adopt(next: StudioGroup | null): void {
  group.value = next
  members.value = next ? toMembers(next) : []
  forms.value = next ? Object.fromEntries(next.stimuli.map((s) => [s.id, stimulusFormOf(s)])) : {}
  emit('changed', next)
}

let seq = 0
async function load(id: string | null): Promise<void> {
  const token = ++seq
  problems.value = []
  loadFailed.value = false
  if (id === null) return adopt(null)
  loading.value = true
  try {
    const g = await fetchStudioGroup(id)
    if (token === seq) adopt(g)
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

/** Runs one call; shows the server text on success and its problems on failure. */
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

async function create(): Promise<void> {
  if (!stimulusHasContent(fresh.value)) {
    problems.value = [STIMULUS_EMPTY]
    return
  }
  const g = await run(() => createStudioGroup({ label: fresh.value.label.trim() || null, stimuli: [toStimulusInput(fresh.value)] }))
  if (g) {
    groupId.value = g.id
    adopt(g)
    fresh.value = blankStimulus()
  }
}

function attach(): void {
  const id = attachId.value.trim()
  if (id === '') return
  groupId.value = id
  attachId.value = ''
}

async function saveStimulus(id: string): Promise<void> {
  const f = forms.value[id]
  if (!group.value || !f) return
  if (!stimulusHasContent(f)) {
    problems.value = [STIMULUS_EMPTY]
    return
  }
  const { kind, ...rest } = toStimulusInput(f)
  const g = await run(() => patchStudioStimulus((group.value as StudioGroup).id, id, { kind, ...rest }))
  if (g) adopt(g)
}

async function dropStimulus(id: string): Promise<void> {
  if (!group.value) return
  const g = await run(() => removeStudioStimulus((group.value as StudioGroup).id, id))
  if (g) adopt(g)
}

async function addStimulus(): Promise<void> {
  if (!group.value) return
  if (!stimulusHasContent(adding.value)) {
    problems.value = [STIMULUS_EMPTY]
    return
  }
  const g = await run(() => addStudioStimulus((group.value as StudioGroup).id, toStimulusInput(adding.value)))
  if (g) {
    adopt(g)
    adding.value = blankStimulus('passage')
    showAddStimulus.value = false
  }
}

async function saveMembers(): Promise<void> {
  if (!group.value) return
  const g = await run(() => setStudioGroupMembers((group.value as StudioGroup).id, memberIds(members.value)))
  if (g) adopt(g)
}

async function dissolve(): Promise<void> {
  if (!group.value) return
  const done = await run(() => dissolveStudioGroup((group.value as StudioGroup).id))
  if (done) {
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
  if (group.value) members.value = toMembers(group.value)
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
    if (token === searchSeq) found.value = res.data.filter((r) => !members.value.some((m) => m.id === r.id))
  } catch {
    if (token === searchSeq) problems.value = [LOAD_ERROR]
  } finally {
    if (token === searchSeq) searching.value = false
  }
}

function pick(row: QuestionPick): void {
  const res = addMember(members.value, { id: row.id, numberLabel: '', stem: row.questionText.slice(0, 120) })
  if (res.ok) {
    members.value = res.members
    found.value = found.value.filter((r) => r.id !== row.id)
  } else problems.value = [res.message]
}

const preview = (m: GroupMember): string => (m.stem.length > 90 ? `${m.stem.slice(0, 90)}…` : m.stem)
</script>

<template>
  <DsStack gap="md" :data-testid="testid">
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" :testid="`${testid}-error`" :retry-testid="`${testid}-retry`" @retry="load(groupId)" />
    <DsText v-else-if="loading" variant="body" tone="muted" :data-testid="`${testid}-loading`">Memuatkan…</DsText>

    <!-- No group yet -->
    <template v-else-if="group === null">
      <DsText variant="body" tone="muted" :data-testid="`${testid}-none`">
        Soalan ini tidak berkongsi rangsangan. Cipta satu rangsangan kongsi jika beberapa soalan merujuk Rajah, petikan atau jadual yang sama.
      </DsText>
      <StudioStimulusEditor v-model="fresh" :testid="`${testid}-new`" :disabled="disabled" />
      <DsCluster gap="sm" align="end">
        <UButton type="button" color="primary" :loading="busy" :disabled="disabled" :data-testid="`${testid}-create`" @click="create">
          Cipta rangsangan kongsi
        </UButton>
        <DsFormField v-slot="{ id }" native label="Atau pautkan kumpulan sedia ada (ID)" :for="`${testid}-attach-id`">
          <UInput :id="id" v-model="attachId" inputmode="numeric" :disabled="disabled" :data-testid="`${testid}-attach-id`" @keydown.enter.prevent="attach" />
        </DsFormField>
        <UButton type="button" color="neutral" variant="soft" :disabled="disabled || attachId.trim() === ''" :data-testid="`${testid}-attach`" @click="attach">
          Pautkan
        </UButton>
      </DsCluster>
    </template>

    <!-- The group -->
    <template v-else>
      <DsCallout v-if="group.locked" tone="warning" :data-testid="`${testid}-locked`">
        Kumpulan ini mempunyai soalan yang sedang diterbitkan. Arkibkan soalan itu dahulu sebelum mengubah kumpulan.
      </DsCallout>

      <DsText variant="body" tone="muted" :data-testid="`${testid}-id`">Kumpulan #{{ group.id }}</DsText>

      <DsStack as="section" gap="md" aria-label="Rangsangan kumpulan">
        <DsStack v-for="(s, i) in group.stimuli" :key="s.id" gap="sm" :data-testid="`${testid}-stimulus-${s.id}`">
          <DsHeading :level="3">Rangsangan {{ i + 1 }}</DsHeading>
          <StudioStimulusEditor v-if="forms[s.id]" :model-value="forms[s.id] as StimulusForm" :testid="`${testid}-s-${s.id}`" :disabled="locked" @update:model-value="forms[s.id] = $event" />
          <DsCluster gap="sm">
            <UButton type="button" color="primary" variant="soft" :loading="busy" :disabled="locked" :data-testid="`${testid}-s-${s.id}-save`" @click="saveStimulus(s.id)">
              Simpan rangsangan
            </UButton>
            <UButton v-if="group.stimuli.length > 1" type="button" color="error" variant="soft" :disabled="locked" :data-testid="`${testid}-s-${s.id}-remove`" @click="dropStimulus(s.id)">
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
              <UButton type="button" color="error" variant="soft" aria-label="Keluarkan daripada kumpulan" :disabled="locked" :data-testid="`${testid}-member-${m.id}-remove`" @click="drop(m.id)" >Keluarkan</UButton>
            </DsCluster>
          </DsSurface>
        </DsStack>
        <DsText v-if="currentQuestionId === null" variant="caption" tone="muted">Soalan yang sedang disunting ditambah di hujung kumpulan apabila disimpan.</DsText>

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
