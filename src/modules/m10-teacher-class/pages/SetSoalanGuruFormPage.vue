<script setup lang="ts">
/**
 * R1-GUR-8b Screen B `/guru/set-soalan/cipta` and `/guru/set-soalan/:id` "Cipta / Urus Set Soalan" (S6-T14;
 * API-GUR-16). Cards "Tapis Bank Soalan", "Maklumat Set" (Tajuk Set, Subjek, Tingkatan (pilihan), Kelas
 * checkboxes of the own classes) and "Pilih Soalan Dari Bank": a scrolling checkable list of approved
 * question units, 50 per batch by cursor (IntersectionObserver). A stimulus group is ONE row with one
 * checkbox that ticks every member, so the page never sends part of a group (FR-GUR-8b-8). The action row
 * is "Batal", "Simpan Draf" and "Terbitkan". Client checks use the server texts (`GURU_SET_MESSAGES`); a
 * 422 shows each field message inline. A locked set (a pupil has an attempt: 409) disables the picker and
 * shows "Soalan tidak boleh diubah ..."; the title and the classes stay editable.
 */
import {
  GURU_SET_BANK_PREVIEW_MAX,
  GURU_SET_MAX_QUESTIONS,
  GURU_SET_MESSAGES,
} from '@pp/contract'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import {
  DsBackLink,
  DsCluster,
  DsEmptyState,
  DsFormField,
  DsHeading,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsStickyActions,
  DsText,
} from '@/ds'

import { RichText, StimulusFigure } from '../../../components/question-display'
import type { StimulusData } from '../../../components/question-display'
import {
  createGuruSet,
  fetchGuruClasses,
  fetchGuruSet,
  fetchGuruSetBank,
  updateGuruSet,
  type GuruSetBankStimulus,
  type GuruSetBankUnit,
  type GuruSetUpsertRequest,
  type QuestionSet,
} from '../api/guru'
import { fetchLevelOptions } from '../components/soalan/data'
import { fetchSubjectOptions } from '../components/kelas/subjects'
import { moduleMessage } from '../lib/generic-server-text'

const COPY = {
  back: 'Kembali ke Set Soalan',
  createTitle: 'Cipta Set Soalan',
  manageTitle: 'Urus Set Soalan',
  filterTitle: 'Tapis Bank Soalan',
  allSubjects: 'Semua subjek',
  allLevels: 'Semua tingkatan',
  subjectFilter: 'Subjek',
  levelFilter: 'Tingkatan',
  search: 'Cari teks soalan...',
  searchLabel: 'Cari soalan',
  apply: 'Tapis',
  infoTitle: 'Maklumat Set',
  infoSub: 'Bina set daripada bank soalan dan terbitkan kepada kelas anda',
  setTitle: 'Tajuk Set',
  subject: 'Subjek',
  subjectPlaceholder: '-- Pilih subjek --',
  level: 'Tingkatan (pilihan)',
  levelNone: '— Tiada —',
  classesLabel: 'Kelas',
  classesHelp: 'Pilih kelas yang akan melihat set ini.',
  noClasses: 'Anda belum ada kelas aktif.',
  bankTitle: 'Pilih Soalan Dari Bank',
  cancel: 'Batal',
  saveDraft: 'Simpan Draf',
  publish: 'Terbitkan',
  saving: 'Menyimpan...',
  loadMore: 'Muat Lagi',
  loadingMore: 'Memuatkan...',
  loadFailed: 'Gagal memuatkan set soalan. Sila cuba lagi.',
  bankFailed: 'Gagal memuatkan bank soalan. Sila cuba lagi.',
  saveFailed: 'Set soalan tidak dapat disimpan. Sila cuba lagi.',
  retry: 'Cuba Lagi',
  groupOf: (n: number): string => `Kumpulan rangsangan · ${String(n)} soalan`,
  selected: (n: number): string => `${String(n)} dipilih`,
} as const

/** The difficulty star (U+2B50) of the V2 row "{subjek} · {tahap} · ⭐{kesukaran}". */
const STAR = '⭐'

const route = useRoute()
const router = useRouter()
const flash = useFlash()

const setId = computed(() => (typeof route.params.id === 'string' ? route.params.id : null))
const isEdit = computed(() => setId.value !== null)

// --- lookups ------------------------------------------------------------------------------------------

const { data: subjects } = useApi((signal) => fetchSubjectOptions(signal))
const { data: levelsAll } = useApi((signal) => fetchLevelOptions(signal))
/** V3 lists Tingkatan 1-5 only (D72); when no name matches, every active level is offered. */
const levels = computed(() => {
  const all = levelsAll.value ?? []
  const tingkatan = all.filter((l) => /^tingkatan\s*[1-5]$/i.test(l.name.trim()))
  return tingkatan.length > 0 ? tingkatan : all
})
const { data: classList } = useApi((signal) => fetchGuruClasses({ signal }))
const ownClasses = computed(() => (classList.value?.data ?? []).filter((c) => c.isActive))

// --- the set form ---------------------------------------------------------------------------------------

const title = ref('')
const subjectId = ref('')
const levelId = ref('')
const classroomIds = ref<string[]>([])
/** Every ticked question id (units tick all their members); ids outside the loaded list stay counted. */
const selectedIds = ref<Set<string>>(new Set())
const originalIds = ref<string[]>([])
const locked = ref(false)
const status = ref<'draft' | 'published'>('draft')

const fields = ref<Record<string, string>>({})
const failure = ref<string[]>([])
const submitting = ref<'draft' | 'published' | null>(null)
const INLINE_FIELDS = ['title', 'subjectId', 'educationLevelId', 'questionIds', 'classroomIds']

const {
  data: loaded,
  error: loadError,
  reload: reloadSet,
} = useApi((signal) => fetchGuruSet(setId.value ?? '', signal ? { signal } : {}), undefined, {
  immediate: isEdit.value,
})

function fill(set: QuestionSet): void {
  title.value = set.title
  subjectId.value = set.subjectId
  levelId.value = set.educationLevelId ?? ''
  filterSubject.value = set.subjectId
  filterLevel.value = set.educationLevelId ?? ''
  classroomIds.value = [...set.classroomIds]
  selectedIds.value = new Set(set.questionIds)
  originalIds.value = [...set.questionIds]
  locked.value = set.locked
  status.value = set.status
}

const count = computed(() => selectedIds.value.size)

// --- the bank picker ----------------------------------------------------------------------------------------

const filterSubject = ref('')
const filterLevel = ref('')
const searchText = ref('')
const searchError = ref('')
const units = ref<GuruSetBankUnit[]>([])
const nextCursor = ref<string | null>(null)
const bankLoading = ref(false)
const bankFailed = ref(false)
const bankLoadedOnce = ref(false)
let bankSeq = 0
let bankAbort: AbortController | null = null

async function loadBank(reset: boolean): Promise<void> {
  const q = searchText.value.trim()
  if (reset) {
    if (q !== '' && [...q].length < 2) {
      searchError.value = GURU_SET_MESSAGES.searchTooShort
      return
    }
    searchError.value = ''
  } else if (bankLoading.value || nextCursor.value === null) return
  bankAbort?.abort()
  const controller = new AbortController()
  bankAbort = controller
  const seq = ++bankSeq
  bankLoading.value = true
  bankFailed.value = false
  try {
    const page = await fetchGuruSetBank(
      {
        ...(filterSubject.value ? { subjectId: filterSubject.value } : {}),
        ...(filterLevel.value ? { levelId: filterLevel.value } : {}),
        ...(q !== '' ? { q } : {}),
        ...(!reset && nextCursor.value ? { cursor: nextCursor.value } : {}),
      },
      { signal: controller.signal },
    )
    if (seq !== bankSeq) return
    units.value = reset ? page.units : [...units.value, ...page.units]
    nextCursor.value = page.nextCursor
    bankLoadedOnce.value = true
  } catch (err) {
    if (seq !== bankSeq || (err as { name?: string }).name === 'AbortError') return
    if (err instanceof ApiError && err.fields?.q) searchError.value = err.fields.q
    else bankFailed.value = true
  } finally {
    if (seq === bankSeq) bankLoading.value = false
    // A sentinel that stays in view after a batch is observed again, so the next batch loads too.
    await nextTick()
    if (observer && sentinel.value) {
      observer.unobserve(sentinel.value)
      observer.observe(sentinel.value)
    }
  }
}

/** The set's Subjek and Tingkatan drive the bank filters once chosen. */
watch([subjectId, levelId], ([s, l]) => {
  filterSubject.value = s
  filterLevel.value = l
  if (bankLoadedOnce.value) void loadBank(true)
})

const unitChecked = (u: GuruSetBankUnit): boolean =>
  u.questionIds.every((id) => selectedIds.value.has(id))

function toggleUnit(u: GuruSetBankUnit, on: boolean): void {
  if (locked.value) return
  const next = new Set(selectedIds.value)
  for (const id of u.questionIds) {
    if (on) next.add(id)
    else next.delete(id)
  }
  selectedIds.value = next
}

/** Server preview is already cut at 120 characters; a longer one is cut here too. */
function clip(text: string): string {
  const chars = [...text]
  if (chars.length <= GURU_SET_BANK_PREVIEW_MAX + 3) return text
  return `${chars.slice(0, GURU_SET_BANK_PREVIEW_MAX).join('')}...`
}

const fileSrc = (imageId: string): string =>
  /^[A-Za-z0-9_-]{22}$/.test(imageId) ? `/api/files/${imageId}` : imageId

/** The contract stimulus as the shared display component takes it. */
function toStimulusData(s: GuruSetBankStimulus): StimulusData {
  return {
    id: s.id,
    kind: s.kind,
    ...(s.label ? { label: s.label } : {}),
    ...(s.body?.ms ? { text: s.body.ms } : {}),
    ...(s.caption ? { caption: s.caption } : {}),
    ...(s.sourceCitation ? { source: s.sourceCitation } : {}),
    ...(s.alt ? { alt: s.alt } : {}),
    ...(s.imageId ? { src: fileSrc(s.imageId) } : {}),
    ...(s.tableData ? { table: { head: s.tableData.head, rows: s.tableData.rows } } : {}),
  }
}

// --- infinite scroll (IntersectionObserver) ------------------------------------------------------------------

const sentinel = ref<HTMLElement | null>(null)
const hasObserver = typeof IntersectionObserver !== 'undefined'
let observer: IntersectionObserver | null = null

watch(sentinel, (el, old) => {
  if (!hasObserver) return
  if (old) observer?.unobserve(old)
  if (el) {
    observer ??= new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void loadBank(false)
    })
    observer.observe(el)
  }
})

onBeforeUnmount(() => {
  observer?.disconnect()
  bankAbort?.abort()
})

// Edit: the set drives the form and the bank filters, so it is read first (a failure shows the retry box).
watch(
  loaded,
  (set) => {
    if (!set || bankLoadedOnce.value) return
    fill(set)
    void loadBank(true)
  },
  { immediate: true },
)
onMounted(() => {
  if (!isEdit.value) void loadBank(true)
})

// --- save ---------------------------------------------------------------------------------------------------

function validate(target: 'draft' | 'published'): Record<string, string> {
  const e: Record<string, string> = {}
  const t = title.value.trim()
  if (t === '') e.title = GURU_SET_MESSAGES.titleRequired
  else if ([...t].length > 150) e.title = GURU_SET_MESSAGES.titleTooLong
  if (subjectId.value === '') e.subjectId = GURU_SET_MESSAGES.subjectRequired
  if (count.value === 0) e.questionIds = GURU_SET_MESSAGES.questionsRequired
  else if (count.value > GURU_SET_MAX_QUESTIONS) e.questionIds = GURU_SET_MESSAGES.questionsTooMany
  if (target === 'published' && classroomIds.value.length === 0)
    e.classroomIds = GURU_SET_MESSAGES.classRequiredToPublish
  return e
}

async function save(target: 'draft' | 'published'): Promise<void> {
  if (submitting.value !== null) return
  failure.value = []
  fields.value = validate(target)
  if (Object.keys(fields.value).length > 0) return
  submitting.value = target
  const body: GuruSetUpsertRequest = {
    title: title.value.trim(),
    subjectId: subjectId.value,
    educationLevelId: levelId.value === '' ? null : levelId.value,
    // A locked set keeps its stored question list; only the title and the classes change.
    questionIds: locked.value ? [...originalIds.value] : [...selectedIds.value],
    classroomIds: [...classroomIds.value],
    status: target,
  }
  try {
    if (setId.value !== null) await updateGuruSet(setId.value, body)
    else await createGuruSet(body)
    flash.success(target === 'published' ? GURU_SET_MESSAGES.published : GURU_SET_MESSAGES.draftSaved)
    await router.push('/guru/set-soalan')
  } catch (err) {
    if (err instanceof ApiError && err.status === 409) {
      locked.value = true
      failure.value = [GURU_SET_MESSAGES.locked]
    } else if (err instanceof ApiError && err.fields) {
      fields.value = err.fields
      failure.value = Object.entries(err.fields)
        .filter(([key]) => !INLINE_FIELDS.includes(key))
        .map(([, message]) => message)
    } else failure.value = [moduleMessage(err) ?? COPY.saveFailed]
  } finally {
    submitting.value = null
  }
}

function toggleClass(id: string, on: boolean): void {
  classroomIds.value = on
    ? [...classroomIds.value.filter((c) => c !== id), id]
    : classroomIds.value.filter((c) => c !== id)
}
</script>

<template>
  <DsPage :title="isEdit ? COPY.manageTitle : COPY.createTitle" data-testid="set-form-page">
    <DsBackLink to="/guru/set-soalan" :label="COPY.back" data-testid="set-back" />

    <DsLoadError
      v-if="isEdit && loadError"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="set-load-error"
      @retry="reloadSet"
    />
    <USkeleton
      v-else-if="isEdit && !loaded"
      class="h-64 w-full"
      aria-busy="true"
      data-testid="set-form-loading"
    />

    <DsStack v-else as="form" gap="md" novalidate data-testid="set-form" @submit.prevent>
      <UAlert
        v-if="failure.length"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        :title="failure.join(' ')"
        role="alert"
        data-testid="set-failure"
      />

      <DsPanel data-testid="set-filter-card">
        <DsStack gap="md">
          <DsHeading :level="2" variant="subheading">{{ COPY.filterTitle }}</DsHeading>
          <DsCluster align="end" stack-below="md">
            <DsFormField :label="COPY.subjectFilter" name="set-filter-subject">
              <DsNativeSelect
                id="set-filter-subject"
                v-model="filterSubject"
                data-testid="set-filter-subject"
              >
                <option value="">{{ COPY.allSubjects }}</option>
                <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
                  {{ s.name }}
                </option>
              </DsNativeSelect>
            </DsFormField>
            <DsFormField :label="COPY.levelFilter" name="set-filter-level">
              <DsNativeSelect
                id="set-filter-level"
                v-model="filterLevel"
                data-testid="set-filter-level"
              >
                <option value="">{{ COPY.allLevels }}</option>
                <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
              </DsNativeSelect>
            </DsFormField>
            <DsFormField :label="COPY.searchLabel" name="set-search" :error="searchError">
              <UInput
                id="set-search"
                v-model="searchText"
                type="search"
                :placeholder="COPY.search"
                class="w-full"
                data-testid="set-search"
                @keydown.enter.prevent="loadBank(true)"
              />
            </DsFormField>
            <UButton
              type="button"
              color="neutral"
              variant="soft"
              icon="i-ph-funnel-duotone"
              class="min-h-11"
              data-testid="set-apply"
              @click="loadBank(true)"
              >{{ COPY.apply }}</UButton
            >
          </DsCluster>
        </DsStack>
      </DsPanel>

      <DsPanel data-testid="set-info-card">
        <DsStack gap="md">
          <DsStack gap="2xs">
            <DsHeading :level="2" variant="subheading">{{ COPY.infoTitle }}</DsHeading>
            <DsText variant="caption">{{ COPY.infoSub }}</DsText>
          </DsStack>

          <DsFormField :label="`${COPY.setTitle} *`" name="set-title" :error="fields.title">
            <UInput id="set-title" v-model="title" type="text" class="w-full" data-testid="set-title" />
          </DsFormField>

          <DsFormField :label="`${COPY.subject} *`" name="set-subject" :error="fields.subjectId">
            <DsNativeSelect id="set-subject" v-model="subjectId" data-testid="set-subject">
              <option value="">{{ COPY.subjectPlaceholder }}</option>
              <option v-for="s in subjects ?? []" :key="s.id" :value="String(s.id)">
                {{ s.name }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <DsFormField
            :label="COPY.level"
            name="set-level"
            :error="fields.educationLevelId"
          >
            <DsNativeSelect id="set-level" v-model="levelId" data-testid="set-level">
              <option value="">{{ COPY.levelNone }}</option>
              <option v-for="l in levels" :key="l.id" :value="String(l.id)">{{ l.name }}</option>
            </DsNativeSelect>
          </DsFormField>

          <DsStack as="fieldset" gap="xs" data-testid="set-classes">
            <DsText as="legend" variant="label">{{ COPY.classesLabel }}</DsText>
            <DsText variant="caption">{{ COPY.classesHelp }}</DsText>
            <DsText
              v-if="classList && ownClasses.length === 0"
              variant="body"
              tone="muted"
              data-testid="set-classes-none"
              >{{ COPY.noClasses }}</DsText
            >
            <DsStack as="ul" gap="xs">
              <li v-for="c in ownClasses" :key="c.id" data-testid="set-class">
                <UCheckbox
                  :model-value="classroomIds.includes(String(c.id))"
                  :label="c.name"
                  class="min-h-11"
                  :data-testid="`set-class-${String(c.id)}`"
                  @update:model-value="toggleClass(String(c.id), $event === true)"
                />
              </li>
            </DsStack>
            <DsText v-if="fields.classroomIds" variant="caption" tone="error" role="alert">{{
              fields.classroomIds
            }}</DsText>
          </DsStack>
        </DsStack>
      </DsPanel>

      <DsPanel data-testid="set-bank-card">
        <DsStack gap="md">
          <DsCluster justify="between">
            <DsHeading :level="2" variant="subheading">{{ COPY.bankTitle }}</DsHeading>
            <DsText variant="label" role="status" data-testid="set-counter">{{
              COPY.selected(count)
            }}</DsText>
          </DsCluster>
          <UAlert
            v-if="locked"
            color="warning"
            variant="subtle"
            icon="i-ph-lock-duotone"
            :title="GURU_SET_MESSAGES.locked"
            data-testid="set-locked"
          />
          <DsText v-if="fields.questionIds" variant="caption" tone="error" role="alert" data-testid="set-bank-error">{{
            fields.questionIds
          }}</DsText>

          <DsLoadError
            v-if="bankFailed"
            :message="COPY.bankFailed"
            :retry-label="COPY.retry"
            testid="set-bank-failed"
            @retry="loadBank(true)"
          />
          <USkeleton
            v-else-if="!bankLoadedOnce"
            class="h-40 w-full"
            aria-busy="true"
            data-testid="set-bank-loading"
          />
          <DsEmptyState
            v-else-if="units.length === 0"
            size="sm"
            :title="GURU_SET_MESSAGES.emptyBank"
            icon="magnifying-glass"
            data-testid="set-bank-empty"
          />
          <DsStack
            v-else
            as="ul"
            gap="xs"
            class="max-h-96 overflow-y-auto"
            data-testid="set-bank"
          >
            <li v-for="u in units" :key="`${u.kind}-${u.id}`" data-testid="set-bank-row" :data-kind="u.kind">
              <DsPanel padding="sm">
                <DsCluster align="start" :wrap="false">
                  <UCheckbox
                    :model-value="unitChecked(u)"
                    :disabled="locked"
                    class="min-h-11 min-w-11 shrink-0"
                    :aria-label="`Pilih soalan: ${clip(u.preview)}`"
                    data-testid="set-bank-check"
                    @update:model-value="toggleUnit(u, $event === true)"
                  />
                  <DsStack gap="xs" class="grow">
                    <StimulusFigure v-if="u.stimulus" :stimulus="toStimulusData(u.stimulus)" />
                    <DsText variant="body" wrap="anywhere" data-testid="set-bank-preview">
                      <RichText :text="clip(u.preview)" />
                    </DsText>
                    <DsText v-if="u.kind === 'group'" variant="caption" data-testid="set-bank-group">{{
                      COPY.groupOf(u.questionIds.length)
                    }}</DsText>
                    <DsText variant="caption" data-testid="set-bank-meta"
                      >{{ u.subject }} · {{ u.level }} · {{ STAR }}{{ u.difficulty }}</DsText
                    >
                  </DsStack>
                </DsCluster>
              </DsPanel>
            </li>
            <li v-if="nextCursor !== null || bankLoading" data-testid="set-bank-more">
              <div ref="sentinel" class="min-h-px" aria-hidden="true" />
              <UButton
                v-if="!hasObserver"
                type="button"
                color="neutral"
                variant="soft"
                class="min-h-11"
                :loading="bankLoading"
                data-testid="set-bank-load-more"
                @click="loadBank(false)"
                >{{ bankLoading ? COPY.loadingMore : COPY.loadMore }}</UButton
              >
              <USkeleton v-else-if="bankLoading" class="h-12 w-full" aria-busy="true" />
            </li>
          </DsStack>
        </DsStack>
      </DsPanel>

      <DsStickyActions>
        <UButton
          to="/guru/set-soalan"
          color="neutral"
          variant="ghost"
          size="xl"
          class="min-h-11"
          data-testid="set-cancel"
          >{{ COPY.cancel }}</UButton
        >
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="xl"
          class="min-h-11 grow"
          :loading="submitting === 'draft'"
          :disabled="submitting !== null"
          data-testid="set-save-draft"
          @click="save('draft')"
          >{{ submitting === 'draft' ? COPY.saving : COPY.saveDraft }}</UButton
        >
        <UButton
          type="button"
          size="xl"
          class="min-h-11 grow"
          :loading="submitting === 'published'"
          :disabled="submitting !== null"
          data-testid="set-publish"
          @click="save('published')"
          >{{ submitting === 'published' ? COPY.saving : COPY.publish }}</UButton
        >
      </DsStickyActions>
    </DsStack>
  </DsPage>
</template>
