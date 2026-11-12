<script setup lang="ts">
/**
 * Bijak SPM hub (US-01, US-02, US-18 link): one list. "Kertas Pilihan" lists curated, real-format
 * papers by subject and kertas with the caller's status. There is no tab strip and no pupil paper
 * generation (FR-MUR-13-20); any `tab` query is ignored.
 */
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { DsCluster, DsEmptyState, DsHeroCard, DsLoadError, DsPage, DsText } from '@/ds'
import { useApi } from '@/composables/useApi'

import type { PaperSummary } from '../domain/types'
import { useBijakUser, useLearnerTheme } from '../lib/use-bijak'
import { bijakServer } from '../server/client'

useLearnerTheme()
const router = useRouter()
const user = useBijakUser()
const server = bijakServer()

const {
  data: papers,
  error: papersError,
  reload: reloadPapers,
} = useApi(() => server.listPapers(user.value))

/* ----------------------------------------------------------------- Kertas Pilihan */
const subjectFilter = ref<string>('semua')
const kertasFilter = ref<string>('semua')
/** 46 section 4.2 row 1: only the subjects of listed (Terbit) papers, name asc. */
const subjectItems = computed(() => {
  const names = new Map((papers.value ?? []).map((p) => [p.subject, p.subjectName]))
  return [
    { label: 'Semua subjek', value: 'semua' },
    ...[...names]
      .sort(([, a], [, b]) => a.localeCompare(b, 'ms'))
      .map(([value, label]) => ({ label, value })),
  ]
})
/** OPT-KERTAS: the kertas numbers the listed papers hold, ascending. */
const kertasItems = computed(() => [
  { label: 'Semua kertas', value: 'semua' },
  ...[...new Set((papers.value ?? []).map((p) => p.kertas))]
    .sort((a, b) => a - b)
    .map((k) => ({ label: `Kertas ${k}`, value: String(k) })),
])

const filtered = computed(() =>
  (papers.value ?? []).filter(
    (p) =>
      (subjectFilter.value === 'semua' || p.subject === subjectFilter.value) &&
      (kertasFilter.value === 'semua' || String(p.kertas) === kertasFilter.value),
  ),
)
const grouped = computed(() => {
  const map = new Map<string, { name: string; papers: PaperSummary[] }>()
  for (const p of filtered.value) {
    if (!map.has(p.subject)) map.set(p.subject, { name: p.subjectName, papers: [] })
    map.get(p.subject)!.papers.push(p)
  }
  // FR-MUR-13-5: groups by paper count, most first; equal counts by name.
  return [...map.entries()]
    .map(([code, v]) => ({ code, ...v, setLine: setLine(v.papers) }))
    .sort((a, b) => b.papers.length - a.papers.length || a.name.localeCompare(b.name, 'ms'))
})
/** "{n} set · {kod}". [PROPOSED] {kod} is the SPM subject code, the paper code before the slash (1449/2 -> 1449; lead ruling DD3, provisional). No code: "{n} set" alone. */
function setLine(list: readonly PaperSummary[]): string {
  const kod = [...new Set(list.map((p) => (p.code ?? '').split('/')[0]!.trim()).filter(Boolean))].join(', ')
  return kod ? `${list.length} set · ${kod}` : `${list.length} set`
}
/** Hero: the sitting in progress ("Sambung kertas"), else the next paper to start ("Mula kertas"). */
const heroPaper = computed(() => {
  const all = papers.value ?? []
  return all.find((p) => p.status === 'sedang') ?? all.find((p) => p.status === 'belum') ?? all[0]
})

function statusText(p: PaperSummary): string {
  if (p.status === 'sedang') return 'Belum dihantar'
  if (p.status === 'selesai' && p.lastScore) return `${p.lastScore.score} / ${p.lastScore.max}`
  return 'Belum cuba'
}
function actionText(p: PaperSummary): string {
  return p.status === 'sedang' ? 'Sambung' : p.status === 'selesai' ? 'Cuba lagi' : 'Mula'
}
function open(p: PaperSummary): void {
  void router.push({ name: 'm28.bijak.cover', params: { paperId: p.id } })
}
</script>

<template>
  <DsPage
    title="Bijak SPM"
    subtitle="Duduki kertas SPM penuh dalam format kertas sebenar — bermasa, dengan skema."
    subtitle-testid="bijak-subtitle"
    back-to="/spm"
    back-label="Mod SPM"
    data-testid="bijak-hub"
  >
    <template #actions>
      <UButton
        to="/simulasi/kuiz?count=20"
        icon="i-ph-lightning"
        color="neutral"
        data-testid="kuiz-link"
        >Simulasi — Kuiz</UButton
      >
      <UButton
        to="/spm/bijak/sejarah"
        icon="i-ph-clock-counter-clockwise"
        color="neutral"
        data-testid="history-link"
        >Sejarah Bijak SPM</UButton
      >
    </template>

    <DsHeroCard
      v-if="heroPaper"
      :overline="heroPaper.status === 'sedang' ? 'Sambung kertas' : 'Mula kertas'"
      :title="heroPaper.title"
      :subtitle="`${heroPaper.subjectName} · Kertas ${heroPaper.kertas} · ${heroPaper.durationMin > 0 ? `${heroPaper.durationMin} minit · ` : ''}${heroPaper.marks} markah`"
      :art="heroPaper.status === 'sedang' ? 'books' : 'rocket'"
      :cta-label="heroPaper.status === 'sedang' ? 'Sambung' : 'Mula'"
      data-testid="hero"
      @cta="open(heroPaper)"
    />

    <!-- Kertas Pilihan -->
    <section
      class="flex flex-col gap-4"
      aria-labelledby="h-pilihan"
      data-testid="tab-pilihan"
    >
      <h2 id="h-pilihan" class="text-heading text-highlighted">Kertas Pilihan</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Subjek">
          <USelect
            v-model="subjectFilter"
            :items="subjectItems"
            class="w-full"
            data-testid="filter-subject"
          />
        </UFormField>
        <UFormField label="Kertas">
          <USelect
            v-model="kertasFilter"
            :items="kertasItems"
            class="w-full"
            data-testid="filter-kertas"
          />
        </UFormField>
      </div>

      <DsLoadError
        v-if="papersError"
        message="Senarai kertas tidak dapat dimuatkan."
        @retry="reloadPapers"
      />
      <div v-else-if="!papers" class="flex flex-col gap-3" aria-busy="true">
        <USkeleton v-for="n in 3" :key="n" class="h-24 w-full" />
      </div>
      <DsEmptyState
        v-else-if="!filtered.length"
        title="Tiada kertas tersedia buat masa ini"
        description="Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi."
        icon="i-ph-files"
        data-testid="empty-pilihan"
      />
      <template v-else>
        <p class="text-caption text-muted" role="status" data-testid="paper-count">
          {{ filtered.length }} kertas
        </p>
        <section
          v-for="g in grouped"
          :key="g.code"
          class="flex flex-col gap-3"
          :aria-label="g.name"
        >
          <DsCluster align="baseline" gap="xs">
            <h3 class="text-subheading text-highlighted">{{ g.name }}</h3>
            <DsText variant="caption" tabular data-testid="group-sets">{{ g.setLine }}</DsText>
          </DsCluster>
          <UCard v-for="p in g.papers" :key="p.id" :data-testid="`paper-${p.id}`">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 flex-col gap-2">
                <h4 class="text-body text-highlighted">{{ p.title }}</h4>
                <div class="flex flex-wrap items-center gap-2" data-testid="paper-chips">
                  <UBadge color="neutral" variant="subtle">Kertas {{ p.kertas }}</UBadge>
                  <UBadge color="neutral" variant="subtle">{{ p.marks }} markah</UBadge>
                  <UBadge v-if="p.durationMin > 0" color="neutral" variant="subtle">{{ p.durationMin }} min</UBadge>
                  <UBadge
                    :color="
                      p.status === 'belum' ? 'neutral' : p.status === 'sedang' ? 'info' : 'success'
                    "
                    variant="soft"
                    data-testid="paper-status"
                    >{{ statusText(p) }}</UBadge
                  >
                </div>
              </div>
              <UButton :data-testid="`open-${p.id}`" @click="open(p)">{{ actionText(p) }}</UButton>
            </div>
          </UCard>
        </section>
      </template>
    </section>
  </DsPage>
</template>
