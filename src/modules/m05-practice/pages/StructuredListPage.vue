<script setup lang="ts">
/**
 * S10 `/latihan-berstruktur` "Soalan Berstruktur" and its SPM variants `?scope=spm[&track=bahasa]`
 * (M05-T7; FR-M05-90…95, FR-M05-133…136, BR-23, DV-M05-01), restyled for v2 (AR-LIST, batch B01).
 *
 * - Filter (Subjek, Aras KBAT, "Cari"): navigates with both parameters (empty values kept, page
 *   reset) and keeps `scope` / `track`.
 * - Cards from #15 (1 / `md` 2 / `xl` 3 columns) with the KBAT badge; "Mula" → Q3 with the variant.
 * - The pager keeps `subject_id`, `kbat_level`, `scope`, `track`.
 * - The variants replace the heading (back link, h1, Tracking A info card) and the shell header
 *   title (M06 DV-M06-07, no subtitle). A null `school` hides " · {school}".
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, usePageMeta } from '@/composables'
import { DsEmptyState, DsLoadError } from '@/ds'

import { fetchStructured } from '../api/practice'
import {
  answerUrl,
  KBAT_OPTIONS,
  kbatBadge,
  parsePage,
  parseVariant,
} from '../components/structured/structured-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const PAGE_SIZE = 20
/** Reka selects cannot hold an empty value: "Semua" travels as this word. */
const ALL = 'semua'
const BAHASA_CHIPS = [
  'BM dahulu, BI kemudian',
  'Format kertas sebenar',
  'Paper-based tracking',
  'Berstruktur / respons sebenar',
]

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const q = (key: string): string => {
  const v = route.query[key]
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : ''
}

const variant = computed(() => parseVariant(route.query))
const subjectId = ref(q('subject_id'))
const kbat = ref(q('kbat_level'))
watch(
  () => route.query,
  () => {
    subjectId.value = q('subject_id')
    kbat.value = q('kbat_level')
  },
)

const { data, error, reload } = useApi(
  (signal) =>
    fetchStructured(
      {
        subjectId: q('subject_id') || null,
        kbatLevel: q('kbat_level') || null,
        page: parsePage(route.query),
        scope: variant.value.scope,
        track: variant.value.track,
      },
      { signal },
    ),
  () => route.query,
)

const items = computed(() => data.value?.data ?? [])
const meta = computed(() => data.value?.meta ?? null)
const subjectItems = computed(() => [
  { label: 'Semua Subjek', value: ALL },
  ...(meta.value?.subjectOptions ?? []).map((o) => ({ label: o.name, value: String(o.id) })),
])
const kbatItems = KBAT_OPTIONS.map((o) => ({ label: o.label, value: o.value || ALL }))
const subjectModel = computed({
  get: () => subjectId.value || ALL,
  set: (v: string) => (subjectId.value = v === ALL ? '' : v),
})
const kbatModel = computed({
  get: () => kbat.value || ALL,
  set: (v: string) => (kbat.value = v === ALL ? '' : v),
})

// The SPM variants have their own shell header title (DV-M06-07, no subtitle).
watch(
  variant,
  (v) => {
    if (v.track) pageMeta.setHeader({ title: 'Tracking A Bahasa' })
    else if (v.scope) pageMeta.setHeader({ title: 'Subjektif SPM' })
    else pageMeta.setHeader(null)
  },
  { immediate: true },
)

function search(): void {
  const query: Record<string, string> = { subject_id: subjectId.value, kbat_level: kbat.value }
  if (variant.value.scope) query.scope = 'spm'
  if (variant.value.track) query.track = 'bahasa'
  void router.push({ path: '/latihan-berstruktur', query })
}

function goPage(page: number): void {
  const query: Record<string, string> = {
    subject_id: q('subject_id'),
    kbat_level: q('kbat_level'),
  }
  if (variant.value.scope) query.scope = 'spm'
  if (variant.value.track) query.track = 'bahasa'
  query.page = String(page)
  void router.push({ path: '/latihan-berstruktur', query })
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="structured-page">
    <!-- Heading: plain, Subjektif SPM, Tracking A Bahasa -->
    <div class="flex flex-col gap-2" data-testid="structured-heading">
      <UButton
        v-if="variant.scope"
        :to="variant.track ? '/spm/ramalan' : '/spm/subjektif'"
        color="neutral"
        variant="ghost"
        icon="i-ph-arrow-left-bold"
        class="min-h-11 self-start"
        data-testid="structured-back"
        >{{ variant.track ? 'Kembali ke Tracking A SPM' : 'Kembali ke Subjektif SPM' }}</UButton
      >

      <UBadge
        v-if="variant.track"
        color="primary"
        variant="solid"
        size="lg"
        icon="i-ph-translate-bold"
        class="self-start"
        data-testid="structured-pill"
        >Tracking A Bahasa</UBadge
      >

      <h1 class="text-title text-highlighted" data-testid="structured-h1">
        {{
          variant.track ? 'Tracking A Bahasa' : variant.scope ? 'Subjektif SPM' : 'Soalan Berstruktur'
        }}
      </h1>
      <p class="max-w-prose text-body text-muted" data-testid="structured-sub">
        <template v-if="variant.track">
          Set bahasa dibuka ikut format kertas sebenar. BM dan BI tidak dipaksa menjadi 40 MCQ, dan
          dipaparkan mengikut susunan BM kemudian BI.
        </template>
        <template v-else-if="variant.scope">
          Pilih set struktur dan esei Tingkatan 4 atau 5 mengikut subjek semasa
        </template>
        <template v-else>Latih tubi format Kertas 2 — jawab &amp; semak secara automatik</template>
      </p>

      <UCard v-if="variant.track" data-testid="structured-info">
        <div class="flex flex-col gap-3">
          <p class="text-body text-default">
            Subjek bahasa tidak dipaksa menjadi 40 MCQ. Laluan ini menggunakan paper-based tracking
            dengan pendekatan berstruktur / respons sebenar.
          </p>
          <div class="flex flex-wrap gap-2">
            <UBadge v-for="chip in BAHASA_CHIPS" :key="chip" color="neutral" variant="soft">{{
              chip
            }}</UBadge>
            <UBadge
              v-if="meta"
              color="neutral"
              variant="soft"
              icon="i-ph-stack-bold"
              data-testid="structured-found"
              >{{ meta.totalItems }} set ditemui</UBadge
            >
          </div>
        </div>
      </UCard>
    </div>

    <!-- Filter -->
    <UCard>
      <form
        class="flex flex-col gap-3 sm:flex-row sm:items-end"
        data-testid="structured-filter"
        @submit.prevent="search"
      >
        <UFormField label="Subjek" class="min-w-0 flex-1">
          <USelect
            v-model="subjectModel"
            :items="subjectItems"
            size="xl"
            class="w-full"
            data-testid="filter-subject"
          />
        </UFormField>
        <UFormField label="Aras KBAT" class="sm:w-56">
          <USelect
            v-model="kbatModel"
            :items="kbatItems"
            size="xl"
            class="w-full"
            data-testid="filter-kbat"
          />
        </UFormField>
        <UButton
          type="submit"
          size="xl"
          icon="i-ph-magnifying-glass-bold"
          class="min-h-11"
          data-testid="filter-submit"
          >Cari</UButton
        >
      </form>
    </UCard>

    <template v-if="data">
      <DsEmptyState
        v-if="items.length === 0"
        title="Tiada soalan berstruktur buat masa ini"
        description="Soalan akan ditambah oleh guru dan admin"
        icon="clipboard-text"
        data-testid="structured-empty"
      />

      <ul
        v-else
        class="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 xl:grid-cols-3"
        data-testid="structured-grid"
      >
        <li v-for="c in items" :key="c.id" class="min-w-0">
          <UCard class="h-full" :data-testid="`structured-card-${String(c.id)}`">
            <div class="flex h-full flex-col gap-3">
              <div class="flex flex-wrap items-center gap-2">
                <UBadge color="neutral" variant="soft" data-testid="card-subject">{{
                  c.subjectName
                }}</UBadge>
                <UBadge
                  :color="kbatBadge(c.kbatLevel).color"
                  variant="solid"
                  data-testid="card-kbat"
                  >{{ kbatBadge(c.kbatLevel).label }}</UBadge
                >
                <UBadge color="neutral" variant="soft" data-testid="card-minutes"
                  >{{ c.estimatedMinutes }}m</UBadge
                >
                <UBadge
                  v-if="variant.scope"
                  color="neutral"
                  variant="soft"
                  data-testid="card-level-chip"
                  >{{ c.levelName }}</UBadge
                >
                <UBadge v-if="c.isTrial" color="success" variant="soft" data-testid="card-trial"
                  >Trial</UBadge
                >
              </div>
              <p
                class="line-clamp-3 text-body break-words whitespace-pre-line text-highlighted"
                data-testid="card-preview"
              >
                {{ c.preview }}
              </p>
              <p
                v-if="c.topic"
                class="flex items-start gap-2 text-caption text-muted"
                data-testid="card-topic"
              >
                <UIcon name="i-ph-book-open-duotone" class="mt-1 size-4 shrink-0" aria-hidden="true" />
                <span class="min-w-0 break-words">{{ c.topic }}</span>
              </p>
              <p
                v-if="variant.scope"
                class="flex items-start gap-2 text-caption text-muted"
                data-testid="card-parts"
              >
                <UIcon name="i-ph-stack-duotone" class="mt-1 size-4 shrink-0" aria-hidden="true" />
                {{ c.parts }} bahagian · {{ c.marks }} markah
              </p>
              <p class="flex items-start gap-2 text-caption text-muted" data-testid="card-author">
                <UIcon name="i-ph-user-duotone" class="mt-1 size-4 shrink-0" aria-hidden="true" />
                <span class="min-w-0 break-words"
                  >{{ c.author }}<template v-if="c.school"> · {{ c.school }}</template></span
                >
              </p>
              <div class="mt-auto flex items-center justify-between gap-3">
                <span class="flex items-center gap-2 text-caption text-muted" data-testid="card-footer">
                  <UIcon name="i-ph-list-numbers-duotone" class="size-4" aria-hidden="true" />
                  {{ c.subQuestionCount }} soalan · {{ c.levelName }}
                </span>
                <UButton
                  :to="answerUrl(c.id, variant)"
                  trailing-icon="i-ph-arrow-right-bold"
                  class="min-h-11 min-w-11"
                  data-testid="card-start"
                  >Mula</UButton
                >
              </div>
            </div>
          </UCard>
        </li>
      </ul>

      <div
        v-if="meta && items.length > 0"
        class="flex justify-center"
        data-testid="structured-pager"
      >
        <UPagination
          :page="meta.page"
          :total="meta.totalItems"
          :items-per-page="PAGE_SIZE"
          @update:page="goPage"
        />
      </div>
    </template>

    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      retry-testid="structured-retry"
      testid="structured-error"
      @retry="reload()"
    />
  </div>
</template>
