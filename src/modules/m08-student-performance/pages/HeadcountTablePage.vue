<script setup lang="ts">
/**
 * S23 `/headcount/{id}` "Headcount {Subjek}" (M08-T6; FR-M08-133…140, BR-M08-08 rule 2 / DV-29,
 * BR-M08-32). Header, chips, the action row, the sort links, the table and the selection bar with
 * "Gugurkan" / "Kembalikan". "Ya, Reset" clears the marks and reloads, "Ya, Padam" deletes the config
 * and opens `/headcount`; "Export CSV" downloads the table (all effects INFERRED, FR-M08-137, L-12).
 */
import { computed, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { isHttpMode } from '@/api/mode'
import { useClickOutside } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsBackLink, DsLoadError, DsPage, DsPageHeader, DsPanel, DsStatusBadge } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import {
  deleteHeadcount,
  downloadHeadcountCsv,
  dropHeadcountStudents,
  fetchHeadcountDetail,
  resetHeadcount,
} from '../api/headcount'
import type { DropAction, HeadcountSort } from '../api/headcount-types'
import HeadcountConfirmModals from '../components/headcount/HeadcountConfirmModals.vue'
import HeadcountTable from '../components/headcount/HeadcountTable.vue'
import { percentOf } from '../lib/headcount/format'
import { LOAD_ERROR, isLoadError, notFoundOutcome, useRouteData } from '../lib/prestasi/load'
import { routeId } from '../lib/route-id'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const id = computed(() => routeId(route.params.id))
/** An unknown `sort` is "ranking" (§5). */
const sort = computed<HeadcountSort>(() => (route.query.sort === 'name' ? 'name' : 'ranking'))

const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountDetail(id.value, { sort: sort.value, signal }),
  [id, sort],
)

watchEffect(() => {
  const d = data.value
  if (!d) return
  pageMeta.setTitle(`Headcount ${d.config.subject} - PRESTASIPLUS`)
  pageMeta.setHeader({ title: `Headcount ${d.config.subject}`, subtitle: 'Selamat datang kembali' })
})

const selected = ref<number[]>([])
const resetOpen = ref(false)
const deleteOpen = ref(false)
const busy = ref(false)
const actionError = ref<string | null>(null)

const keyInOpen = ref(false)
const keyInRoot = ref<HTMLElement | null>(null)
useClickOutside(keyInRoot, () => (keyInOpen.value = false), { enabled: keyInOpen })

const subtitle = computed(() => {
  const c = data.value?.config
  return c
    ? `${c.className} · ${c.levelName} · ${String(c.year)} · Guru: ${c.teacherName}`
    : ''
})

const chips = computed(() => {
  const c = data.value?.chips
  if (!c) return null
  return {
    on: `On Track: ${String(c.onTrack)} (${String(percentOf(c.onTrack, c.total))}%)`,
    below: `Below: ${String(c.below)} (${String(percentOf(c.below, c.total))}%)`,
    empty: `Belum Diisi: ${String(c.empty)}`,
    total: `Jumlah: ${String(c.total)}`,
  }
})

async function run(task: () => Promise<unknown>): Promise<boolean> {
  if (busy.value) return false
  busy.value = true
  actionError.value = null
  try {
    await task()
    return true
  } catch (err) {
    if (!notFoundOutcome(err)) actionError.value = LOAD_ERROR
    return false
  } finally {
    busy.value = false
  }
}

async function drop(action: DropAction) {
  // The real API takes string ids (BE-19 `studentIds`); mock mode keeps the numbers.
  const ids = isHttpMode() ? selected.value.map(String) : [...selected.value]
  if (ids.length === 0) return
  if (await run(() => dropHeadcountStudents(id.value, { action, studentIds: ids }))) {
    selected.value = []
    await reload()
  }
}

async function confirmReset() {
  if (await run(() => resetHeadcount(id.value))) {
    resetOpen.value = false
    selected.value = []
    await reload()
  }
}

async function confirmDelete() {
  if (await run(() => deleteHeadcount(id.value))) {
    deleteOpen.value = false
    await router.push('/headcount')
  }
}

async function exportCsv() {
  await run(async () => {
    const file = await downloadHeadcountCsv(id.value, { sort: sort.value })
    saveBlob(file.blob, file.filename ?? `headcount-${String(id.value)}.csv`)
  })
}

const exportHref = computed(
  () => `/headcount/${String(id.value)}/export${sort.value === 'name' ? '?sort=name' : ''}`,
)
</script>

<template>
  <DsPage data-testid="headcount-table-page">
    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <DsPageHeader :title="data.config.subject" :subtitle="subtitle" subtitle-testid="table-subtitle">
        <template #breadcrumb>
          <DsBackLink to="/headcount" label="Kembali" data-testid="back-link" />
        </template>
        <template #actions>
          <DsStatusBadge status="active" label="Active" data-testid="status-pill" />
        </template>
      </DsPageHeader>

      <div v-if="chips" class="flex flex-wrap gap-2" data-testid="chips">
        <UBadge
          color="success"
          variant="subtle"
          size="lg"
          icon="i-ph-check-circle"
          :label="chips.on"
          data-testid="chip-on"
        />
        <UBadge
          color="error"
          variant="subtle"
          size="lg"
          icon="i-ph-arrow-down"
          :label="chips.below"
          data-testid="chip-below"
        />
        <UBadge
          color="neutral"
          variant="subtle"
          size="lg"
          icon="i-ph-minus-circle"
          :label="chips.empty"
          data-testid="chip-empty"
        />
        <UBadge
          color="neutral"
          variant="subtle"
          size="lg"
          icon="i-ph-users"
          :label="chips.total"
          data-testid="chip-total"
        />
      </div>

      <div class="flex flex-wrap items-start gap-2" data-testid="actions">
        <div ref="keyInRoot" class="flex flex-col gap-2">
          <UButton
            type="button"
            size="lg"
            icon="i-ph-pencil-simple"
            trailing-icon="i-ph-caret-down"
            label="Key-in AR"
            :aria-expanded="keyInOpen"
            data-testid="action-key-in"
            @click="keyInOpen = !keyInOpen"
          />
          <DsPanel v-if="keyInOpen" data-testid="key-in-menu">
            <ul class="flex flex-wrap gap-2">
              <li v-for="n in data.config.activeOtrs" :key="n">
                <UButton
                  :to="`/headcount/${String(id)}/results/${String(n)}`"
                  color="neutral"
                  variant="soft"
                  size="lg"
                  :label="`OTR${String(n)}`"
                  :data-testid="`key-in-${String(n)}`"
                />
              </li>
            </ul>
          </DsPanel>
        </div>
        <UButton
          :to="`/headcount/${String(id)}/edit`"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-pencil-simple-line"
          label="Edit TOV/ETR"
          data-testid="action-edit"
        />
        <UButton
          :href="exportHref"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-download-simple"
          label="Export CSV"
          data-testid="action-export"
          @click.prevent="exportCsv"
        />
        <UButton
          :to="`/headcount/${String(id)}/summary`"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-chart-bar"
          label="Ringkasan Kelas"
          data-testid="action-summary"
        />
        <UButton
          :to="`/headcount/${String(id)}/unjuran`"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-trend-up"
          label="Unjuran"
          data-testid="action-unjuran"
        />
        <UButton
          :to="`/headcount/${String(id)}/settings`"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-gear"
          label="Tetapan"
          data-testid="action-settings"
        />
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="lg"
          icon="i-ph-arrow-counter-clockwise"
          label="Reset Data"
          data-testid="action-reset"
          @click="resetOpen = true"
        />
        <UButton
          type="button"
          color="error"
          variant="soft"
          size="lg"
          icon="i-ph-trash"
          label="Padam"
          data-testid="action-delete"
          @click="deleteOpen = true"
        />
      </div>

      <UAlert
        v-if="actionError"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        :title="actionError"
        role="alert"
        data-testid="action-error"
      />

      <div class="flex flex-wrap items-center gap-2" data-testid="sort-links">
        <span class="inline-flex items-center gap-1 text-label text-muted"
          ><UIcon name="i-ph-arrows-down-up" class="size-5" />Susun:</span
        >
        <UButton
          :to="{ path: `/headcount/${String(id)}`, query: { sort: 'ranking' } }"
          size="lg"
          :color="sort === 'ranking' ? 'primary' : 'neutral'"
          :variant="sort === 'ranking' ? 'solid' : 'soft'"
          :aria-current="sort === 'ranking' ? 'true' : undefined"
          icon="i-ph-trophy"
          label="Ranking"
          data-testid="sort-ranking"
        />
        <UButton
          :to="{ path: `/headcount/${String(id)}`, query: { sort: 'name' } }"
          size="lg"
          :color="sort === 'name' ? 'primary' : 'neutral'"
          :variant="sort === 'name' ? 'solid' : 'soft'"
          :aria-current="sort === 'name' ? 'true' : undefined"
          icon="i-ph-sort-ascending"
          label="A-Z"
          data-testid="sort-name"
        />
      </div>

      <DsPanel v-if="selected.length > 0" data-testid="selection-bar">
        <div class="flex flex-wrap items-center gap-3">
          <span class="inline-flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-check-square" class="size-5" /><span data-testid="selection-count">{{
              selected.length
            }}</span>
            murid dipilih
          </span>
          <div class="flex flex-wrap gap-2">
            <UButton
              type="button"
              size="lg"
              color="neutral"
              variant="soft"
              icon="i-ph-user-minus"
              label="Gugurkan"
              :disabled="busy"
              data-testid="drop-students"
              @click="drop('drop')"
            />
            <UButton
              type="button"
              size="lg"
              color="neutral"
              variant="soft"
              icon="i-ph-user-check"
              label="Kembalikan"
              :disabled="busy"
              data-testid="restore-students"
              @click="drop('restore')"
            />
            <UButton
              type="button"
              size="lg"
              color="neutral"
              variant="ghost"
              icon="i-ph-x"
              label="Batal"
              data-testid="selection-cancel"
              @click="selected = []"
            />
          </div>
        </div>
      </DsPanel>

      <div data-testid="table-card">
        <HeadcountTable v-model:selected="selected" :detail="data" />
      </div>

      <HeadcountConfirmModals
        v-model:reset-open="resetOpen"
        v-model:delete-open="deleteOpen"
        :subject="data.config.subject"
        :class-name="data.config.className"
        :year="data.config.year"
        :busy="busy"
        @confirm-reset="confirmReset"
        @confirm-delete="confirmDelete"
      />
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
