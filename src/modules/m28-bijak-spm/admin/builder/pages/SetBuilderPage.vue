<script setup lang="ts">
/**
 * Set Builder (`/admin/studio/sets/:paper/builder`, S4.2): the bank browser on the left (4/12 from
 * `lg`), one block per Bahagian on the right. V2 (docs/design/v2-admin-student-pipeline.md S4.2,
 * cloud-student-mechanism 3.4): inline rename, "Jumlah markah keseluruhan", `Tambah` with a
 * destination select, `Buang`, `Terbitkan` without a confirm. D9 fix D-9: `Naik` / `Turun` instead
 * of drag. D90: a stimulus group is ONE unit, placed, moved and removed whole, shown once. S3-T02: the one builder (Pembina Kertas is
 * merged): the per-Bahagian chips and `budget-check`, the rule control, `Sunting bahagian`, `Sunting petikan`, `Tulis soalan baharu`,
 * `Lihat di Bijak SPM` came from Semak Kertas; every action saves at once, so there is no `Simpan draf`.
 */
import type { BijakBuilderPoolUnit, BijakDskpUnit } from '@pp/contract'
import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useFlash } from '@/composables/useFlash'
import { DsBadge, DsCluster, DsFormField, DsHeading, DsIcon, DsLoadError, DsNativeSelect, DsPage, DsPanel, DsPillNav, DsStack, DsStatusBadge, DsText } from '@/ds'

import { RichText, StimulusView } from '../../../../../components/question-display'
import type { PaperEditorData } from '../../../domain/admin-types'
import { checkPaper } from '../../../domain/paper-builder'
import type { StimulusDef } from '../../../domain/types'
import { editorGroupLabel } from '../../../lib/stimulus-data'
import { INTAKE_MANUAL_PATH } from '../../intake/lib/intake-routes'
import { KONTRAK_ROUTES } from '../../kontrak/server/api'
import { KIND_LABEL } from '../../papers/ui'
import PaperEditBlocks from '../components/PaperEditBlocks.vue'
import PublishOverride from '../components/PublishOverride.vue'
import ReviewBlock from '../components/ReviewBlock.vue'
import StudentViewDrawer from '../components/StudentViewDrawer.vue'
import { builderCopy as t, LEVEL_ITEMS } from '../domain/copy'
import { hasStimulus, hasStimulusOf, validTitle } from '../domain/stimulus'
import { movedOrder, sectionUnits, type SectionUnit } from '../domain/units'
import { usePaperActions } from '../lib/use-paper-actions'
import { BUILDER_PATH, builderMessage, type SectionPatch, type SectionPool } from '../server/api'
import { builderServer } from '../server/client'

const api = builderServer()
const route = useRoute()
const flash = useFlash()

const id = computed(() => String(route.params.paper))
const editor = ref<PaperEditorData | null>(null)
const loadError = ref(false)
/** The caught load error, so DsLoadError can show the 429 countdown (S0-T08). */
const loadErrorObj = ref<unknown>(undefined)
const loading = ref(true)
const pending = ref(new Set<string>())

const paper = computed(() => editor.value?.paper ?? null)
const locked = computed(() => paper.value?.status === 'terbit')
const sections = computed(() => paper.value?.sections ?? [])
const stimulusOf = (gid: string): StimulusDef | undefined =>
  editor.value?.groups.find((g) => g.id === gid)?.stimulus
/** The live budget check of every Bahagian, on what is saved (every action saves). `Pilih N` counts N units (FR-QA-41). */
const check = computed(() => {
  const questions = new Map((editor.value?.questions ?? []).map((q) => [q.id, q]))
  const groups = new Map((editor.value?.groups ?? []).map((g) => [g.id, g]))
  return checkPaper({
    specs: sections.value.map((s) => ({ label: s.label, markBudget: s.markBudget, questionCount: s.questionCount, rule: s.rule })),
    sections: sections.value.map((s) => ({ questionIds: s.questionIds })),
    marksOf: (qid) => questions.get(qid)?.marks ?? 0,
    groupOf: (qid) => questions.get(qid)?.groupId,
    membersOf: (gid) => groups.get(gid)?.questionIds ?? [],
    isLive: (qid) => questions.get(qid)?.status === 'terbit',
  })
})
const budgetIssues = computed(() => [...check.value.errors, ...check.value.sections.flatMap((s) => s.errors.map((e) => `${s.label}: ${e}`))])
const totalMarks = computed(() => check.value.totalMarks)
/** Back from `Tulis soalan baharu` the note waits on Semak Kertas, as the intake return says (defect 27). */
const manualLink = computed(() => ({
  path: INTAKE_MANUAL_PATH,
  query: { subject: paper.value?.subject ?? '', kertas: String(paper.value?.kertas ?? ''), paper: id.value },
}))

const actions = usePaperActions({
  api,
  id,
  title: () => paper.value?.title ?? '',
  // V2 composite set: "Set ini telah diterbitkan." (design S4.2)
  publishedMessage: (_title, n) => (n ? t.overriddenFlash(n) : t.published_ok),
  refusedMessage: () => t.publishRefused,
  onChanged: load,
})
const { review, view, viewOpen, viewError } = actions

/* ------------------------------------------------------------------------------ load */
async function load(): Promise<void> {
  try {
    editor.value = await api.getEditor(id.value)
    loadError.value = false
    loadErrorObj.value = undefined
  } catch (err) {
    loadError.value = true
    loadErrorObj.value = err
  } finally {
    loading.value = false
  }
}
async function refresh(next?: PaperEditorData): Promise<void> {
  if (next) editor.value = next
  await Promise.all([actions.loadReview(), loadPool()])
}
watch(
  id,
  async () => {
    loading.value = true
    editor.value = null
    await load()
    if (editor.value) {
      // A new destination loads the bank through its watcher; the same one needs the call (one request, not two).
      const first = sections.value[0]?.id ?? ''
      const unchanged = dest.value === first
      dest.value = first
      void actions.loadReview()
      void loadUnits()
      if (unchanged) void loadPool()
    }
  },
  { immediate: true },
)

/* ------------------------------------------------------------------- inline rename */
const titleDraft = ref('')
watch(
  () => paper.value?.title,
  (v) => (titleDraft.value = v ?? ''),
  { immediate: true },
)
async function rename(): Promise<void> {
  const next = titleDraft.value.trim()
  if (!paper.value || locked.value || next === paper.value.title) {
    titleDraft.value = paper.value?.title ?? ''
    return
  }
  if (!validTitle(next)) {
    titleDraft.value = paper.value.title
    flash.show({ type: 'error', message: t.titleInvalid })
    return
  }
  try {
    editor.value = await api.updateHeader(id.value, { title: next })
    flash.show({ type: 'success', message: t.renamed(next) })
  } catch (e) {
    titleDraft.value = paper.value.title
    flash.show({ type: 'error', message: builderMessage(e, t.errRename) })
  }
}

/* --------------------------------------------------------------------- bank browser */
const dest = ref('')
const search = ref('')
const level = ref('')
const unit = ref('')
const tahun = ref('')
const negeri = ref<string[]>([])
const negeriOpen = ref(false)
const units = ref<BijakDskpUnit[]>([])
const pool = ref<SectionPool | null>(null)
const poolPage = ref(1)
const poolState = ref<'loading' | 'ready' | 'error'>('loading')
let poolSeq = 0
/** The search that produced `pool`: "Muat lagi" appends with it, never with a half-typed one (REQ-B-042). */
let poolQuery = ''
let timer: ReturnType<typeof setTimeout> | undefined

async function loadUnits(): Promise<void> {
  if (!paper.value) return
  try {
    units.value = await api.units(paper.value.subject)
  } catch {
    units.value = []
  }
}

async function loadPool(append = false): Promise<void> {
  if (!paper.value || !dest.value) return
  const seq = ++poolSeq
  if (!append) poolState.value = 'loading'
  const q = append ? poolQuery : search.value
  try {
    const res = await api.pool(id.value, dest.value, {
      q,
      ...(level.value ? { level: level.value as 't4' | 't5' | 't1_t3' } : {}),
      ...(unit.value ? { unit: unit.value } : {}),
      ...(tahun.value ? { tahun: Number(tahun.value) } : {}),
      ...(negeri.value.length ? { negeri: negeri.value } : {}),
      page: append ? poolPage.value + 1 : 1,
      pageSize: 50,
    })
    if (seq !== poolSeq) return
    poolQuery = q
    poolPage.value = append ? poolPage.value + 1 : 1
    pool.value = append && pool.value ? { ...res, units: [...pool.value.units, ...res.units] } : res
    poolState.value = 'ready'
  } catch (e) {
    if (seq !== poolSeq) return
    poolState.value = 'error'
    flash.show({ type: 'error', message: builderMessage(e, t.errPool) })
  }
}
function onFilter(): void {
  clearTimeout(timer)
  timer = setTimeout(() => void loadPool(), 250)
}
watch([dest, level, unit, tahun, negeri], () => void loadPool())
onBeforeUnmount(() => clearTimeout(timer))
const toggleNegeri = (n: string): void => {
  negeri.value = negeri.value.includes(n) ? negeri.value.filter((x) => x !== n) : [...negeri.value, n]
}

const poolKey = (u: BijakBuilderPoolUnit): string => u.groupId ?? u.questionIds[0]!
/** V2 lists at most 150 bank rows (P4); beyond that the admin narrows the filter instead of paging on. */
const POOL_CAP = 150
const shown = computed(() => pool.value?.units.length ?? 0)
const capped = computed(() => !!pool.value && pool.value.total > POOL_CAP && shown.value >= POOL_CAP)
const hasMore = computed(() => (pool.value ? poolPage.value < pool.value.totalPages && shown.value < POOL_CAP : false))

/* ----------------------------------------------------------------- unit operations */
async function guarded(key: string, run: () => Promise<void>, fallback: string): Promise<void> {
  if (pending.value.has(key) || locked.value) return
  pending.value = new Set(pending.value).add(key)
  try {
    await run()
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, fallback) })
  } finally {
    const next = new Set(pending.value)
    next.delete(key)
    pending.value = next
  }
}

/** D90: any member id places the whole group. */
function add(u: BijakBuilderPoolUnit): Promise<void> {
  return guarded(
    poolKey(u),
    async () => refresh((await api.addPlacement(id.value, dest.value, u.questionIds[0]!)).editor),
    t.errAdd,
  )
}
/** D90: removes the whole group. */
function remove(u: SectionUnit): Promise<void> {
  return guarded(
    u.ids[0]!,
    async () => refresh((await api.removePlacement(id.value, u.ids[0]!)).editor),
    t.errRemove,
  )
}
/** One reorder at a time page-wide: a second `movedOrder` built from stale units would undo the first. */
const reordering = ref(false)
async function move(sectionId: string, list: SectionUnit[], index: number, delta: -1 | 1): Promise<void> {
  const order = movedOrder(list, index, delta)
  if (!order || reordering.value) return
  reordering.value = true
  try {
    await guarded(
      list[index]!.ids[0]!,
      async () => refresh(await api.reorder(id.value, sectionId, order)),
      t.errOrder,
    )
  } finally {
    reordering.value = false
  }
}

const unitsBySection = computed(() => {
  const ed = editor.value
  return new Map(sections.value.map((s) => [s.id, ed ? sectionUnits(ed, s.id) : []]))
})
const unitsIn = (sid: string): SectionUnit[] => unitsBySection.value.get(sid) ?? []
const questionCountIn = (sid: string): number => sections.value.find((s) => s.id === sid)?.questionIds.length ?? 0
const destFull = computed(() => {
  const s = sections.value.find((x) => x.id === dest.value)
  return !!s && s.questionIds.length >= s.questionCount && s.rule.type === 'all'
})

/* ---------------------------------------------------------- Jawab Semua / Pilih N (FR-ADM-Q14.2) */
const RULE_ITEMS = [
  { label: t.ruleAll, value: 'all' },
  { label: t.ruleChoose, value: 'choose' },
]
const ruleDraft = reactive<Record<string, { type: 'all' | 'choose'; n: string }>>({})
const ruleError = reactive<Record<string, string | undefined>>({})
const syncRules = (): void => {
  for (const s of sections.value) ruleDraft[s.id] = { type: s.rule.type, n: s.rule.type === 'choose' ? String(s.rule.n) : '1' }
}
watch(sections, syncRules, { immediate: true })
/** 14-05: N is at most the Bahagian's count; once it is full, the units in it (FR-QA-41: a group is one unit). */
const maxN = (sid: string, questionCount: number): number => {
  const placed = unitsIn(sid).length
  return placed > 0 && questionCountIn(sid) >= questionCount ? placed : Math.max(questionCount, placed)
}
function saveRule(sid: string): void {
  const s = sections.value.find((x) => x.id === sid)
  const d = ruleDraft[sid]
  if (!s || !d) return
  ruleError[sid] = undefined
  const n = Number(d.n)
  if (d.type === 'choose' && (!Number.isInteger(n) || n < 1 || n > maxN(sid, s.questionCount))) {
    ruleError[sid] = t.ruleNInvalid
    return
  }
  const rule = d.type === 'all' ? ({ type: 'all' } as const) : ({ type: 'choose', n } as const)
  if (rule.type === s.rule.type && (rule.type !== 'choose' || (s.rule.type === 'choose' && rule.n === s.rule.n))) return
  void guarded(
    `rule-${sid}`,
    async () => {
      try {
        await refresh(await api.updateSection(id.value, sid, { rule }))
      } catch (e) {
        syncRules()
        throw e
      }
    },
    t.errRename,
  )
}
function setRuleType(sid: string, value: unknown): void {
  const d = ruleDraft[sid]
  if (!d) return
  d.type = value === 'choose' ? 'choose' : 'all'
  saveRule(sid)
}

/* ---------------------------------------------- Sunting bahagian, Sunting petikan (from Semak Kertas) */
const editBusy = ref(false)
async function editThen(run: () => Promise<PaperEditorData>, okMessage: string, fallback: string): Promise<void> {
  editBusy.value = true
  try {
    await refresh(await run())
    flash.show({ type: 'success', message: okMessage })
  } catch (e) {
    flash.show({ type: 'error', message: builderMessage(e, fallback) })
  } finally {
    editBusy.value = false
  }
}
const saveSection = (sid: string, p: SectionPatch): Promise<void> => editThen(() => api.updateSection(id.value, sid, p), t.sectionSaved(p.label ?? ''), t.errRename)
const savePassage = (gid: string, label: string): Promise<void> => editThen(() => api.updateGroupLabel(id.value, gid, label), t.passageSaved(label), t.errPassage)
const groupLabel = (gid: string): string => {
  const g = editor.value?.groups.find((x) => x.id === gid)
  return g ? editorGroupLabel(g) : ''
}

/* -------------------------------------------------------------------- responsive pane */
const pane = ref<'bank' | 'set'>('set')
const paneItems = [
  { key: 'bank' as const, label: t.paneBank, icon: 'stack' },
  { key: 'set' as const, label: t.paneSet, icon: 'list-bullets' },
]
const dskpItems = computed(() => [
  { label: t.unitAll, value: '' },
  ...units.value.map((u) => ({ label: `${u.code} ${u.title}`, value: u.nodeId })),
])
</script>

<template>
  <DsPage
    layout="detail"
    width="full"
    :back-to="BUILDER_PATH"
    :back-label="t.back"
    :title="t.landingTitle"
    data-testid="set-builder-editor"
  >
    <DsLoadError v-if="loadError" :message="t.errLoad" :error="loadErrorObj" @retry="load()" />
    <p v-else-if="loading" class="text-body text-muted" role="status">{{ t.loading }}</p>

    <template v-else-if="paper">
      <!-- header -->
      <DsPanel>
        <div class="flex flex-wrap items-end justify-between gap-4">
          <div class="flex min-w-0 grow flex-col gap-2">
            <div class="flex flex-wrap items-center gap-2">
              <DsStatusBadge :status="locked ? 'published' : 'draft'" />
              <span class="text-caption text-muted">
                {{ editor?.blueprint?.subjectName ?? paper.subject }} · Kertas {{ paper.kertas }} · {{ paper.code }}
              </span>
            </div>
            <UInput
              v-model="titleDraft"
              :aria-label="t.titleAria"
              class="w-full"
              :disabled="locked"
              data-testid="builder-title"
              @blur="rename"
              @keydown.enter.prevent="rename"
            />
            <p class="text-body font-semibold" data-testid="builder-total">{{ t.totalMarks(totalMarks) }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <UButton
              color="neutral"
              variant="soft"
              icon="i-ph-eye"
              :label="t.studentView"
              class="min-h-11"
              data-testid="builder-student-view"
              @click="actions.openStudentView"
            />
            <UButton
              color="neutral"
              variant="soft"
              icon="i-ph-copy"
              :label="t.copy"
              class="min-h-11"
              :loading="actions.busy.value"
              data-testid="builder-copy"
              @click="actions.copy"
            />
            <UButton
              :to="{ name: 'm28.admin.papers.edit', params: { id } }"
              color="neutral"
              variant="ghost"
              icon="i-ph-seal-check"
              :label="t.semak"
              class="min-h-11"
              data-testid="builder-semak"
            />
            <UButton v-if="locked" to="/spm/bijak" color="neutral" variant="soft" :label="t.viewInBijak" data-testid="builder-view-student" />
            <UButton
              v-if="locked"
              color="warning"
              variant="soft"
              icon="i-ph-arrow-u-up-left"
              :label="t.withdraw"
              class="min-h-11"
              :loading="actions.busy.value"
              data-testid="builder-withdraw"
              @click="actions.withdraw"
            />
          </div>
        </div>
        <div v-if="locked" class="mt-3 flex flex-wrap items-center gap-3" data-testid="builder-locked">
          <p class="text-body text-muted">{{ t.live }} {{ t.lockedNote }}</p>
          <UButton
            color="neutral"
            variant="soft"
            icon="i-ph-copy"
            :label="t.copyForEdit"
            class="min-h-11"
            :loading="actions.busy.value"
            data-testid="builder-copy-for-edit"
            @click="actions.copy"
          />
        </div>
      </DsPanel>

      <!-- budget, ported from Semak Kertas -->
      <DsPanel data-testid="budget-check" role="status" aria-live="polite">
        <DsStack gap="xs">
          <DsCluster gap="xs" :wrap="false">
            <DsIcon :name="budgetIssues.length ? 'warning' : 'check-circle'" />
            <DsHeading :level="2" variant="subheading">{{ budgetIssues.length ? t.budgetIssues(budgetIssues.length) : t.budgetOk }}</DsHeading>
          </DsCluster>
          <DsStack v-if="budgetIssues.length" gap="2xs" data-testid="budget-issues">
            <DsText v-for="e in budgetIssues" :key="e" variant="body">{{ e }}</DsText>
          </DsStack>
        </DsStack>
      </DsPanel>

      <!-- review -->
      <DsPanel data-testid="builder-review" aria-live="polite">
        <h2 class="mb-2 text-heading text-highlighted">{{ t.review }}</h2>
        <DsText variant="body" data-testid="builder-contract">
          {{ t.contractTitle }}: {{ editor?.blueprint ? t.contractLine(editor.blueprint.subjectName, paper.kertas, editor.blueprint.source) : t.contractNone }}
        </DsText>
        <ReviewBlock v-if="review" :review="review" :scope="{ levelScope: paper.levelScope, subject: editor?.blueprint?.subjectName ?? paper.subject }" />
        <p v-else-if="actions.reviewError.value" class="text-body text-error" role="alert">{{ t.reviewError }}</p>
        <p v-else class="text-caption text-muted">{{ t.loading }}</p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <UButton
            :to="{ name: KONTRAK_ROUTES.edit, params: { subjek: paper.subject, kertas: String(paper.kertas) } }"
            color="neutral"
            variant="link"
            class="min-h-11"
            :label="t.editContract"
            data-testid="builder-edit-contract"
          />
        </div>
      </DsPanel>

      <DsPillNav
        class="lg:hidden"
        :items="paneItems"
        :active="pane"
        :label="t.paneNav"
        testid-prefix="builder-pane"
        @select="pane = $event"
      />

      <div class="grid gap-6 lg:grid-cols-12">
        <!-- bank -->
        <section
          v-if="!locked"
          :class="[pane === 'bank' ? 'block' : 'hidden', 'lg:col-span-4 lg:block']"
          aria-labelledby="bank-title"
          data-testid="builder-bank"
        >
          <DsPanel>
            <h2 id="bank-title" class="mb-3 text-heading text-highlighted">{{ t.bank }}</h2>
            <div class="flex flex-col gap-3">
              <UInput
                v-model="search"
                icon="i-ph-magnifying-glass"
                :placeholder="t.search"
                :aria-label="t.search"
                class="w-full"
                data-testid="bank-search"
                @update:model-value="onFilter"
              />
              <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <DsNativeSelect v-model="level" :aria-label="t.levelAll" data-testid="bank-level">
                  <option v-for="l in LEVEL_ITEMS" :key="l.value" :value="l.value">{{ l.label }}</option>
                </DsNativeSelect>
                <DsNativeSelect v-model="unit" :aria-label="t.unitAll" data-testid="bank-unit">
                  <option v-for="u in dskpItems" :key="u.value" :value="u.value">{{ u.label }}</option>
                </DsNativeSelect>
              </div>
              <!-- 14-01, 14-02: values present in the data; hidden while the column holds none -->
              <DsNativeSelect v-if="pool?.filters?.years.length" v-model="tahun" :aria-label="t.tahunField" data-testid="bank-tahun">
                <option value="">{{ t.tahunField }}</option>
                <option v-for="y in pool.filters.years" :key="y" :value="String(y)">{{ y }}</option>
              </DsNativeSelect>
              <DsStack v-if="pool?.filters?.negeri.length" gap="xs" align="start" data-testid="bank-negeri">
                <UButton
                  color="neutral"
                  variant="soft"
                  :label="`${t.negeriField} · ${t.negeriPicked(negeri.length || pool.filters.negeri.length)}`"
                  :aria-expanded="negeriOpen"
                  data-testid="bank-negeri-toggle"
                  @click="negeriOpen = !negeriOpen"
                />
                <DsCluster v-show="negeriOpen" gap="xs">
                  <UButton
                    v-for="n in pool.filters.negeri"
                    :key="n"
                    :color="negeri.includes(n) ? 'primary' : 'neutral'"
                    :variant="negeri.includes(n) ? 'solid' : 'soft'"
                    :label="n"
                    :aria-pressed="negeri.includes(n)"
                    :data-testid="`bank-negeri-${n}`"
                    @click="toggleNegeri(n)"
                  />
                </DsCluster>
              </DsStack>
              <DsNativeSelect v-model="dest" :aria-label="t.destination" data-testid="bank-dest">
                <option v-for="s in sections" :key="s.id" :value="s.id">{{ s.label }}</option>
              </DsNativeSelect>
              <p v-if="destFull" class="text-caption text-warning" data-testid="bank-dest-full">{{ t.sectionFull }}</p>

              <p v-if="poolState === 'loading'" class="text-caption text-muted" role="status">{{ t.loading }}</p>
              <DsCluster v-else-if="poolState === 'error'" gap="xs">
                <DsText variant="body" tone="error" role="alert" data-testid="bank-error">{{ t.errPool }}</DsText>
                <UButton color="neutral" variant="soft" :label="t.retry" data-testid="bank-retry" @click="loadPool()" />
              </DsCluster>
              <p v-else-if="pool && !pool.units.length" class="text-body text-muted" data-testid="bank-empty">
                {{ t.noMatch }}
              </p>
              <DsText v-if="pool?.units.length" variant="caption" tone="muted" data-testid="bank-count">{{ t.bankCount(pool.total, shown) }}</DsText>
              <ul v-if="pool?.units.length" class="flex flex-col gap-2" data-testid="bank-list">
                <li
                  v-for="u in pool.units"
                  :key="poolKey(u)"
                  class="flex flex-col gap-2 rounded-lg bg-muted p-3"
                  :data-testid="u.groupId ? `pool-group-${u.groupId}` : `pool-${u.questionIds[0]}`"
                >
                  <div v-if="u.groupId" class="flex flex-col gap-1">
                    <p class="flex flex-wrap items-center gap-2 text-caption font-semibold text-info">
                      <UIcon name="i-ph-image" class="size-4" aria-hidden="true" />
                      {{ t.groupCard(editorGroupLabel(u), u.questionIds.length) }}
                    </p>
                    <div v-if="hasStimulusOf(u.stimulus)" class="max-h-48 overflow-auto rounded bg-default p-2" data-testid="pool-stimulus">
                      <StimulusView :stimulus="u.stimulus as unknown as StimulusDef" />
                    </div>
                  </div>
                  <div v-for="q in u.questions" :key="q.id" class="flex flex-col gap-1">
                    <span class="line-clamp-3 text-body"><RichText :text="q.preview" /></span>
                    <span class="text-caption text-muted">
                      {{ q.marks }} markah · {{ KIND_LABEL[q.kind] }} · {{ q.topic }}
                    </span>
                  </div>
                  <p v-if="!u.eligible" class="text-caption text-error" data-testid="pool-reasons">
                    {{ t.notServed }}: {{ u.reasons.join('; ') }}
                  </p>
                  <div class="flex items-center justify-between gap-2">
                    <UBadge v-if="u.placed" color="neutral" variant="subtle" :label="t.inSet" />
                    <span v-else />
                    <UButton
                      size="sm"
                      icon="i-ph-plus"
                      :label="t.add"
                      class="min-h-11"
                      :disabled="u.placed || !u.eligible || !dest || pending.has(poolKey(u))"
                      :loading="pending.has(poolKey(u))"
                      :data-testid="`pool-add-${poolKey(u)}`"
                      @click="add(u)"
                    />
                  </div>
                </li>
              </ul>
              <p v-if="capped" class="text-caption text-muted" data-testid="bank-cap">{{ t.poolCap }}</p>
              <UButton
                v-if="hasMore"
                color="neutral"
                variant="soft"
                class="min-h-11 self-start"
                :label="t.poolMore"
                data-testid="bank-more"
                @click="loadPool(true)"
              />
            </div>
          </DsPanel>
        </section>

        <!-- set -->
        <section
          :class="[pane === 'set' || locked ? 'block' : 'hidden', locked ? 'lg:col-span-12' : 'lg:col-span-8', 'lg:block']"
          aria-labelledby="set-title"
          data-testid="builder-set"
        >
          <h2 id="set-title" class="sr-only">{{ t.paneSet }}</h2>
          <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <DsPanel v-for="(s, si) in sections" :key="s.id" :data-testid="`builder-section-${si}`">
              <div class="flex flex-col gap-3">
                <div class="flex flex-wrap items-start justify-between gap-2">
                  <div class="min-w-0">
                    <h3 class="text-heading text-highlighted">{{ s.label }}</h3>
                    <p class="text-caption text-muted">
                      {{
                        s.instruction ??
                        (s.rule.type === 'all'
                          ? 'Jawab semua soalan.'
                          : `Jawab ${s.rule.n} soalan sahaja.`)
                      }}
                    </p>
                  </div>
                  <DsCluster gap="xs" :data-testid="`section-${si}-badges`">
                    <DsBadge
                      :tone="questionCountIn(s.id) === s.questionCount ? 'success' : 'warning'"
                      :label="t.fill(questionCountIn(s.id), s.questionCount)"
                      :data-testid="`builder-fill-${si}`"
                    />
                    <DsBadge :tone="check.sections[si]?.count === s.questionCount ? 'success' : 'warning'" :label="t.questionsChip(check.sections[si]?.count ?? 0, s.questionCount)" />
                    <DsBadge :tone="check.sections[si]?.marks === s.markBudget ? 'success' : 'warning'" :label="t.marksChip(check.sections[si]?.marks ?? 0, s.markBudget)" />
                    <DsBadge v-if="s.compulsory" :label="t.compulsoryChip" :data-testid="`builder-compulsory-${si}`" />
                  </DsCluster>
                </div>
                <DsCluster v-if="!locked && ruleDraft[s.id]" gap="sm" align="start" :data-testid="`builder-rule-${si}`">
                  <DsFormField :label="t.sectionRule">
                    <DsNativeSelect
                      :model-value="ruleDraft[s.id]!.type"
                      :items="RULE_ITEMS"
                      :aria-label="`${t.sectionRule} ${s.label}`"
                      :disabled="pending.has(`rule-${s.id}`)"
                      :data-testid="`rule-type-${si}`"
                      @update:model-value="setRuleType(s.id, $event)"
                    />
                  </DsFormField>
                  <DsFormField v-if="ruleDraft[s.id]!.type === 'choose'" :label="t.sectionCount" :error="ruleError[s.id]">
                    <UInput
                      v-model="ruleDraft[s.id]!.n"
                      type="number"
                      inputmode="numeric"
                      min="1"
                      class="w-full"
                      :aria-label="`${t.sectionCount} ${s.label}`"
                      :data-testid="`rule-n-${si}`"
                      @blur="saveRule(s.id)"
                      @keydown.enter.prevent="saveRule(s.id)"
                    />
                  </DsFormField>
                </DsCluster>
                <ul class="flex flex-col gap-2">
                  <li
                    v-for="(u, ui) in unitsIn(s.id)"
                    :key="u.ids.join('|')"
                    class="flex items-start gap-2 rounded-lg bg-muted p-3"
                    :class="{ 'opacity-60': pending.has(u.ids[0]!) }"
                    :data-testid="u.groupId ? `unit-group-${u.groupId}` : `unit-${u.ids[0]}`"
                  >
                    <div class="flex min-w-0 grow flex-col gap-2">
                      <template v-if="u.groupId">
                        <p class="flex flex-wrap items-center gap-2 text-caption font-semibold text-info">
                          <UIcon name="i-ph-image" class="size-4" aria-hidden="true" />
                          {{ t.groupBadge(groupLabel(u.groupId), u.ids.length) }}
                        </p>
                        <div
                          v-if="hasStimulus(stimulusOf(u.groupId))"
                          class="max-h-48 overflow-auto rounded bg-default p-2"
                          data-testid="set-stimulus"
                        >
                          <StimulusView :stimulus="stimulusOf(u.groupId)!" />
                        </div>
                      </template>
                      <div v-for="q in u.questions" :key="q.id" class="flex flex-col gap-1">
                        <span class="line-clamp-2 text-body"><RichText :text="q.preview" /></span>
                        <span class="text-caption text-muted">
                          {{ q.marks }} markah · {{ KIND_LABEL[q.kind] }} · {{ q.topic }}
                        </span>
                        <UBadge
                          v-if="q.pinned"
                          color="neutral"
                          variant="subtle"
                          icon="i-ph-push-pin"
                          :label="t.pinned"
                          :title="t.pinnedTip"
                          class="self-start"
                          data-testid="chip-pinned"
                        />
                        <DsCluster v-if="q.servable === false">
                          <span :title="q.notServedReason" data-testid="chip-not-served"><DsBadge tone="error" icon="warning" :label="t.notServed" /></span>
                        </DsCluster>
                      </div>
                    </div>
                    <div v-if="!locked" class="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-ph-arrow-up"
                        :aria-label="t.upAria(ui + 1)"
                        class="min-h-11 min-w-11"
                        :disabled="ui === 0 || reordering || pending.has(u.ids[0]!)"
                        :data-testid="`up-${u.ids[0]}`"
                        @click="move(s.id, unitsIn(s.id), ui, -1)"
                      />
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-ph-arrow-down"
                        :aria-label="t.downAria(ui + 1)"
                        class="min-h-11 min-w-11"
                        :disabled="ui === unitsIn(s.id).length - 1 || reordering || pending.has(u.ids[0]!)"
                        :data-testid="`down-${u.ids[0]}`"
                        @click="move(s.id, unitsIn(s.id), ui, 1)"
                      />
                      <UButton
                        color="error"
                        variant="ghost"
                        icon="i-ph-x"
                        :aria-label="`${t.remove}${u.groupId ? ' kumpulan' : ' soalan'}`"
                        class="min-h-11 min-w-11"
                        :disabled="pending.has(u.ids[0]!)"
                        :data-testid="`remove-${u.ids[0]}`"
                        @click="remove(u)"
                      />
                    </div>
                  </li>
                  <li v-if="!unitsIn(s.id).length" class="text-body text-muted" :data-testid="`builder-empty-${si}`">
                    {{ t.sectionEmpty }}
                  </li>
                </ul>
                <DsCluster v-if="!locked">
                  <UButton :to="manualLink" color="neutral" variant="soft" :label="t.writeQuestion" :data-testid="`write-${si}`" />
                </DsCluster>
              </div>
            </DsPanel>
          </div>
        </section>
      </div>

      <DsPanel v-if="editor" data-testid="paper-edit-blocks">
        <PaperEditBlocks :editor="editor" :readonly="locked" :busy="editBusy" @section="saveSection" @passage="savePassage" />
      </DsPanel>

      <!-- Terbitkan: sticky bar below lg, inline from lg -->
      <div
        v-if="!locked"
        class="sticky bottom-0 z-10 -mx-4 flex flex-col gap-1 border-t border-default bg-default px-4 py-3 sm:mx-0 sm:rounded-lg sm:border"
        data-testid="builder-publish-bar"
      >
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            icon="i-ph-upload-simple"
            :label="actions.busy.value ? t.publishing : t.publish"
            class="min-h-11"
            :loading="actions.busy.value"
            :disabled="actions.publishBlocked.value || !review"
            :title="actions.publishBlocked.value && actions.blockers.value.length ? t.fixFirst(actions.blockers.value.length) : undefined"
            data-testid="builder-publish"
            @click="actions.publish()"
          />
          <p v-if="actions.publishReason.value" class="text-caption text-error" data-testid="builder-publish-reason">
            {{ actions.publishReason.value }}
          </p>
        </div>
        <ul
          v-if="actions.publishBlocked.value && actions.blockers.value.length"
          class="flex list-disc flex-col gap-1 ps-6 text-caption text-error"
          data-testid="builder-publish-blockers"
        >
          <li v-for="b in actions.blockers.value" :key="b">{{ b }}</li>
        </ul>
        <PublishOverride
          :blockers="actions.blockers.value"
          :available="actions.overrideAvailable.value"
          :busy="actions.busy.value"
          @override="(reason) => actions.publish({ override: true, reason })"
        />
      </div>
    </template>

    <StudentViewDrawer
      v-model:open="viewOpen"
      :view="view"
      :error="viewError"
    />
  </DsPage>
</template>
