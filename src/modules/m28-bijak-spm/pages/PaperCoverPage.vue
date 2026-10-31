<script setup lang="ts">
/**
 * Paper cover (US-04, US-12): paper code, subject, kertas, minutes, numbered instructions and the
 * foldable reference sheet; the choice of Mod Peperiksaan / Mod Latihan; and, when an unsubmitted
 * sitting exists, the "Percubaan belum dihantar" choice (Sambung / Mula Semula).
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { DsEmptyState, DsHeroCard } from '@/ds'
import { useApi } from '@/composables/useApi'

import PastSittingsLink from '../components/PastSittingsLink.vue'
import RichText from '../components/RichText.vue'
import { formatClock } from '../domain/paper-model'
import type { AttemptMode } from '../domain/types'
import { useBijakUser, useLearnerTheme } from '../lib/use-bijak'
import { bijakServer } from '../server/client'

useLearnerTheme()
const route = useRoute()
const router = useRouter()
const user = useBijakUser()
const server = bijakServer()
const paperId = computed(() => String(route.params.paperId))

/** AC-20.3 grid: one row per Bahagian; "Markah diperoleh" stays blank for the examiner. */
const gridColumns = [
  { accessorKey: 'label', header: 'Bahagian' },
  { accessorKey: 'marks', header: 'Markah penuh' },
  { id: 'awarded', header: 'Markah diperoleh' },
]
const { data: cover, error } = useApi(() => server.getCover(user.value, paperId.value), paperId)
const { data: open, reload: reloadOpen } = useApi(
  () => server.findInProgress(user.value, paperId.value),
  paperId,
)

const mode = ref<AttemptMode>('exam')
const starting = ref(false)
const confirmRestart = ref(false)
const failure = ref('')

const modeItems = [
  {
    value: 'exam',
    label: 'Mod Peperiksaan',
    description: 'Bermasa, tiada markah segera. Skema pemarkahan dipaparkan selepas Hantar.',
  },
  {
    value: 'latihan',
    label: 'Mod Latihan',
    description: 'Satu soalan pada satu masa dengan Semak dan maklum balas segera.',
  },
]
const needsChoice = computed(() => !!open.value && !open.value.fresh)

async function begin(restart: boolean): Promise<void> {
  starting.value = true
  failure.value = ''
  confirmRestart.value = false
  try {
    const target = open.value && !restart ? open.value.mode : mode.value
    const out = await server.startAttempt(user.value, paperId.value, target, { restart })
    await router.push({ name: 'm28.bijak.attempt', params: { attemptId: out.attemptId } })
  } catch {
    failure.value = 'Percubaan tidak dapat dimulakan. Cuba lagi.'
    starting.value = false
    await reloadOpen()
  }
}
</script>

<template>
  <main class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6" data-testid="bijak-cover">
    <UButton
      to="/spm/bijak"
      icon="i-ph-arrow-left"
      color="neutral"
      variant="ghost"
      class="self-start"
      >Bijak SPM</UButton
    >

    <DsEmptyState
      v-if="error"
      title="Kertas tidak ditemui"
      description="Kertas ini tidak tersedia atau bukan milik anda."
      icon="i-ph-file-x"
    />
    <div v-else-if="!cover" class="flex flex-col gap-3" aria-busy="true">
      <USkeleton class="h-10 w-2/3" />
      <USkeleton class="h-32 w-full" />
    </div>

    <template v-else>
      <h1 class="sr-only" data-testid="cover-title">{{ cover.title }}</h1>
      <DsHeroCard
        :overline="`SULIT · ${cover.code}`"
        :title="cover.title"
        :subtitle="`${cover.subjectName} · Kertas ${cover.kertas} · ${cover.durationMin} minit · ${cover.marks} markah · ${cover.questionCount} soalan`"
        art="books"
        :cta-label="open ? 'Sambung' : 'Mula'"
        data-testid="cover-hero"
        @cta="begin(false)"
      />
      <PastSittingsLink :paper-id="paperId" class="self-start" />

      <UAlert
        v-if="needsChoice && open"
        color="info"
        variant="soft"
        icon="i-ph-hourglass-medium"
        title="Percubaan belum dihantar"
        role="region"
        data-testid="resume-choice"
      >
        <template #description>
          <p>
            Anda mempunyai percubaan <strong>{{ open.title }}</strong> yang masih berjalan.
          </p>
          <p>Masa berlalu setakat ini: {{ formatClock(open.elapsedSeconds) }}</p>
          <div class="mt-3 flex flex-col gap-2 sm:flex-row">
            <UButton :loading="starting" data-testid="resume" @click="begin(false)"
              >Sambung — teruskan jawapan &amp; masa sedia ada</UButton
            >
            <UButton color="neutral" data-testid="restart" @click="confirmRestart = true"
              >Mula Semula — kosongkan jawapan &amp; masa</UButton
            >
          </div>
          <p class="mt-2 text-caption">
            “Sambung” mengekalkan semua jawapan anda. “Mula Semula” tidak boleh diundur.
          </p>
        </template>
      </UAlert>

      <section class="flex flex-col gap-2" aria-labelledby="h-arahan">
        <h2 id="h-arahan" class="text-heading text-highlighted">Arahan</h2>
        <ol class="flex flex-col gap-1 text-body text-default" data-testid="instructions">
          <li v-for="(line, i) in cover.instructions" :key="i">{{ i + 1 }}. {{ line }}</li>
        </ol>
        <ul class="flex flex-col gap-1 text-body text-default" data-testid="cover-sections">
          <li v-for="s in cover.sections" :key="s.label">
            <strong>{{ s.label }}</strong> · [{{ s.marks }} markah] · {{ s.questionCount }} soalan ·
            {{ s.instruction }}<template v-if="s.compulsory"> (wajib)</template>
          </li>
        </ul>
      </section>

      <!-- AC-20.3 (REQ-A-012): only when the server says a placed question is marked by an examiner. -->
      <section
        v-if="cover.examinerGrid === true"
        class="flex flex-col gap-2"
        aria-labelledby="h-pemeriksa"
        data-testid="examiner-grid"
      >
        <h2 id="h-pemeriksa" class="text-heading text-highlighted">Untuk Kegunaan Pemeriksa</h2>
        <UTable
          :data="cover.sections"
          :columns="gridColumns"
          data-testid="examiner-grid-table"
        />
      </section>

      <section
        v-for="r in cover.reference"
        :key="r.title"
        class="flex flex-col gap-2"
        data-testid="reference"
      >
        <UCollapsible :default-open="true">
          <UButton
            color="neutral"
            variant="soft"
            trailing-icon="i-ph-caret-down"
            block
            class="justify-between"
            >{{ r.title }}</UButton
          >
          <template #content>
            <ul class="flex flex-col gap-2 py-3 text-body text-default">
              <li v-for="(item, i) in r.items" :key="i"><RichText :text="item" /></li>
            </ul>
          </template>
        </UCollapsible>
      </section>

      <section v-if="!needsChoice" class="flex flex-col gap-3" aria-labelledby="h-mod">
        <h2 id="h-mod" class="text-heading text-highlighted">Pilih mod</h2>
        <URadioGroup
          v-model="mode"
          :items="modeItems"
          variant="card"
          legend="Mod menjawab"
          data-testid="mode-choice"
        />
        <UAlert v-if="failure" color="error" variant="soft" :title="failure" role="alert" />
      </section>
    </template>

    <UModal
      v-model:open="confirmRestart"
      title="Mula semula?"
      description="Semua jawapan dan masa untuk percubaan ini akan dikosongkan. Mula semula?"
    >
      <template #footer>
        <div class="flex w-full flex-col gap-2 sm:flex-row sm:justify-end">
          <UButton color="neutral" @click="confirmRestart = false">Batal</UButton>
          <UButton data-testid="confirm-restart" @click="begin(true)">Mula Semula</UButton>
        </div>
      </template>
    </UModal>
  </main>
</template>
