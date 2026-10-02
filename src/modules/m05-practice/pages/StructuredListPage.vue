<script setup lang="ts">
/**
 * S10 `/latihan-berstruktur` "Soalan Berstruktur" and its SPM variants `?scope=spm[&track=bahasa]`
 * (M05-T7; FR-M05-90…95, FR-M05-133…136, BR-23, DV-M05-01).
 *
 * - Filter form (Subjek, Aras KBAT, "Cari"): a GET form on live; here it navigates with both
 *   parameters (empty values kept, page reset) and keeps `scope` / `track`.
 * - Cards from #15 (1 / `sm` 2 / `xl` 3 columns) with the KBAT badge; "Mula" → Q3 with the variant.
 * - The Laravel pager keeps `subject_id`, `kbat_level`, `scope`, `track`.
 * - The variants replace the heading (back link, h1, Tracking A info card) and the shell header
 *   title (M06 DV-M06-07, no subtitle). A null `school` hides " · {school}".
 */
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ClipboardList,
  Languages,
  Layers,
  ListOrdered,
  Search,
  UserPen,
} from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { LaravelPager } from '@/components/data'
import { AlertBox } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'

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
const subjectOptions = computed(() => meta.value?.subjectOptions ?? [])

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

const pagerQuery = computed(() => ({
  subject_id: q('subject_id'),
  kbat_level: q('kbat_level'),
  scope: variant.value.scope ?? '',
  track: variant.value.track ?? '',
}))

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

const SELECT =
  'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800'
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="structured-page">
    <div class="mx-auto max-w-7xl">
      <!-- Heading: plain, Subjektif SPM, Tracking A Bahasa -->
      <div class="mb-4 sm:mb-6" data-testid="structured-heading">
        <RouterLink
          v-if="variant.scope"
          :to="variant.track ? '/spm/ramalan' : '/spm/subjektif'"
          class="mb-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
          data-testid="structured-back"
        >
          <ArrowLeft class="h-4 w-4" />
          {{ variant.track ? 'Kembali ke Tracking A SPM' : 'Kembali ke Subjektif SPM' }}
        </RouterLink>

        <div v-if="variant.track">
          <span
            class="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold tracking-wide text-indigo-700 uppercase"
            data-testid="structured-pill"
          >
            <Languages class="h-3.5 w-3.5" />
            Tracking A Bahasa
          </span>
        </div>

        <h1 class="font-heading text-2xl font-extrabold text-slate-900" data-testid="structured-h1">
          {{
            variant.track
              ? 'Tracking A Bahasa'
              : variant.scope
                ? 'Subjektif SPM'
                : 'Soalan Berstruktur'
          }}
        </h1>
        <p class="text-sm text-slate-500 sm:text-base" data-testid="structured-sub">
          <template v-if="variant.track">
            Set bahasa dibuka ikut format kertas sebenar. BM dan BI tidak dipaksa menjadi 40 MCQ,
            dan dipaparkan mengikut susunan BM kemudian BI.
          </template>
          <template v-else-if="variant.scope">
            Pilih set struktur dan esei Tingkatan 4 atau 5 mengikut subjek semasa
          </template>
          <template v-else
            >Latih tubi format Kertas 2 — jawab &amp; semak secara automatik</template
          >
        </p>

        <div
          v-if="variant.track"
          class="mt-4 rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm"
          data-testid="structured-info"
        >
          <p class="mb-3 text-sm text-slate-600">
            Subjek bahasa tidak dipaksa menjadi 40 MCQ. Laluan ini menggunakan paper-based tracking
            dengan pendekatan berstruktur / respons sebenar.
          </p>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="chip in BAHASA_CHIPS"
              :key="chip"
              class="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700"
            >
              {{ chip }}
            </span>
            <span
              v-if="meta"
              class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
              data-testid="structured-found"
            >
              <Layers class="h-3.5 w-3.5" />
              {{ meta.totalItems }} set ditemui
            </span>
          </div>
        </div>
      </div>

      <!-- Filter card -->
      <form
        class="mb-4 flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:mb-6 sm:flex-row sm:items-end sm:p-6"
        data-testid="structured-filter"
        @submit.prevent="search"
      >
        <div class="min-w-0 flex-1">
          <label for="subject_id" class="mb-1 block text-xs font-semibold text-slate-600">
            Subjek
          </label>
          <select
            id="subject_id"
            v-model="subjectId"
            name="subject_id"
            :class="SELECT"
            data-testid="filter-subject"
          >
            <option value="">Semua Subjek</option>
            <option v-for="o in subjectOptions" :key="o.id" :value="String(o.id)">
              {{ o.name }}
            </option>
          </select>
        </div>
        <div class="sm:w-40">
          <label for="kbat_level" class="mb-1 block text-xs font-semibold text-slate-600">
            Aras KBAT
          </label>
          <select
            id="kbat_level"
            v-model="kbat"
            name="kbat_level"
            :class="SELECT"
            data-testid="filter-kbat"
          >
            <option v-for="o in KBAT_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <button
          type="submit"
          class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          data-testid="filter-submit"
        >
          <Search class="h-4 w-4" />
          Cari
        </button>
      </form>

      <template v-if="data">
        <!-- Empty -->
        <div
          v-if="items.length === 0"
          class="rounded-2xl bg-white p-10 text-center shadow-sm"
          data-testid="structured-empty"
        >
          <ClipboardList class="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p class="font-semibold text-slate-600">Tiada soalan berstruktur buat masa ini</p>
          <p class="text-sm text-slate-400">Soalan akan ditambah oleh guru dan admin</p>
        </div>

        <!-- Cards -->
        <div
          v-else
          class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
          data-testid="structured-grid"
        >
          <article
            v-for="c in items"
            :key="c.id"
            class="flex min-w-0 flex-col rounded-2xl bg-white p-5 shadow-sm"
            :data-testid="`structured-card-${String(c.id)}`"
          >
            <div class="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold">
              <span
                class="rounded-full bg-slate-100 px-2 py-0.5 text-slate-700"
                data-testid="card-subject"
                >{{ c.subjectName }}</span
              >
              <span
                class="rounded-full px-2 py-0.5"
                :class="kbatBadge(c.kbatLevel).cls"
                data-testid="card-kbat"
                >{{ kbatBadge(c.kbatLevel).label }}</span
              >
              <span
                class="rounded-full bg-cyan-50 px-2 py-0.5 text-cyan-700"
                data-testid="card-minutes"
                >{{ c.estimatedMinutes }}m</span
              >
              <span
                v-if="variant.scope"
                class="rounded-full bg-indigo-50 px-2 py-0.5 text-indigo-700"
                data-testid="card-level-chip"
                >{{ c.levelName }}</span
              >
              <span
                v-if="c.isTrial"
                class="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700"
                data-testid="card-trial"
                >Trial</span
              >
            </div>
            <p
              class="mb-3 line-clamp-3 text-sm break-words whitespace-pre-line text-slate-800"
              data-testid="card-preview"
            >
              {{ c.preview }}
            </p>
            <p
              v-if="c.topic"
              class="mb-1 flex items-start gap-2 text-xs text-slate-400"
              data-testid="card-topic"
            >
              <BookOpen class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span class="min-w-0 break-words">{{ c.topic }}</span>
            </p>
            <p
              v-if="variant.scope"
              class="mb-1 flex items-start gap-2 text-xs text-slate-400"
              data-testid="card-parts"
            >
              <Layers class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {{ c.parts }} bahagian · {{ c.marks }} markah
            </p>
            <p class="mb-3 flex items-start gap-2 text-xs text-slate-400" data-testid="card-author">
              <UserPen class="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span class="min-w-0 break-words"
                >{{ c.author }}<template v-if="c.school"> · {{ c.school }}</template></span
              >
            </p>
            <div
              class="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-3"
            >
              <span
                class="flex items-center gap-2 text-xs text-slate-400"
                data-testid="card-footer"
              >
                <ListOrdered class="h-3.5 w-3.5" />
                {{ c.subQuestionCount }} soalan · {{ c.levelName }}
              </span>
              <RouterLink
                :to="answerUrl(c.id, variant)"
                class="inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white hover:bg-cyan-700"
                data-testid="card-start"
              >
                Mula
                <ArrowRight class="h-4 w-4" />
              </RouterLink>
            </div>
          </article>
        </div>

        <div v-if="meta && items.length > 0" class="mt-6" data-testid="structured-pager">
          <LaravelPager
            :page="meta.page"
            :total="meta.totalItems"
            :per-page="PAGE_SIZE"
            path="/latihan-berstruktur"
            :query="pagerQuery"
            @change="goPage"
          />
        </div>
      </template>

      <div v-else-if="error" class="mx-auto max-w-xl space-y-3" data-testid="structured-error">
        <AlertBox :messages="LOAD_ERROR" />
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow hover:bg-blue-700"
          data-testid="structured-retry"
          @click="reload()"
        >
          Cuba Semula
        </button>
      </div>
    </div>
  </div>
</template>
