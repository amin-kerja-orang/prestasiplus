<script setup lang="ts">
/**
 * S23 `/amaran/ringkasan-eksekutif` "Ringkasan Eksekutif" (design `docs/design/m18-amaran-summary.md` section 4;
 * M18 SRS #22, FR-M18-83 to 88). Roles: school_admin, teacher, admin. School admin and teacher: the own school;
 * the page ignores `scope`, `school_id` and the other URL params and calls `GET /api/amaran/summary` with no
 * query. Admin (design section 8): `scope`, `district`, `state` and the school id (`school_id` or `schoolId`)
 * are read from the URL and sent; without `scope` the API answers 403 (in-place 403 page, DV-M18-49); for
 * district / state the card "Pecahan Mengikut Sekolah" (`schools[]`) replaces the subject card.
 * Outside the print sheet: "Kembali" (S4 for the school admin, `/guru` teacher, `/admin` admin) and
 * "Cetak / PDF" (`window.print`). Inside the sheet (light scheme): head, four tiles, "Taburan Risiko", kombo
 * figures, the subject card (only with rows) or the school card, and the footer.
 *
 * States: loading skeleton; 403 and 404 render the global page in place; any other failure shows the server's
 * message with "Cuba Semula".
 */
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import {
  DsBackLink,
  DsCluster,
  DsHeading,
  DsLoadError,
  DsPage,
  DsPrintSheet,
  DsStack,
  DsText,
} from '@/ds'

import { fetchAmaranSummary } from '../api/amaran'
import RingkasanDistribution from '../components/ringkasan/RingkasanDistribution.vue'
import RingkasanKombo from '../components/ringkasan/RingkasanKombo.vue'
import RingkasanSchools from '../components/ringkasan/RingkasanSchools.vue'
import RingkasanSubjects from '../components/ringkasan/RingkasanSubjects.vue'
import RingkasanTiles from '../components/ringkasan/RingkasanTiles.vue'
import {
  FOOTER_LINE_2,
  formatGenerated,
  tabTitle,
  TITLE,
} from '../components/ringkasan/ringkasan-format'
import { loadErrorMessage } from '../lib/load-error'
import { adminSummaryQuery, useReportViewer } from '../lib/viewer'

const pageMeta = usePageMeta()

const route = useRoute()
const { isAdmin, backPath } = useReportViewer()
// Reactive: moving between `?scope=` values on this route reuses the component and must refetch.
const query = computed(() => (isAdmin.value ? adminSummaryQuery(route.query) : {}))
const queryKey = computed(() => JSON.stringify(query.value))

const { data, error, loading, reload } = useApi(
  (signal) => fetchAmaranSummary({ ...query.value, signal }),
  queryKey,
)

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
const errorMessage = computed(() => loadErrorMessage(error.value))

function print(): void {
  window.print()
}
</script>

<template>
  <DsPage data-testid="rk-page">
    <template v-if="!refused">
      <DsCluster
        v-if="!error"
        stack-below="sm"
        justify="between"
        gap="xs"
        class="print:hidden"
        data-testid="rk-toolbar"
      >
        <DsBackLink :to="backPath" data-testid="rk-back" />
        <div class="w-full sm:w-auto">
          <UButton
            type="button"
            icon="i-ph-printer"
            label="Cetak / PDF"
            size="lg"
            block
            class="min-h-11"
            :disabled="loading || !data"
            data-testid="rk-print"
            @click="print"
          />
        </div>
      </DsCluster>

      <DsPrintSheet v-if="data" data-testid="rk-sheet">
        <DsStack as="article" gap="md" padding="sm" aria-label="Ringkasan Eksekutif">
          <DsStack as="header" gap="2xs" data-testid="rk-head">
            <DsText variant="caption">PRESTASIPLUS · Ringkasan Eksekutif</DsText>
            <DsHeading :level="2" variant="heading" wrap="anywhere" data-testid="rk-title">
              {{ data.title }}
            </DsHeading>
            <DsCluster v-if="data.subtitle || data.pupilsLine" stack-below="sm" justify="between" align="start" gap="2xs">
              <DsText v-if="data.subtitle" variant="body" tone="muted" data-testid="rk-subtitle">{{
                data.subtitle
              }}</DsText>
              <DsText v-if="data.pupilsLine" variant="body" tone="muted" data-testid="rk-pupils">
                {{ data.pupilsLine }}
              </DsText>
            </DsCluster>
            <DsText v-if="generated" variant="body" tone="muted" data-testid="rk-generated">
              Dijana: {{ generated }}
            </DsText>
          </DsStack>
          <RingkasanTiles :tally="data.tally" />
          <RingkasanDistribution :tally="data.tally" />
          <RingkasanKombo :kombo="data.kombo" />
          <RingkasanSchools v-if="isAdmin && data.schools && data.schools.length > 0" :rows="data.schools" />
          <RingkasanSubjects
            v-else-if="data.weakness && data.weakness.length > 0"
            :rows="data.weakness"
          />
          <DsStack as="footer" gap="2xs" data-testid="rk-footer">
            <DsText variant="caption">
              Laporan ini dijana secara automatik oleh PRESTASIPLUS<template v-if="generated">
                · {{ generated }}</template
              >
            </DsText>
            <DsText variant="caption">{{ FOOTER_LINE_2 }}</DsText>
          </DsStack>
        </DsStack>
      </DsPrintSheet>

      <DsLoadError v-else-if="error" :message="errorMessage" testid="rk-error" @retry="reload" />
      <DsStack v-else-if="loading" gap="md" aria-busy="true" data-testid="rk-loading">
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-64 w-full" />
        <USkeleton class="h-64 w-full" />
      </DsStack>
    </template>
  </DsPage>
</template>
