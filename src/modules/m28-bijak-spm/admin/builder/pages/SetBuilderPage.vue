<script setup lang="ts">
/**
 * Set Builder (`/admin/studio/sets/:paper/builder`, S4.2): the bank browser on the left (4/12 from
 * `lg`), one block per Bahagian on the right. V2 (docs/design/v2-admin-student-pipeline.md S4.2,
 * cloud-student-mechanism 3.4): inline rename, "Jumlah markah keseluruhan", `Tambah` with a
 * destination select, `Buang`, `Terbitkan` without a confirm. D9 fix D-9: `Naik` / `Turun` instead
 * of drag. D90: a stimulus group is ONE unit, placed, moved and removed whole, shown once.
 */
import type { BijakBuilderPoolUnit, BijakDskpUnit } from '@pp/contract'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useFlash } from '@/composables/useFlash'
import { DsLoadError, DsNativeSelect, DsPage, DsPanel, DsPillNav, DsStatusBadge } from '@/ds'

import RichText from '../../../components/RichText.vue'
import StimulusView from '../../../components/StimulusView.vue'
import type { PaperEditorData } from '../../../domain/admin-types'
import type { StimulusDef } from '../../../domain/types'
import { KONTRAK_ROUTES } from '../../kontrak/server/api'
import { KIND_LABEL } from '../../papers/ui'
import ReviewBlock from '../components/ReviewBlock.vue'
import StudentViewDrawer from '../components/StudentViewDrawer.vue'
import { builderCopy as t, LEVEL_ITEMS } from '../domain/copy'
import { movedOrder, sectionUnits, type SectionUnit } from '../domain/units'
import { usePaperActions } from '../lib/use-paper-actions'
import { BUILDER_PATH, builderMessage, type SectionPool } from '../server/api'
import { builderServer } from '../server/client'

const api = builderServer()
const route = useRoute()
const flash = useFlash()

const id = computed(() => String(route.params.paper))
const editor = ref<PaperEditorData | null>(null)
const loadError = ref(false)
const loading = ref(true)
const pending = ref(new Set<string>())

const paper = computed(() => editor.value?.paper ?? null)
const locked = computed(() => paper.value?.status === 'terbit')
const sections = computed(() => paper.value?.sections ?? [])
const stimulusOf = (gid: string): StimulusDef | undefined =>
  editor.value?.groups.find((g) => g.id === gid)?.stimulus
const totalMarks = computed(() => {
  const marks = new Map((editor.value?.questions ?? []).map((q) => [q.id, q.marks]))
  return sections.value.reduce((n, s) => n + s.questionIds.reduce((m, q) => m + (marks.get(q) ?? 0), 0), 0)
})

const actions = usePaperActions({
  api,
  id,
  title: () => paper.value?.title ?? '',
  onChanged: load,
})
const { review, view, viewOpen, viewError } = actions

/* ------------------------------------------------------------------------------ load */
async function load(): Promise<void> {
  try {
    editor.value = await api.getEditor(id.value)
    loadError.value = false
  } catch {
    loadError.value = true
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
      dest.value = sections.value[0]?.id ?? ''
      void actions.loadReview()
      void loadUnits()
      void loadPool()
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
  if (!paper.value || locked.value || !next || next === paper.value.title) {
    titleDraft.value = paper.value?.title ?? ''
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
const units = ref<BijakDskpUnit[]>([])
const pool = ref<SectionPool | null>(null)
const poolPage = ref(1)
const poolState = ref<'loading' | 'ready' | 'error'>('loading')
let poolSeq = 0
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
  try {
    const res = await api.pool(id.value, dest.value, {
      q: search.value,
      ...(level.value ? { level: level.value as 't4' | 't5' | 't1_t3' } : {}),
      ...(unit.value ? { unit: unit.value } : {}),
      page: append ? poolPage.value + 1 : 1,
    })
    if (seq !== poolSeq) return
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
watch([dest, level, unit], () => void loadPool())
onBeforeUnmount(() => clearTimeout(timer))

const poolKey = (u: BijakBuilderPoolUnit): string => u.groupId ?? u.questionIds[0]!
const hasMore = computed(() => (pool.value ? poolPage.value < pool.value.totalPages : false))

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
function move(sectionId: string, list: SectionUnit[], index: number, delta: -1 | 1): Promise<void> {
  const order = movedOrder(list, index, delta)
  if (!order) return Promise.resolve()
  return guarded(
    list[index]!.ids[0]!,
    async () => refresh(await api.reorder(id.value, sectionId, order)),
    t.errOrder,
  )
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
    <DsLoadError v-if="loadError" :message="t.errLoad" @retry="load()" />
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
        <p v-if="locked" class="mt-3 text-body text-muted" data-testid="builder-locked">
          {{ t.live }} {{ t.lockedNote }}
        </p>
      </DsPanel>

      <!-- review -->
      <DsPanel data-testid="builder-review" aria-live="polite">
        <h2 class="mb-2 text-heading text-highlighted">{{ t.review }}</h2>
        <ReviewBlock v-if="review" :review="review" />
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
              <DsNativeSelect v-model="dest" :aria-label="t.destination" data-testid="bank-dest">
                <option v-for="s in sections" :key="s.id" :value="s.id">{{ s.label }}</option>
              </DsNativeSelect>
              <p v-if="destFull" class="text-caption text-warning" data-testid="bank-dest-full">{{ t.sectionFull }}</p>

              <p v-if="poolState === 'loading'" class="text-caption text-muted" role="status">{{ t.loading }}</p>
              <p v-else-if="poolState === 'error'" class="text-body text-error" role="alert">{{ t.errPool }}</p>
              <p v-else-if="pool && !pool.units.length" class="text-body text-muted" data-testid="bank-empty">
                {{ t.noMatch }}
              </p>
              <ul v-if="pool?.units.length" class="flex flex-col gap-2" data-testid="bank-list">
                <li
                  v-for="u in pool.units"
                  :key="poolKey(u)"
                  class="flex flex-col gap-2 rounded-lg bg-muted p-3"
                  :data-testid="u.groupId ? `pool-group-${u.groupId}` : `pool-${u.questionIds[0]}`"
                >
                  <div v-if="u.groupId && u.stimulus" class="flex flex-col gap-1">
                    <p class="flex flex-wrap items-center gap-2 text-caption font-semibold text-info">
                      <UIcon name="i-ph-image" class="size-4" aria-hidden="true" />
                      {{ t.groupBadge((u.stimulus as unknown as StimulusDef).label ?? '', u.questionIds.length) }}
                    </p>
                    <div class="max-h-48 overflow-auto rounded bg-default p-2" data-testid="pool-stimulus">
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
                          : `Jawab ${s.rule.n} daripada ${s.questionCount} soalan.`)
                      }}
                    </p>
                  </div>
                  <UBadge
                    :color="questionCountIn(s.id) === s.questionCount ? 'success' : 'warning'"
                    variant="subtle"
                    :label="t.fill(questionCountIn(s.id), s.questionCount)"
                    :data-testid="`builder-fill-${si}`"
                  />
                </div>
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
                          {{ t.groupBadge(stimulusOf(u.groupId)?.label ?? '', u.ids.length) }}
                        </p>
                        <div
                          v-if="stimulusOf(u.groupId)"
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
                      </div>
                    </div>
                    <div v-if="!locked" class="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-ph-arrow-up"
                        :aria-label="t.upAria(ui + 1)"
                        class="min-h-11 min-w-11"
                        :disabled="ui === 0 || pending.has(u.ids[0]!)"
                        :data-testid="`up-${u.ids[0]}`"
                        @click="move(s.id, unitsIn(s.id), ui, -1)"
                      />
                      <UButton
                        color="neutral"
                        variant="ghost"
                        icon="i-ph-arrow-down"
                        :aria-label="t.downAria(ui + 1)"
                        class="min-h-11 min-w-11"
                        :disabled="ui === unitsIn(s.id).length - 1 || pending.has(u.ids[0]!)"
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
              </div>
            </DsPanel>
          </div>
        </section>
      </div>

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
            data-testid="builder-publish"
            @click="actions.publish"
          />
          <p v-if="actions.publishReason.value" class="text-caption text-error" data-testid="builder-publish-reason">
            {{ actions.publishReason.value }}
          </p>
        </div>
      </div>
    </template>

    <StudentViewDrawer
      v-model:open="viewOpen"
      :view="view"
      :error="viewError"
    />
  </DsPage>
</template>
