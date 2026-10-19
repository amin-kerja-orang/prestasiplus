<script setup lang="ts">
/**
 * `/__ds/matrix` (v2-ds-hardening section 5), Wave 1 API slice: every changed `Ds*` component with
 * its variant axes by its states, one theme per screenshot (`?theme=staff-light|staff-dark|
 * learner-light|learner-dark`, default = all four). Each cell carries `data-matrix-cell`.
 * Hover / focus-visible / active are pseudo-states: the Playwright run in T-M forces them; this
 * page covers every state that a prop or an attribute can show. Sample copy is BM, names are fictitious.
 */
import { computed, ref } from 'vue'

import { useRoute } from 'vue-router'

import {
  DsCharacterCard,
  DsChart,
  DsDataTable,
  DsDialog,
  DsDrillTable,
  DsEmptyState,
  DsFeedbackSheet,
  DsFilterBar,
  DsFormField,
  DsGameTile,
  DsBadgeTile,
  DsHeatGrid,
  DsIconChip,
  DsLoadError,
  DsMediaCard,
  DsNativeSelect,
  DsPillNav,
  DsQuizOption,
  DsScoreRing,
  DsShopCard,
  DsStatRow,
  DsStatTile,
  DsStatusBadge,
  DsThemeScope,
  DsWinHero,
} from '@/ds'
import type { DsAccent } from '@/ds'
import type { Personality, Scheme } from '@/theme/color-mode'
import { uiLocale } from '@/theme/locale-ms'

interface Panel {
  id: string
  personality: Personality
  scheme: Scheme
  title: string
}
const ALL: Panel[] = [
  { id: 'staff-light', personality: 'staff', scheme: 'light', title: 'Staf, cerah' },
  { id: 'staff-dark', personality: 'staff', scheme: 'dark', title: 'Staf, gelap' },
  { id: 'learner-light', personality: 'learner', scheme: 'light', title: 'Murid, cerah' },
  { id: 'learner-dark', personality: 'learner', scheme: 'dark', title: 'Murid, gelap' },
]
const route = useRoute()
const panels = computed(() => {
  const t = route.query.theme
  return ALL.filter((p) => !t || p.id === t)
})

const pill = ref<'a' | 'b' | 'c'>('a')
const pillItems = [
  { key: 'a' as const, label: 'Semua', icon: 'squares-four' },
  { key: 'b' as const, label: 'Aktif', icon: 'check' },
  { key: 'c' as const, label: 'Digantung', icon: 'clock', disabled: true },
]
const selectItems = [
  { label: 'Tingkatan 4', value: '4' },
  { label: 'Tingkatan 5', value: '5' },
]
const select = ref('4')
const accents: DsAccent[] = ['action', 'win', 'heat', 'friend', 'trial']
const dialog = ref<'' | 'sm' | 'md' | 'lg' | 'error' | 'loading'>('')
const tableCols = [
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'mark', header: 'Markah' },
]
const tableRows = [
  { name: 'Murid Contoh A', mark: 82 },
  { name: 'Murid Contoh B', mark: 67 },
]
const heatRows = [{ id: 'r1', label: 'Matematik', cells: [20, 55, null, 90] }]
const chartSeries = [{ label: 'Murid', data: [12, 18, 9] }]
</script>

<template>
  <UApp :locale="uiLocale">
    <main class="flex min-w-0 flex-col gap-4 bg-muted p-4 text-default md:p-8" data-testid="ds-matrix">
      <h1 class="text-title">Matriks keadaan (/__ds/matrix)</h1>
      <div class="grid min-w-0 grid-cols-1 gap-4" :class="panels.length > 1 ? 'xl:grid-cols-2' : ''">
        <DsThemeScope
          v-for="p in panels"
          :key="p.id"
          :personality="p.personality"
          :scheme="p.scheme"
          :data-testid="`matrix-${p.id}`"
        >
          <h2 class="mb-4 text-heading">{{ p.title }}</h2>
          <div class="flex min-w-0 flex-col gap-8">
            <!-- DsStatTile -->
            <section data-matrix-section="DsStatTile" class="flex flex-col gap-3">
              <h3 class="text-subheading">DsStatTile</h3>
              <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div data-matrix-cell="DsStatTile/default/default">
                  <DsStatTile value="128" unit="Murid" icon="student" sub="Tahun ini" />
                </div>
                <div data-matrix-cell="DsStatTile/valueTone/success">
                  <DsStatTile value="94%" unit="Lulus" icon="check" value-tone="success" tone="success" />
                </div>
                <div data-matrix-cell="DsStatTile/valueTone/error">
                  <DsStatTile value="7" unit="Berisiko" icon="warning-circle" value-tone="error" tone="error" />
                </div>
                <div data-matrix-cell="DsStatTile/valueTone/primary">
                  <DsStatTile value="31" unit="Kelas" icon="books" value-tone="primary" />
                </div>
                <div data-matrix-cell="DsStatTile/density/compact">
                  <DsStatTile value="128" unit="Murid" icon="student" density="compact" />
                </div>
                <div data-matrix-cell="DsStatTile/density/roomy">
                  <DsStatTile value="128" unit="Murid" icon="student" density="roomy" />
                </div>
                <div data-matrix-cell="DsStatTile/state/selected">
                  <DsStatTile value="128" unit="Murid" icon="student" selected clickable />
                </div>
                <div data-matrix-cell="DsStatTile/state/disabled">
                  <DsStatTile value="128" unit="Murid" icon="student" disabled clickable />
                </div>
                <div data-matrix-cell="DsStatTile/state/error">
                  <DsStatTile value="--" unit="Murid" icon="student" error />
                </div>
                <div data-matrix-cell="DsStatTile/state/loading">
                  <DsStatTile value="0" unit="Murid" loading />
                </div>
                <div data-matrix-cell="DsStatTile/state/clickable">
                  <DsStatTile value="128" unit="Murid" icon="student" clickable />
                </div>
                <div data-matrix-cell="DsStatTile/compact/error">
                  <DsStatTile value="--" unit="Murid" icon="student" density="compact" error />
                </div>
              </div>
              <div data-matrix-cell="DsStatRow/default/active">
                <DsStatRow
                  :items="[
                    { key: 'a', label: 'Semua', value: 120, icon: 'student', active: true },
                    { key: 'b', label: 'Aktif', value: 98, icon: 'check', valueTone: 'success' },
                    { key: 'c', label: 'Digantung', value: 3, icon: 'clock', disabled: true },
                  ]"
                />
              </div>
            </section>

            <!-- DsPillNav -->
            <section data-matrix-section="DsPillNav" class="flex flex-col gap-3">
              <h3 class="text-subheading">DsPillNav</h3>
              <div data-matrix-cell="DsPillNav/md/default-selected-disabled">
                <DsPillNav :items="pillItems" :active="pill" label="Status" @select="pill = $event" />
              </div>
              <div data-matrix-cell="DsPillNav/lg/default">
                <DsPillNav :items="pillItems" :active="pill" label="Status lg" size="lg" @select="pill = $event" />
              </div>
            </section>

            <!-- DsNativeSelect + DsFormField -->
            <section data-matrix-section="DsNativeSelect" class="flex flex-col gap-3">
              <h3 class="text-subheading">DsNativeSelect / DsFormField</h3>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div data-matrix-cell="DsNativeSelect/md/default"><DsNativeSelect v-model="select" :items="selectItems" blank /></div>
                <div data-matrix-cell="DsNativeSelect/lg/default"><DsNativeSelect v-model="select" :items="selectItems" size="lg" /></div>
                <div data-matrix-cell="DsNativeSelect/md/invalid"><DsNativeSelect v-model="select" :items="selectItems" invalid /></div>
                <div data-matrix-cell="DsNativeSelect/md/disabled"><DsNativeSelect v-model="select" :items="selectItems" disabled /></div>
                <div data-matrix-cell="DsNativeSelect/md/read-only"><DsNativeSelect v-model="select" :items="selectItems" readonly /></div>
                <div data-matrix-cell="DsNativeSelect/md/loading"><DsNativeSelect v-model="select" :items="selectItems" loading /></div>
                <DsFormField label="Tingkatan" native readonly data-matrix-cell="DsFormField/native/read-only">
                  <template #default="{ id, readonly }">
                    <DsNativeSelect :id="id" v-model="select" :items="selectItems" :readonly="readonly" />
                  </template>
                </DsFormField>
                <div data-matrix-cell="DsFormField/native/loading">
                  <DsFormField label="Tingkatan" native loading><span /></DsFormField>
                </div>
                <div data-matrix-cell="DsFormField/native/error">
                  <DsFormField label="Tingkatan" native error="Sila pilih tingkatan.">
                    <template #default="{ id, invalid }">
                      <DsNativeSelect :id="id" v-model="select" :items="selectItems" :invalid="invalid" />
                    </template>
                  </DsFormField>
                </div>
              </div>
            </section>

            <!-- DsChart -->
            <section data-matrix-section="DsChart" class="flex flex-col gap-3">
              <h3 class="text-subheading">DsChart</h3>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div data-matrix-cell="DsChart/sm/ready">
                  <DsChart title="Markah" :labels="['Jan', 'Feb', 'Mac']" :series="chartSeries" height="sm" />
                </div>
                <div data-matrix-cell="DsChart/sm/loading">
                  <DsChart title="Markah" :labels="[]" :series="[]" height="sm" loading />
                </div>
                <div data-matrix-cell="DsChart/sm/empty">
                  <DsChart title="Markah" :labels="[]" :series="[]" height="sm" />
                </div>
                <div data-matrix-cell="DsChart/sm/error">
                  <DsChart title="Markah" :labels="[]" :series="[]" height="sm" error />
                </div>
              </div>
            </section>

            <!-- DsDialog -->
            <section data-matrix-section="DsDialog" class="flex flex-col gap-3">
              <h3 class="text-subheading">DsDialog</h3>
              <div class="flex flex-wrap gap-2" data-matrix-cell="DsDialog/size-tone/closed">
                <UButton v-for="k in ['sm', 'md', 'lg', 'error', 'loading'] as const" :key="k" color="neutral" variant="soft" :label="`Buka ${k}`" @click="dialog = k" />
              </div>
              <DsDialog
                :open="dialog !== ''"
                title="Padam rekod?"
                description="Tindakan ini tidak boleh dibatalkan."
                :size="dialog === 'sm' || dialog === 'lg' ? dialog : 'md'"
                :tone="dialog === 'error' ? 'error' : 'default'"
                :loading="dialog === 'loading'"
                @update:open="dialog = ''"
              >
                <p class="text-body">Contoh kandungan dialog.</p>
                <template #footer>
                  <UButton color="neutral" variant="ghost" label="Batal" @click="dialog = ''" />
                  <UButton :color="dialog === 'error' ? 'error' : 'primary'" :loading="dialog === 'loading'" label="Ya" @click="dialog = ''" />
                </template>
              </DsDialog>
            </section>

            <!-- Learner -->
            <section data-matrix-section="DsQuizOption" class="flex flex-col gap-3">
              <h3 class="text-subheading">DsQuizOption / DsScoreRing</h3>
              <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
                <div v-for="s in ['idle', 'selected', 'correct', 'wrong', 'dimmed'] as const" :key="s" :data-matrix-cell="`DsQuizOption/state/${s}`">
                  <DsQuizOption letter="A" :state="s">Jawapan {{ s }}</DsQuizOption>
                </div>
                <div data-matrix-cell="DsQuizOption/state/disabled">
                  <DsQuizOption letter="B" disabled>Jawapan disabled</DsQuizOption>
                </div>
              </div>
              <div class="flex flex-wrap items-center gap-4">
                <div v-for="a in ['action', 'win'] as const" :key="a" :data-matrix-cell="`DsScoreRing/accent/${a}`">
                  <DsScoreRing :value="72" :accent="a" label="Skor" />
                </div>
                <UButton as="div" color="primary" variant="solid" class="h-auto p-3" data-matrix-cell="DsScoreRing/inverted/true">
                  <DsScoreRing :value="72" inverted label="Skor" />
                </UButton>
              </div>
            </section>

            <section data-matrix-section="DsCharacterCard" class="flex flex-col gap-3">
              <h3 class="text-subheading">DsCharacterCard / DsGameTile / DsBadgeTile / DsMediaCard</h3>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div v-for="a in accents" :key="a" :data-matrix-cell="`DsCharacterCard/accent/${a}`">
                  <DsCharacterCard :accent="a" title="Cabaran" description="Selesaikan hari ini" icon="fire" cta-label="Mula" />
                </div>
                <div data-matrix-cell="DsGameTile/default/default"><DsGameTile name="Betul Salah" mode="Solo" /></div>
                <div data-matrix-cell="DsGameTile/state/disabled"><DsGameTile name="Betul Salah" mode="Solo" disabled /></div>
                <div data-matrix-cell="DsGameTile/state/loading"><DsGameTile name="Betul Salah" mode="Solo" loading /></div>
                <div data-matrix-cell="DsBadgeTile/state/locked"><DsBadgeTile state="locked" title="Pelari Pantas" /></div>
                <div data-matrix-cell="DsBadgeTile/state/progress"><DsBadgeTile state="progress" title="Pelari Pantas" :progress="40" /></div>
                <div data-matrix-cell="DsMediaCard/kind/article"><DsMediaCard kind="article" title="Tip belajar" /></div>
                <div data-matrix-cell="DsMediaCard/kind/audio"><DsMediaCard kind="audio" title="Podcast" duration="5:00" /></div>
                <div data-matrix-cell="DsMediaCard/kind/video"><DsMediaCard kind="video" title="Video" duration="3:10" /></div>
                <div data-matrix-cell="DsShopCard/state/loading"><DsShopCard name="Topi" :price="120" action-label="Tebus" loading /></div>
                <div data-matrix-cell="DsShopCard/state/selected"><DsShopCard name="Topi" :price="120" action-label="Tebus" selected /></div>
              </div>
              <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div data-matrix-cell="DsFeedbackSheet/tone/success"><DsFeedbackSheet tone="success" title="Betul!" body="Tepat sekali." continue-label="Seterusnya" /></div>
                <div data-matrix-cell="DsFeedbackSheet/tone/error"><DsFeedbackSheet tone="error" title="Belum tepat" body="Cuba lagi." continue-label="Seterusnya" /></div>
                <div data-matrix-cell="DsWinHero/accent/win"><DsWinHero art="trophy" accent="win" title="Hebat!" /></div>
                <div data-matrix-cell="DsWinHero/accent/action"><DsWinHero art="books" accent="action" title="Teruskan" /></div>
              </div>
            </section>

            <!-- Data -->
            <section data-matrix-section="DsDataTable" class="flex flex-col gap-3">
              <h3 class="text-subheading">DsDataTable / DsDrillTable / DsHeatGrid / DsFilterBar / badges</h3>
              <div v-for="d in ['cozy', 'tight', 'compact'] as const" :key="d" :data-matrix-cell="`DsDataTable/density/${d}`">
                <DsDataTable :data="tableRows" :columns="tableCols" :density="d" :caption="`Murid ${d}`" />
              </div>
              <div data-matrix-cell="DsDrillTable/state/error">
                <DsDrillTable :data="[]" :columns="tableCols" error caption="Pemantauan" />
              </div>
              <div data-matrix-cell="DsHeatGrid/state/loading">
                <DsHeatGrid :columns="['A', 'B', 'C', 'D']" :rows="heatRows" label="Peta haba" loading />
              </div>
              <div data-matrix-cell="DsHeatGrid/state/ready">
                <DsHeatGrid :columns="['A', 'B', 'C', 'D']" :rows="heatRows" label="Peta haba" />
              </div>
              <div v-for="s in ['panel', 'plain'] as const" :key="s" :data-matrix-cell="`DsFilterBar/surface/${s}`">
                <DsFilterBar :surface="s" :active-count="1" />
              </div>
              <div class="flex flex-wrap gap-3">
                <div data-matrix-cell="DsStatusBadge/emphasis/soft"><DsStatusBadge status="live" /></div>
                <div data-matrix-cell="DsStatusBadge/emphasis/strong"><DsStatusBadge status="live" emphasis="strong" /></div>
                <div data-matrix-cell="DsLoadError/variant/alert"><DsLoadError /></div>
                <div data-matrix-cell="DsLoadError/variant/inline"><DsLoadError variant="inline" /></div>
                <div data-matrix-cell="DsLoadError/state/loading"><DsLoadError variant="inline" loading /></div>
                <div data-matrix-cell="DsIconChip/tone/error"><DsIconChip icon="warning-circle" tone="error" /></div>
                <div data-matrix-cell="DsEmptyState/size/sm"><DsEmptyState size="sm" item="rekod" /></div>
              </div>
            </section>
          </div>
        </DsThemeScope>
      </div>
    </main>
  </UApp>
</template>
