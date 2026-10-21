<script setup lang="ts">
/**
 * S23 `/amaran/ringkasan-eksekutif` "Ringkasan Eksekutif" (design `docs/design/m18-amaran-summary.md` section 4;
 * M18 SRS #22, FR-M18-83 to 88). The school admin's own school: the page ignores `scope`, `school_id` and the other
 * URL params and always calls `GET /api/amaran/summary` with no query (the default scope is the own school).
 * Outside the print sheet: "Kembali" (to S4) and "Cetak / PDF" (`window.print`). Inside the sheet (light scheme):
 * head, four tiles, "Taburan Risiko", kombo figures, the subject card (only with rows) and the footer.
 * "Perbandingan Sekolah Daerah" (`schools[]`) is not shown: one school only.
 *
 * States: loading skeleton; 403 and 404 render the global page in place; any other failure shows the server's
 * message with "Cuba Semula".
 */
import { computed, watch } from 'vue'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsBackLink, DsLoadError, DsPage, DsPrintSheet } from '@/ds'

import { fetchAmaranSummary } from '../api/amaran'
import RingkasanDistribution from '../components/ringkasan/RingkasanDistribution.vue'
import RingkasanKombo from '../components/ringkasan/RingkasanKombo.vue'
import RingkasanSubjects from '../components/ringkasan/RingkasanSubjects.vue'
import RingkasanTiles from '../components/ringkasan/RingkasanTiles.vue'
import {
  BACK_PATH,
  FOOTER_LINE_2,
  formatGenerated,
  tabTitle,
  TITLE,
} from '../components/ringkasan/ringkasan-format'

const pageMeta = usePageMeta()

const { data, error, loading, reload } = useApi((signal) => fetchAmaranSummary({ signal }))

const status = computed(() => (isApiError(error.value) ? error.value.status : null))
const refused = computed(() => status.value === 403 || status.value === 404)
watch(
  status,
  (s) => {
    if (s === 403 || s === 404) setRouteOutcome(s)
  },
  { immediate: true },
)

watch(
  data,
  (d) => {
    if (!d) return
    pageMeta.setHeader({ title: TITLE, subtitle: d.title })
    pageMeta.setTitle(tabTitle(d.title))
  },
  { immediate: true },
)

const generated = computed(() => (data.value ? formatGenerated(data.value.generatedAt) : null))
const GENERIC = 'Ralat berlaku. Sila cuba lagi.'
const errorMessage = computed(() => {
  const e = error.value
  if (!e || e.message === '' || /^HTTP \d+$/.test(e.message)) return GENERIC
  return e.message
})

function print(): void {
  window.print()
}
</script>

<template>
  <DsPage data-testid="rk-page">
    <template v-if="!refused">
      <div
        v-if="!error"
        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden"
        data-testid="rk-toolbar"
      >
        <DsBackLink :to="BACK_PATH" data-testid="rk-back" />
        <UButton
          type="button"
          icon="i-ph-printer"
          label="Cetak / PDF"
          size="lg"
          class="min-h-11 justify-center"
          :disabled="loading || !data"
          data-testid="rk-print"
          @click="print"
        />
      </div>

      <DsPrintSheet v-if="data" data-testid="rk-sheet">
        <article class="flex flex-col gap-4 p-1 text-default" aria-label="Ringkasan Eksekutif">
          <header class="flex flex-col gap-1" data-testid="rk-head">
            <p class="text-caption text-muted">PRESTASIPLUS · Ringkasan Eksekutif</p>
            <h2 class="text-heading break-words text-highlighted" data-testid="rk-title">
              {{ data.title }}
            </h2>
            <div class="flex flex-col gap-1 sm:flex-row sm:justify-between">
              <p class="text-body text-muted" data-testid="rk-subtitle">{{ data.subtitle }}</p>
              <p v-if="data.pupilsLine" class="text-body text-muted" data-testid="rk-pupils">
                {{ data.pupilsLine }}
              </p>
            </div>
            <p v-if="generated" class="text-body text-muted" data-testid="rk-generated">
              Dijana: {{ generated }}
            </p>
          </header>
          <RingkasanTiles :tally="data.tally" />
          <RingkasanDistribution :tally="data.tally" />
          <RingkasanKombo :kombo="data.kombo" />
          <RingkasanSubjects
            v-if="data.weakness && data.weakness.length > 0"
            :rows="data.weakness"
          />
          <footer class="flex flex-col gap-1 text-caption text-muted" data-testid="rk-footer">
            <p>
              Laporan ini dijana secara automatik oleh PRESTASIPLUS<template v-if="generated">
                · {{ generated }}</template
              >
            </p>
            <p>{{ FOOTER_LINE_2 }}</p>
          </footer>
        </article>
      </DsPrintSheet>

      <DsLoadError v-else-if="error" :message="errorMessage" testid="rk-error" @retry="reload" />
      <div v-else-if="loading" class="flex flex-col gap-4" aria-busy="true" data-testid="rk-loading">
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-64 w-full" />
        <USkeleton class="h-64 w-full" />
      </div>
    </template>
  </DsPage>
</template>
