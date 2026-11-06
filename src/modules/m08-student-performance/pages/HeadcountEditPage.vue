<script setup lang="ts">
/**
 * `/headcount/{id}/edit` "Edit TOV/ETR" (S10-T02; R1-GUR-3 Forms, FR-GUR-3-12). Per pupil: TOV and ETR
 * (0-100, step 0.1), the computed OTR targets read-only (HC-2, "—" without TOV), RS (SPM Sebenar) and its
 * record date ("Direkodkan: …", not in the future). "Simpan" sends the changed fields of the changed
 * rows only, so a pupil that keeps the subject-card default keeps inheriting it. Toast "TOV/ETR disimpan.".
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
  DsText,
} from '@/ds'

import { fetchHeadcountDetail, saveHeadcountTov } from '../api/headcount'
import type { HeadcountDetail, SaveTovInput } from '../api/headcount-types'
import MarkInput from '../components/headcount/MarkInput.vue'
import { headcountActionError } from '../lib/headcount/error-text'
import { DASH, formatRecordedDate, num0, todayMyt } from '../lib/headcount/format'
import { otrTarget, parseMark } from '../lib/headcount/otr'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'
import { routeId } from '../lib/route-id'

const FUTURE_DATE = PERFORMANCE_HEADCOUNT_MESSAGES.rsDateFuture

const route = useRoute()
const toast = useToast()
const id = computed(() => routeId(route.params.id))

const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountDetail(id.value, { signal }),
  [id],
)

type Field = 'tov' | 'etr' | 'rs' | 'date'
const FIELDS: readonly Field[] = ['tov', 'etr', 'rs', 'date']

const detail = ref<HeadcountDetail | null>(null)
const drafts = reactive<Record<string, string>>({})
/** The loaded values, to send only what changed. */
let initial: Record<string, string> = {}
const errors = reactive<Record<string, string>>({})
const formError = ref<string | null>(null)
const saving = ref(false)

const keyOf = (userId: number, f: Field): string => `${String(userId)}:${f}`

function fill(d: HeadcountDetail): void {
  detail.value = d
  for (const k of Object.keys(errors)) delete errors[k]
  const next: Record<string, string> = {}
  for (const r of d.rows) {
    next[keyOf(r.userId, 'tov')] = r.tov === null ? '' : String(r.tov)
    next[keyOf(r.userId, 'etr')] = r.etr === null ? '' : String(r.etr)
    next[keyOf(r.userId, 'rs')] = r.rs === null ? '' : String(r.rs)
    next[keyOf(r.userId, 'date')] = r.rsRecordedAt ?? ''
  }
  initial = next
  Object.assign(drafts, next)
}
watch(
  data,
  (d) => {
    if (d) fill(d)
  },
  { immediate: true },
)

const otrCount = computed(() => detail.value?.config.activeOtrs ?? 0)

interface Row extends Record<string, unknown> {
  userId: number
  index: string
  name: string
  recorded: string
  hasRs: boolean
}

const rows = computed<Row[]>(() => {
  const d = detail.value
  if (!d) return []
  return d.rows
    .filter((r) => !r.dropped)
    .map((r, i) => ({
      userId: r.userId,
      index: String(i + 1),
      name: r.name,
      recorded: r.rsRecordedAt ? `Direkodkan: ${formatRecordedDate(r.rsRecordedAt)}` : '',
      hasRs: (drafts[keyOf(r.userId, 'rs')] ?? '').trim() !== '',
    }))
})

/** The live OTR{k} of a row from its typed TOV and ETR (a bad or empty value gives "—"). */
function targetText(userId: number, k: number): string {
  const tov = parseMark(drafts[keyOf(userId, 'tov')])
  const etr = parseMark(drafts[keyOf(userId, 'etr')])
  const t = tov.ok && etr.ok ? otrTarget(tov.value, etr.value, k, otrCount.value) : null
  return t === null ? DASH : num0(t)
}

const columns = computed<TableColumn<Row>[]>(() => [
  { accessorKey: 'index', header: '#' },
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'tov', header: 'TOV (%)' },
  { accessorKey: 'etr', header: 'ETR (%)' },
  ...Array.from({ length: otrCount.value }, (_, i) => ({
    accessorKey: `otr${String(i + 1)}`,
    header: `OTR${String(i + 1)}`,
  })),
  { accessorKey: 'rs', header: 'RS (SPM Sebenar)' },
  { accessorKey: 'date', header: 'Tarikh Rekod RS' },
])

const subtitle = computed(() => {
  const c = detail.value?.config
  return c ? `${c.subject} · ${c.className} · ${c.levelName} · ${String(c.year)}` : ''
})

async function save(): Promise<void> {
  if (saving.value || !detail.value) return
  formError.value = null
  for (const k of Object.keys(errors)) delete errors[k]
  const payload: SaveTovInput['rows'] = []
  for (const r of rows.value) {
    const out: SaveTovInput['rows'][number] = { userId: r.userId }
    let changed = false
    for (const f of FIELDS) {
      const key = keyOf(r.userId, f)
      const text = (drafts[key] ?? '').trim()
      if (text === (initial[key] ?? '').trim()) continue
      if (f === 'date') {
        if (text === '') continue
        if (text > todayMyt()) errors[key] = FUTURE_DATE
        else {
          out.rsRecordedAt = text
          changed = true
        }
        continue
      }
      const typed = parseMark(text)
      if (!typed.ok) {
        errors[key] = typed.error
        continue
      }
      out[f] = typed.value
      changed = true
    }
    if (changed) payload.push(out)
  }
  if (Object.keys(errors).length > 0) return
  saving.value = true
  try {
    if (payload.length > 0) fill(await saveHeadcountTov(id.value, { rows: payload }))
    toast.add({ title: PERFORMANCE_HEADCOUNT_MESSAGES.saved.tov, color: 'success' })
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
  <DsPage data-testid="headcount-edit-page">
    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="detail">
      <DsPageHeader title="Edit TOV/ETR" :subtitle="subtitle" subtitle-testid="edit-subtitle">
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

      <form novalidate data-testid="edit-form" @submit.prevent="save">
        <DsDataTable
          :data="rows"
          :columns="columns"
          caption="Edit TOV/ETR"
          :page-size="Math.max(1, rows.length)"
          pager="none"
          empty-title="Belum ada murid dalam kelas ini."
          data-testid="edit-table"
        >
          <template #tov-cell="{ row }">
            <MarkInput
              v-model="drafts[keyOf(row.original.userId, 'tov')]"
              :label="`TOV (%) ${row.original.name}`"
              :error="errors[keyOf(row.original.userId, 'tov')]"
              :data-testid="`tov-${String(row.original.userId)}`"
            />
          </template>
          <template #etr-cell="{ row }">
            <MarkInput
              v-model="drafts[keyOf(row.original.userId, 'etr')]"
              :label="`ETR (%) ${row.original.name}`"
              :error="errors[keyOf(row.original.userId, 'etr')]"
              :data-testid="`etr-${String(row.original.userId)}`"
            />
          </template>
          <template v-for="k in otrCount" :key="k" #[`otr${String(k)}-cell`]="{ row }">
            <span :data-testid="`otr${String(k)}-${String(row.original.userId)}`">{{
              targetText(row.original.userId, k)
            }}</span>
          </template>
          <template #rs-cell="{ row }">
            <MarkInput
              v-model="drafts[keyOf(row.original.userId, 'rs')]"
              :label="`RS (SPM Sebenar) ${row.original.name}`"
              :error="errors[keyOf(row.original.userId, 'rs')]"
              :data-testid="`rs-${String(row.original.userId)}`"
            />
          </template>
          <template #date-cell="{ row }">
            <DsStack v-if="row.original.hasRs" gap="2xs">
              <MarkInput
                v-model="drafts[keyOf(row.original.userId, 'date')]"
                type="date"
                :max="todayMyt()"
                :label="`Tarikh Rekod RS ${row.original.name}`"
                :error="errors[keyOf(row.original.userId, 'date')]"
                :data-testid="`date-${String(row.original.userId)}`"
              />
              <DsText
                v-if="row.original.recorded"
                as="span"
                variant="caption"
                tone="muted"
                :data-testid="`recorded-${String(row.original.userId)}`"
                >{{ row.original.recorded }}</DsText
              >
            </DsStack>
            <span v-else>{{ DASH }}</span>
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
    <DsStack v-else-if="!error" gap="lg" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
