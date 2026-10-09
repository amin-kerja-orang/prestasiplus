<script setup lang="ts">
/**
 * S6 `/spm/ramalan/:code` "Tracking A SPM — {Subjek}" (M06-T3; FR-M06-42, 48…50, BR-M06-08).
 *
 * Summary chips, h2 "Tracking A 2026" and the set cards: startable first (links to `?year=2026&set=n`,
 * which opens Q3), then locked (inert). A subject without sets shows the empty block. BM and BI answer
 * a redirect to S7 and are replaced at once; an unknown code is the global 404 page.
 */
import {
  ArrowLeft,
  Calendar,
  CircleCheck,
  FileCheck,
  Layers,
  Lock,
  Play,
  Tag,
  Target,
} from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, usePageMeta } from '@/composables'
import { formatCount } from '@/lib/number'

import { fetchTrackingASubject, type TrackingASubject } from '../api'
import LoadError from '../components/LoadError.vue'
import SkeletonCards from '../components/SkeletonCards.vue'
import SubjectIcon from '../components/SubjectIcon.vue'
import { targetName } from '../lib/latih-tubi'
import { SET_STATUS, dskpLine, isStartable, setHref, setSize } from '../lib/tracking'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const code = computed(() => String(route.params.code ?? ''))
const {
  data: result,
  error,
  reload,
} = useApi((signal) => fetchTrackingASubject(code.value, { signal }), code)

const notFound = computed(() => isApiError(error.value) && error.value.status === 404)
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

// BM / BI: replace with the S7 URL (FR-M06-42).
watch(
  result,
  (r) => {
    if (r && 'redirect' in r) void router.replace(r.redirect)
  },
  { immediate: true },
)

const subject = computed<TrackingASubject | null>(() => {
  const r = result.value
  return r && !('redirect' in r) ? r : null
})

// DV-M06-07: tab title and header "Tracking A SPM — {Subjek}", no subtitle.
watch(
  subject,
  (s) => {
    if (!s) return
    pageMeta.setTitle(`Tracking A SPM — ${s.name}`)
    pageMeta.setHeader({ title: `Tracking A SPM — ${s.name}` })
  },
  { immediate: true },
)

const typeName = computed(() =>
  subject.value?.targetType ? targetName(subject.value.targetType) : '',
)
const hasTarget = computed(
  () => subject.value?.targetType != null && subject.value.targetSize != null,
)
const size = computed(() => setSize(subject.value?.targetSize ?? null))

const CHIP =
  'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold whitespace-nowrap'
</script>

<template>
  <div class="min-h-screen px-2 py-4 sm:px-6 sm:py-8 lg:px-8" data-testid="tracking-subject-page">
    <div v-if="subject" class="mx-auto max-w-5xl">
      <RouterLink
        to="/spm/ramalan"
        class="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        data-testid="spm-back"
      >
        <ArrowLeft class="h-4 w-4" aria-hidden="true" />
        Kembali
      </RouterLink>

      <div class="mb-4 flex items-center gap-3 sm:mb-5">
        <div
          class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl"
          :style="{ background: `${subject.color}22`, color: subject.color }"
          data-testid="subject-icon"
        >
          <SubjectIcon :icon="subject.icon" class="h-7 w-7" />
        </div>
        <div class="min-w-0">
          <h1
            class="font-heading text-2xl font-extrabold break-words text-slate-800"
            data-testid="subject-title"
          >
            {{ subject.name }}
          </h1>
          <p class="text-sm text-slate-600" data-testid="subject-sub">
            Tracking A SPM<template v-if="hasTarget">
              · Target {{ typeName }} set: {{ subject.targetSize }} soalan</template
            >
          </p>
        </div>
      </div>

      <div
        class="mb-5 flex flex-wrap gap-2 rounded-2xl border border-purple-200 bg-purple-50 p-3 sm:p-4"
        data-testid="subject-summary"
      >
        <span :class="[CHIP, 'bg-emerald-100 text-emerald-700']" data-testid="sum-bersih">
          <CircleCheck class="h-3 w-3" aria-hidden="true" />
          {{ subject.summary.bersih }} set bersih
        </span>
        <span :class="[CHIP, 'bg-blue-100 text-blue-700']" data-testid="sum-bank">
          <Layers class="h-3 w-3" aria-hidden="true" />
          {{ subject.summary.bankBesar }} set bank besar
        </span>
        <span :class="[CHIP, 'bg-purple-100 text-purple-700']" data-testid="sum-ready">
          <FileCheck class="h-3 w-3" aria-hidden="true" />
          {{ formatCount(subject.summary.readyQuestions) }} soalan kuiz siap guna
        </span>
        <span
          v-if="subject.summary.belumCukup > 0"
          :class="[CHIP, 'bg-amber-100 text-amber-800']"
          data-testid="sum-locked"
        >
          <Lock class="h-3 w-3" aria-hidden="true" />
          {{ subject.summary.belumCukup }} set belum cukup
        </span>
        <span
          v-if="hasTarget"
          :class="[CHIP, 'bg-slate-100 text-slate-700']"
          data-testid="sum-target"
        >
          <Target class="h-3 w-3" aria-hidden="true" />
          Target {{ typeName }}: {{ subject.targetSize }} / set
        </span>
      </div>

      <template v-if="subject.sets.length > 0">
        <h2
          class="mb-3 flex items-center gap-2 font-heading text-lg font-extrabold text-slate-800 sm:text-xl"
          data-testid="year-heading"
        >
          <Calendar class="h-5 w-5 text-purple-600" aria-hidden="true" />
          Tracking A 2026
        </h2>
        <div class="grid grid-cols-1 gap-3 sm:gap-4 md:grid-cols-2" data-testid="set-grid">
          <component
            :is="isStartable(s.status) ? RouterLink : 'div'"
            v-for="s in subject.sets"
            :key="s.setNo"
            v-bind="
              isStartable(s.status)
                ? { to: setHref(subject.code, s.setNo) }
                : { 'data-inert': 'true' }
            "
            :class="[
              'flex min-w-0 items-center gap-3 rounded-2xl border p-4 shadow-sm transition',
              isStartable(s.status)
                ? 'border-slate-100 bg-white hover:-translate-y-0.5 hover:shadow-lg'
                : 'pointer-events-none border-amber-300 bg-amber-50',
            ]"
            :data-testid="`set-card-${s.setNo}`"
            :data-status="s.status"
          >
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2">
                <h3
                  class="font-heading text-base font-extrabold text-slate-800"
                  data-testid="set-title"
                >
                  Set {{ s.setNo }}
                </h3>
                <span
                  :class="[
                    'rounded-full px-2 py-0.5 text-xs font-bold',
                    SET_STATUS[s.status].badge,
                  ]"
                  data-testid="set-badge"
                  >{{ SET_STATUS[s.status].label }}</span
                >
              </div>
              <p class="mt-1 text-sm text-slate-700" data-testid="set-ready">
                {{ formatCount(s.readyCount) }} soalan kuiz siap guna
              </p>
              <p
                v-if="hasTarget || !isStartable(s.status)"
                class="text-xs text-slate-500"
                data-testid="set-format"
              >
                Format set: {{ s.readyCount }} / {{ size }}
              </p>
              <p
                v-if="s.status === 'bank_besar'"
                class="text-xs text-blue-700"
                data-testid="set-bank"
              >
                Bank source: {{ s.bankSource }}. Sistem tetap ambil {{ size }} soalan ikut prioriti
                semasa.
              </p>
              <p
                v-if="s.status === 'belum_cukup'"
                class="text-xs font-semibold text-amber-800"
                data-testid="set-locked-note"
              >
                Belum cukup soalan untuk format KPM.
              </p>
              <p
                class="mt-1 inline-flex items-center gap-1 text-xs text-slate-500"
                data-testid="set-dskp"
              >
                <Tag class="h-3 w-3" aria-hidden="true" />
                {{ dskpLine(s) }}
              </p>
            </div>
            <div
              :class="[
                'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                isStartable(s.status)
                  ? 'bg-purple-100 text-purple-700'
                  : 'bg-amber-100 text-amber-700',
              ]"
              data-testid="set-tile"
            >
              <Play v-if="isStartable(s.status)" class="h-5 w-5" aria-hidden="true" />
              <Lock v-else class="h-5 w-5" aria-hidden="true" />
            </div>
          </component>
        </div>
      </template>
      <div
        v-else
        class="rounded-2xl border border-slate-100 bg-white p-8 text-center shadow-sm"
        data-testid="subject-empty"
      >
        <h2 class="font-heading text-lg font-extrabold text-slate-800">Belum Ada Set Tracking A</h2>
        <p class="mt-1 text-sm text-slate-600">
          Set Tracking A untuk subjek ini akan ditambah tidak lama lagi.
        </p>
      </div>
    </div>
    <LoadError v-else-if="error && !notFound" @retry="reload()" />
    <SkeletonCards v-else-if="!notFound" :count="4" cols="md:grid-cols-2" />
  </div>
</template>
