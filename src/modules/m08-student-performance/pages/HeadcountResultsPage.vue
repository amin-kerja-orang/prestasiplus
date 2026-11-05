<script setup lang="ts">
/**
 * `/headcount/{id}/results/{n}` "Key-in AR — OTR{n}" (S10-T02; R1-GUR-3 Forms, AC-GUR-3-5, AC-GUR-3-14).
 * Manual configs only: an Auto config or a checkpoint outside 1…OTR Aktif is the 404 page. One AR input
 * per pupil (0-100, step 0.1, empty allowed), the read-only target of OTR{n} and the live status;
 * "Simpan" saves every row at once ("AR OTR{n} disimpan."), a value outside 0-100 shows
 * "Markah mesti antara 0 dan 100." and saves nothing.
 */
import type { TableColumn } from '@nuxt/ui'
import { useToast } from '@nuxt/ui/composables'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { PERFORMANCE_HEADCOUNT_MESSAGES } from '@pp/contract'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import {
  DsBackLink,
  DsDataTable,
  DsLoadError,
  DsPage,
  DsPageHeader,
  DsStack,
  DsStickyActions,
} from '@/ds'

import { fetchHeadcountDetail, saveHeadcountAr } from '../api/headcount'
import type { HeadcountDetail } from '../api/headcount-types'
import MarkInput from '../components/headcount/MarkInput.vue'
import { headcountActionError } from '../lib/headcount/error-text'
import { DASH, num0 } from '../lib/headcount/format'
import { bandOf, parseMark } from '../lib/headcount/otr'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'
import { routeId } from '../lib/route-id'

const route = useRoute()
const toast = useToast()
const id = computed(() => routeId(route.params.id))
const n = computed(() => Number(route.params.n))

const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountDetail(id.value, { signal }),
  [id],
)

const detail = ref<HeadcountDetail | null>(null)
const drafts = reactive<Record<string, string>>({})
const errors = reactive<Record<string, string>>({})
const formError = ref<string | null>(null)
const saving = ref(false)

/** Manual configs only; the checkpoint must exist (AC-GUR-3-5). */
const unavailable = computed(() => {
  const d = detail.value
  return d !== null && (d.config.mode !== 'manual' || !(n.value >= 1 && n.value <= d.config.activeOtrs))
})

function fill(d: HeadcountDetail): void {
  detail.value = d
  for (const k of Object.keys(errors)) delete errors[k]
  for (const r of d.rows) {
    const ar = r.cells[n.value - 1]?.ar ?? null
    drafts[String(r.userId)] = ar === null ? '' : String(ar)
  }
}
watch(
  [data, n],
  () => {
    if (data.value) fill(data.value)
  },
  { immediate: true },
)
watch(
  unavailable,
  (gone) => {
    if (gone) setRouteOutcome(404)
  },
  { immediate: true },
)

interface Row extends Record<string, unknown> {
  userId: number
  index: string
  name: string
  target: string
  status: string
  tone: string
}

const rows = computed<Row[]>(() => {
  const d = detail.value
  if (!d) return []
  return d.rows
    .filter((r) => !r.dropped)
    .map((r, i) => {
      const target = r.cells[n.value - 1]?.target ?? null
      const typed = parseMark(drafts[String(r.userId)])
      const band = typed.ok ? bandOf(typed.value, target) : 'na'
      return {
        userId: r.userId,
        index: String(i + 1),
        name: r.name,
        target: target === null ? DASH : num0(target),
        status: band === 'above' || band === 'on' ? 'On Track' : band === 'below' ? 'Below' : DASH,
        tone: band,
      }
    })
})

const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'ar', header: 'AR (%)' },
  { accessorKey: 'target', header: `Target OTR${String(n.value)}` },
  { accessorKey: 'status', header: 'Status' },
])

const subtitle = computed(() => {
  const c = detail.value?.config
  return c ? `${c.subject} · ${c.className} · ${c.levelName} · ${String(c.year)}` : ''
})

async function save(): Promise<void> {
  if (saving.value || !detail.value) return
  formError.value = null
  for (const k of Object.keys(errors)) delete errors[k]
  const marks: { userId: number; value: number | null }[] = []
  for (const r of rows.value) {
    const typed = parseMark(drafts[String(r.userId)])
    if (typed.ok) marks.push({ userId: r.userId, value: typed.value })
    else errors[String(r.userId)] = typed.error
  }
  if (Object.keys(errors).length > 0) return
  saving.value = true
  try {
    fill(await saveHeadcountAr(id.value, { checkpoint: n.value, marks }))
    toast.add({ title: PERFORMANCE_HEADCOUNT_MESSAGES.saved.ar(n.value), color: 'success' })
  } catch (err) {
    if (isApiError(err) && err.status === 404) setRouteOutcome(404)
    else if (isApiError(err) && err.fields !== undefined && Object.keys(err.fields).length > 0)
      formError.value = [...new Set(Object.values(err.fields))].join(' ')
    else formError.value = headcountActionError(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage data-testid="headcount-results-page">
    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="detail && !unavailable">
      <DsPageHeader :title="`Key-in AR — OTR${String(n)}`" :subtitle="subtitle" subtitle-testid="results-subtitle">
        <template #breadcrumb>
          <DsBackLink :to="`/headcount/${String(id)}`" label="Kembali" data-testid="back-link" />
        </template>
      </DsPageHeader>

      <UAlert
        v-if="formError"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        :title="formError"
        role="alert"
        data-testid="form-error"
      />

      <form novalidate data-testid="results-form" @submit.prevent="save">
        <DsDataTable
          :data="rows"
          :columns="columns"
          caption="Key-in AR"
          :page-size="Math.max(1, rows.length)"
          pager="none"
          empty-title="Belum ada murid dalam kelas ini."
          data-testid="results-table"
        >
          <template #ar-cell="{ row }">
            <MarkInput
              v-model="drafts[String(row.original.userId)]"
              :label="`AR (%) ${row.original.name}`"
              :error="errors[String(row.original.userId)]"
              :data-testid="`ar-input-${String(row.original.userId)}`"
            />
          </template>
          <template #status-cell="{ row }">
            <span :data-testid="`status-${String(row.original.userId)}`" :data-tone="row.original.tone">{{
              row.original.status
            }}</span>
          </template>
        </DsDataTable>

        <DsStickyActions>
          <UButton
            type="submit"
            size="lg"
            icon="i-ph-floppy-disk"
            label="Simpan"
            :loading="saving"
            data-testid="save"
          />
          <UButton
            :to="`/headcount/${String(id)}`"
            color="neutral"
            variant="ghost"
            size="lg"
            label="Batal"
            data-testid="cancel"
          />
        </DsStickyActions>
      </form>
    </template>
    <DsStack v-else-if="!error && !unavailable" gap="lg" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
