<script setup lang="ts">
/**
 * Bijak SPM hub (US-01..US-03, US-18 link): two starts. "Kertas Pilihan" lists curated, real-format
 * papers by subject and kertas with the caller's status; "Jana Kertas" builds a fresh paper from the
 * question pool under the Kontrak Blueprint, or shows which section is short.
 */
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { DsEmptyState, DsHeroCard, DsLoadError, DsPage } from '@/ds'
import { useApi } from '@/composables/useApi'

import type { BijakGenerateShortage } from '@pp/contract'

import GenerateShortageAlert from '../components/GenerateShortageAlert.vue'
import type { PaperSummary, SubjectCode } from '../domain/types'
import { useBijakUser, useLearnerTheme } from '../lib/use-bijak'
import { bijakServer } from '../server/client'

useLearnerTheme()
const route = useRoute()
const router = useRouter()
const user = useBijakUser()
const server = bijakServer()

const SUBJECTS = server.subjects()
const tab = ref<'pilihan' | 'jana'>(route.query.tab === 'jana' ? 'jana' : 'pilihan')
const tabs = [
  { label: 'Kertas Pilihan', value: 'pilihan' },
  { label: 'Jana Kertas', value: 'jana' },
]

const {
  data: papers,
  error: papersError,
  reload: reloadPapers,
} = useApi(() => server.listPapers(user.value))
const { data: contracts } = useApi(() => server.listContracts())

/* ----------------------------------------------------------------- Kertas Pilihan */
const subjectFilter = ref<string>('semua')
const kertasFilter = ref<'semua' | '1' | '2'>('semua')
const subjectItems = computed(() => [
  { label: 'Semua subjek', value: 'semua' },
  ...SUBJECTS.map((s) => ({ label: s.name, value: s.code })),
])
const kertasItems = [
  { label: 'Semua kertas', value: 'semua' },
  { label: 'Kertas 1', value: '1' },
  { label: 'Kertas 2', value: '2' },
]

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
  return [...map.entries()].map(([code, v]) => ({ code, ...v }))
})
/** Hero: the sitting in progress ("Sambung kertas"), else the next paper to start ("Mula kertas"). */
const heroPaper = computed(() => {
  const all = papers.value ?? []
  return all.find((p) => p.status === 'sedang') ?? all.find((p) => p.status === 'belum') ?? all[0]
})

function statusText(p: PaperSummary): string {
  if (p.status === 'sedang') return 'Sedang dijawab'
  if (p.status === 'selesai' && p.lastScore) return `${p.lastScore.score} / ${p.lastScore.max}`
  return 'Belum cuba'
}
function actionText(p: PaperSummary): string {
  return p.status === 'sedang' ? 'Sambung' : p.status === 'selesai' ? 'Cuba lagi' : 'Mula'
}
function open(p: PaperSummary): void {
  void router.push({ name: 'm28.bijak.cover', params: { paperId: p.id } })
}

/* -------------------------------------------------------------------- Jana Kertas */
const janaSubject = ref<SubjectCode>('MAT')
const janaKertas = ref<'1' | '2'>('1')
const generating = ref(false)
const shortages = ref<BijakGenerateShortage[]>([])
/** S1-e: network/other failure or 503 GENERATE_LIMIT; both offer "Cuba Semula". */
const generateError = ref('')

const contract = computed(() =>
  contracts.value?.find(
    (c) => c.subject === janaSubject.value && String(c.kertas) === janaKertas.value,
  ),
)
/** BJS-01: the server decides (student: Disahkan only; Admin Pusat in Mod Pelajar: Spec too). */
/** Fresh key per shortage result so the alert remounts and takes focus again on every retry. */
const shortageKey = ref(0)
watch([janaSubject, janaKertas], () => {
  shortages.value = []
  generateError.value = ''
})
const usable = computed(() => !!contract.value?.canGenerate)
/** AC-39.6: only the Admin Pusat tester can reach a Spec contract; students never see a status. */
const isSpec = computed(() => usable.value && contract.value?.source === 'Spec')
const janaSubjectItems = computed(() => SUBJECTS.map((s) => ({ label: s.name, value: s.code })))
const janaKertasItems = [
  { label: 'Kertas 1', value: '1' },
  { label: 'Kertas 2', value: '2' },
]

async function generate(): Promise<void> {
  if (!usable.value || generating.value) return
  generating.value = true
  shortages.value = []
  generateError.value = ''
  try {
    const out = await server.generatePaper(user.value, janaSubject.value, Number(janaKertas.value))
    if (out.ok) {
      await router.push({ name: 'm28.bijak.cover', params: { paperId: out.paperId } })
    } else if (out.reason === 'shortage') {
      shortages.value = out.shortages
      shortageKey.value += 1
    } else if (out.reason === 'limit') {
      generateError.value = 'Kertas tidak dapat disusun sekarang. Cuba lagi.'
    } else {
      generateError.value = 'Belum ada kontrak untuk subjek dan kertas ini'
    }
  } catch {
    generateError.value = 'Kertas tidak dapat dijana sekarang. Cuba lagi.'
  } finally {
    generating.value = false
  }
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
      :subtitle="`${heroPaper.subjectName} · Kertas ${heroPaper.kertas} · ${heroPaper.durationMin} minit · ${heroPaper.marks} markah`"
      :art="heroPaper.status === 'sedang' ? 'books' : 'rocket'"
      :cta-label="heroPaper.status === 'sedang' ? 'Sambung' : 'Mula'"
      data-testid="hero"
      @cta="open(heroPaper)"
    />

    <UTabs v-model="tab" :items="tabs" :content="false" class="w-full" data-testid="bijak-tabs" />

    <!-- Kertas Pilihan -->
    <section
      v-if="tab === 'pilihan'"
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
          <h3 class="text-subheading text-highlighted">{{ g.name }}</h3>
          <UCard v-for="p in g.papers" :key="p.id" :data-testid="`paper-${p.id}`">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex min-w-0 flex-col gap-2">
                <h4 class="text-body text-highlighted">{{ p.title }}</h4>
                <div class="flex flex-wrap items-center gap-2">
                  <UBadge color="neutral" variant="subtle">Kertas {{ p.kertas }}</UBadge>
                  <UBadge color="neutral" variant="subtle">{{ p.marks }} markah</UBadge>
                  <UBadge color="neutral" variant="subtle">{{ p.durationMin }} minit</UBadge>
                  <UBadge color="neutral" variant="subtle">{{ p.year }}</UBadge>
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

    <!-- Jana Kertas -->
    <section
      v-else
      class="flex flex-col gap-4"
      aria-labelledby="h-jana"
      :aria-busy="generating"
      data-testid="tab-jana"
    >
      <h2 id="h-jana" class="text-heading text-highlighted">Jana Kertas</h2>
      <p class="text-body text-toned">
        Pilih subjek dan kertas. Kertas baharu dibina daripada bank soalan mengikut struktur kertas
        sebenar; soalan yang berkongsi rajah sentiasa kekal bersama.
      </p>
      <div class="grid gap-3 sm:grid-cols-2">
        <UFormField label="Subjek">
          <USelect
            v-model="janaSubject"
            :items="janaSubjectItems"
            :disabled="generating"
            class="w-full"
            data-testid="jana-subject"
          />
        </UFormField>
        <UFormField label="Kertas">
          <USelect
            v-model="janaKertas"
            :items="janaKertasItems"
            :disabled="generating"
            class="w-full"
            data-testid="jana-kertas"
          />
        </UFormField>
      </div>

      <UCard v-if="usable && contract" data-testid="contract">
        <div class="flex flex-col gap-2">
          <p class="text-label text-highlighted">
            {{ contract.subjectName }} Kertas {{ contract.kertas }} · {{ contract.code }} ·
            {{ contract.durationMin }} minit
          </p>
          <ul class="flex flex-col gap-1 text-body text-default">
            <li v-for="s in contract.sections" :key="s.label">
              {{ s.label }}: {{ s.take }} soalan
            </li>
          </ul>
          <template v-if="isSpec">
            <div>
              <UBadge color="warning" variant="subtle" data-testid="spec-badge"
                >Spec - ujian sahaja</UBadge
              >
            </div>
            <p class="text-caption text-muted" data-testid="spec-note">
              Data ujian: tidak dikira dalam analitik, kedudukan atau ganjaran.
            </p>
          </template>
        </div>
      </UCard>
      <UAlert
        v-if="contracts && !usable"
        id="jana-reason"
        color="info"
        variant="soft"
        icon="i-ph-info"
        description="Belum ada kontrak untuk subjek dan kertas ini"
        role="status"
        class="max-w-prose"
        data-testid="no-contract"
      />

      <UButton
        size="lg"
        icon="i-ph-magic-wand"
        :loading="generating"
        :aria-disabled="!usable || undefined"
        :aria-describedby="contracts && !usable ? 'jana-reason' : undefined"
        class="min-h-11 w-full justify-center sm:w-auto sm:self-start"
        data-testid="generate"
        @click="generate"
        >{{ generating ? 'Menjana...' : 'Jana Kertas' }}</UButton
      >
      <p v-if="generating" class="text-caption text-muted" role="status" data-testid="generating">
        Menyusun kertas mengikut kontrak...
      </p>

      <GenerateShortageAlert v-if="shortages.length" :key="shortageKey" :shortages="shortages" />
      <div v-if="generateError" class="flex max-w-prose flex-col gap-2" data-testid="generate-error">
        <UAlert color="error" variant="soft" :title="generateError" role="alert" />
        <UButton
          color="neutral"
          class="min-h-11 w-full justify-center sm:w-auto sm:self-start"
          data-testid="generate-retry"
          @click="generate"
          >Cuba Semula</UButton
        >
      </div>
    </section>
  </DsPage>
</template>
