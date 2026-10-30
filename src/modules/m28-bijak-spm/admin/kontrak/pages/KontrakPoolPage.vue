<script setup lang="ts">
/**
 * K3: Pratonton Kolam (`/admin/spm/kontrak/:subjek/:kertas/kolam`, design 5) and "Jana draf kertas".
 * The pool is computed from the saved version by the same code as Jana Kertas; the verdict comes
 * from the generator's solver, never from the table colours.
 */
import type { BijakBlueprintView, BijakPoolPreview } from '@pp/contract'
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useFlash } from '@/composables/useFlash'
import { DsEmptyState, DsLoadError, DsPage, DsPanel, DsStatRow, type StatItem } from '@/ds'

import { ADMIN_ROUTES } from '../../papers/ui'
import PoolFillTable from '../components/PoolFillTable.vue'
import SourceBadge from '../components/SourceBadge.vue'
import {
  REASON_LABEL,
  bankHref,
  kbatLines,
  rangeOf,
  sectionShort,
  shortLineCount,
  shortageLine,
  tpLines,
  topicLines,
} from '../domain/pool'
import { KONTRAK_ROUTES, KontrakError } from '../server/api'
import { kontrakServer } from '../server/client'
import { formatDateTime } from '../../../lib/use-bijak'

const api = kontrakServer()
const route = useRoute()
const router = useRouter()
const flash = useFlash()

const subject = computed(() => String(route.params.subjek))
const kertas = computed(() => Number(route.params.kertas))

const pool = ref<BijakPoolPreview | null>(null)
const view = ref<BijakBlueprintView | null>(null)
const status = ref<'loading' | 'error' | 'ready'>('loading')
const computedAt = ref(Date.now())
const onlyShort = ref(false)

async function load(): Promise<void> {
  status.value = 'loading'
  try {
    const [p, v] = await Promise.all([api.pool(subject.value, kertas.value), api.get(subject.value, kertas.value)])
    pool.value = p
    view.value = v
    computedAt.value = Date.now()
    status.value = 'ready'
  } catch {
    status.value = 'error'
  }
}
onMounted(load)

const editTo = computed(() => ({
  name: KONTRAK_ROUTES.edit,
  params: { subjek: subject.value, kertas: String(kertas.value) },
}))

const modeExcluded = computed(() => pool.value?.sections.reduce((n, s) => n + s.modeExcluded, 0) ?? 0)
const reasons = computed(() => {
  const p = pool.value
  if (!p) return []
  const list: { key: string; label: string; count: number; href: string }[] = p.excluded.byReason.map((r) => ({
    key: r.reason,
    label: REASON_LABEL[r.reason] ?? r.reason,
    count: r.count,
    href: bankHref(r.bankQuery),
  }))
  if (modeExcluded.value)
    list.push({
      key: 'mode',
      label: REASON_LABEL.mode!,
      count: modeExcluded.value,
      href: bankHref(p.sections[0]?.bankQuery, { tiada: 'mode' }),
    })
  return list.filter((r) => r.count > 0)
})

const shortCount = computed(() => (pool.value ? shortLineCount(pool.value) : 0))
const stats = computed<StatItem[]>(() => [
  { key: 'terbit', label: 'Soalan Terbit', value: '-', icon: 'books', sub: 'Belum disediakan oleh API' },
  { key: 'layak', label: 'Soalan layak', value: '-', icon: 'check-circle', sub: 'Belum disediakan oleh API' },
  {
    key: 'tidak',
    label: 'Soalan tidak layak',
    value: pool.value?.excluded.total ?? 0,
    icon: 'warning',
    to: pool.value ? bankHref(pool.value.sections[0]?.bankQuery, { layak: 'tidak' }) : undefined,
  },
  { key: 'kurang', label: 'Baris kurang', value: shortCount.value, icon: 'warning-circle', valueTone: shortCount.value ? 'error' : 'success' },
])

const verdict = computed(() => pool.value?.verdict ?? 'boleh')
const firstFailure = computed(() => (pool.value?.firstFailure ? shortageLine(pool.value.firstFailure) : ''))
const eachEnough = computed(() => shortCount.value === 0)
const everyEmpty = computed(() => !!pool.value && pool.value.sections.length > 0 && pool.value.sections.every((s) => s.eligible === 0))
const hasStandard = computed(() => !!pool.value?.sections.some((s) => s.quota.length || s.tp.length || s.kbat))

const sections = computed(() => {
  const p = pool.value
  if (!p) return []
  return p.sections
    .map((s, i) => ({ s, i, range: rangeOf(p, i), short: sectionShort(s) }))
    .filter((x) => !onlyShort.value || x.short > 0)
})

/* ---------------------------------------------------------------- Jana draf kertas */
const generating = ref(false)
const draftError = ref<{ title: string; lines: string[]; retry: boolean } | null>(null)
const canGenerate = computed(() => verdict.value === 'boleh')
const reasonText = 'Tidak boleh dijana - lihat baris kurang di atas.'

async function generate(): Promise<void> {
  if (!canGenerate.value || generating.value) return
  generating.value = true
  draftError.value = null
  try {
    const { paperId } = await api.generateDraft(subject.value, kertas.value)
    flash.show({ type: 'success', message: 'Draf kertas dijana. Kertas belum diterbitkan.' })
    await router.push({ name: ADMIN_ROUTES.paperEdit, params: { id: paperId } })
  } catch (e) {
    if (e instanceof KontrakError && e.kind === 'shortage') {
      draftError.value = { title: 'Draf kertas tidak dapat dijana.', lines: e.shortages.map(shortageLine), retry: false }
      await load()
    } else {
      draftError.value = { title: 'Draf kertas tidak dapat dijana sekarang. Cuba lagi.', lines: [], retry: true }
    }
  } finally {
    generating.value = false
  }
}
</script>

<template>
  <DsPage
    layout="report"
    :back-to="editTo"
    back-label="Kembali"
    :subtitle="
      view
        ? `${view.subjectName} - Kertas ${view.kertas} - versi ${view.version} (${view.source})`
        : undefined
    "
    data-testid="kontrak-pool"
  >
    <template v-if="view" #meta><SourceBadge :source="view.source" /></template>
    <template #actions>
      <div class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        <UButton color="neutral" variant="soft" class="min-h-11" icon="i-ph-arrow-clockwise" label="Muat Semula" :loading="status === 'loading'" data-testid="pool-reload" @click="load" />
        <UButton
          color="neutral"
          variant="soft"
          class="min-h-11"
          icon="i-ph-list-magnifying-glass"
          label="Lihat Soalan"
          :href="bankHref(pool?.sections[0]?.bankQuery)"
          target="_blank"
          rel="noopener"
        />
        <UButton
          class="min-h-11"
          icon="i-ph-magic-wand"
          :label="generating ? 'Menjana...' : 'Jana Draf Kertas'"
          :loading="generating"
          :aria-disabled="canGenerate ? undefined : 'true'"
          aria-describedby="draft-reason"
          data-testid="generate-draft"
          @click="generate"
        />
      </div>
      <p v-if="status === 'ready' && !canGenerate" id="draft-reason" class="mt-1 text-caption text-muted" data-testid="draft-reason">{{ reasonText }}</p>
    </template>

    <div v-if="status === 'loading' && !pool" role="status" aria-busy="true" class="flex flex-col gap-4">
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
    <DsLoadError v-else-if="status === 'error'" message="Tidak dapat memuatkan pratonton kolam. Sila cuba semula." @retry="load" />
    <template v-else-if="pool">
      <UAlert
        v-if="draftError"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        :title="draftError.title"
        data-testid="draft-error"
      >
        <template #description>
          <ul v-if="draftError.lines.length" class="list-disc ps-5">
            <li v-for="l in draftError.lines" :key="l">{{ l }}</li>
          </ul>
          <UButton v-if="draftError.retry" class="mt-2 min-h-11" color="neutral" variant="soft" label="Cuba Semula" @click="generate" />
        </template>
      </UAlert>

      <UAlert
        v-if="verdict === 'boleh'"
        color="success"
        variant="subtle"
        icon="i-ph-check-circle"
        title="Boleh dijana"
        description="Semua kekangan dapat dipenuhi daripada soalan layak."
        data-testid="verdict"
      />
      <UAlert
        v-else-if="verdict === 'tidak_boleh'"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        title="Tidak boleh dijana"
        data-testid="verdict"
      >
        <template #description>
          <p v-if="eachEnough">
            Setiap baris cukup secara berasingan, tetapi gabungan kekangan tidak dapat dipenuhi. Kekangan pertama yang gagal: {{ firstFailure }}.
          </p>
          <p v-else>Kekangan pertama yang gagal: {{ firstFailure }}.</p>
        </template>
      </UAlert>
      <UAlert
        v-else
        color="warning"
        variant="subtle"
        icon="i-ph-question"
        title="Belum dapat dipastikan"
        description="Penyelesai mencapai had masa. Tekan Muat Semula untuk mencuba lagi."
        data-testid="verdict"
      />
      <p class="text-caption text-muted">
        Dikira {{ formatDateTime(computedAt) }} - versi {{ pool.blueprint.version }} ({{ pool.blueprint.source }}).
      </p>

      <UAlert
        v-if="!hasStandard"
        color="info"
        variant="subtle"
        icon="i-ph-info"
        description="Kontrak ini belum ada kuota topik, profil atau KBAT. Pratonton hanya menunjukkan bilangan soalan."
      />

      <DsStatRow :items="stats" density="roomy" :cols="4" aria-label="Ringkasan kolam" />

      <DsEmptyState
        v-if="everyEmpty"
        title="Tiada soalan Terbit untuk tag ini"
        icon="tray"
        data-testid="pool-empty"
      >
        <template #actions>
          <UButton class="min-h-11" label="Lihat Soalan" :href="bankHref(pool.sections[0]?.bankQuery)" target="_blank" rel="noopener" />
        </template>
      </DsEmptyState>
      <template v-else>
        <DsPanel title="Soalan Tidak Layak">
          <DsEmptyState v-if="!reasons.length" size="sm" title="Semua soalan Terbit layak." />
          <template v-else>
            <ul class="flex flex-col" data-testid="reasons">
              <li v-for="r in reasons" :key="r.key" class="flex min-h-11 flex-wrap items-center justify-between gap-2">
                <span class="text-body">{{ r.label }}</span>
                <span class="flex items-center gap-2">
                  <span class="tabular text-label">{{ r.count }}</span>
                  <UButton color="neutral" variant="ghost" size="sm" class="min-h-11" label="Lihat soalan" :href="r.href" target="_blank" rel="noopener" />
                </span>
              </li>
            </ul>
            <p class="mt-2 text-caption text-muted">
              Satu soalan boleh dikira dalam lebih daripada satu sebab. Jumlah soalan tidak layak: {{ pool.excluded.total }}.
            </p>
          </template>
        </DsPanel>

        <USwitch v-model="onlyShort" label="Tunjuk baris kurang sahaja" data-testid="only-short" />
        <DsEmptyState v-if="onlyShort && !sections.length" size="sm" title="Tiada baris kurang." />

        <DsPanel
          v-for="x in sections"
          :key="x.s.position"
          :title="`${x.s.label} - ${x.range} - ${x.s.effectiveMarks} markah`"
          :data-testid="`pool-section-${x.s.position}`"
        >
          <template #actions>
            <UBadge
              :color="x.short ? 'error' : 'success'"
              variant="subtle"
              :icon="x.short ? 'i-ph-warning-circle' : 'i-ph-check-circle'"
              :label="x.short ? `Kurang ${x.short} baris` : 'Cukup'"
            />
          </template>
          <DsEmptyState v-if="x.s.eligible === 0" size="sm" title="Tiada soalan Terbit untuk tag ini" />
          <div v-else class="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-12">
            <div class="min-w-0 xl:col-span-7">
              <PoolFillTable title="Kuota topik" name-header="Unit" :lines="topicLines(x.s)" />
            </div>
            <div class="flex min-w-0 flex-col gap-6 xl:col-span-5">
              <PoolFillTable v-if="x.s.tp.length" title="Sasaran TP" name-header="Kumpulan slot" :lines="tpLines(x.s)" />
              <PoolFillTable v-if="x.s.kbat" title="KBAT" name-header="Baris" :lines="kbatLines(x.s)" />
            </div>
          </div>
        </DsPanel>
      </template>
    </template>
  </DsPage>
</template>
