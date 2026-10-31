<script setup lang="ts">
/** Pembina Kertas (`/admin/spm/kertas`): the papers assembled by the admin, draft and published. */
import type { TableColumn } from '@nuxt/ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import { DsDataTable, DsLoadError, DsPage, DsStatRow, DsStatusBadge, type StatItem } from '@/ds'

import type { AdminPaperSummary } from '../../domain/admin-types'
import { formatDateTime } from '../../lib/use-bijak'
import StudentViewDrawer from '../builder/components/StudentViewDrawer.vue'
import { builderCopy as bt } from '../builder/domain/copy'
import { usePaperActions } from '../builder/lib/use-paper-actions'
import { BUILDER_PATH } from '../builder/server/api'
import { builderServer } from '../builder/server/client'
import { bijakAdminServer } from '../../server/client'
import { ADMIN_ROUTES, detailMessage } from './ui'

type Row = AdminPaperSummary & Record<string, unknown>

const server = bijakAdminServer()
const previewId = ref('')
const router = useRouter()
const flash = useFlash()
const { data, error, loading, reload } = useApi(() => server.listAdminPapers())
const rows = computed(() => (data.value ?? []) as Row[])

const stats = computed<StatItem[]>(() => [
  { key: 'all', label: 'Jumlah kertas', value: rows.value.length, icon: 'scroll' },
  {
    key: 'draf',
    label: 'Draf',
    value: rows.value.filter((r) => r.status === 'draf').length,
    icon: 'pencil-simple',
  },
  {
    key: 'terbit',
    label: 'Diterbitkan',
    value: rows.value.filter((r) => r.status === 'terbit').length,
    icon: 'upload-simple',
    accent: 'win',
  },
])

/** V2 lane list columns (R12, scope R1-21.2): Tajuk, Status, Perhatian, Tindakan. */
const columns: TableColumn<Row>[] = [
  { accessorKey: 'title', header: bt.listTitleCol },
  { accessorKey: 'status', header: bt.listStatusCol },
  { accessorKey: 'ok', header: bt.listAttentionCol },
  { id: 'actions', header: bt.listActionsCol },
]

/**
 * Perhatian text of a row. Seam: the servability lane list (t30 `GET /admin/servability/lanes/bijak-spm`,
 * `attentionCount` + reasons) replaces this once it is in base; until then it is derived from the summary.
 */
function attentionOf(row: Row): string {
  if (row.questionCount === 0) return bt.attnEmpty
  return row.ok ? '' : bt.attnIncomplete
}

const preview = usePaperActions({
  api: builderServer(),
  id: previewId,
  title: () => '',
  onChanged: () => {},
})
async function openPreview(row: Row): Promise<void> {
  previewId.value = row.id
  await preview.openStudentView()
}
async function copyRow(row: Row): Promise<void> {
  previewId.value = row.id
  await preview.copy()
}

function open(row: Row): void {
  void router.push({ name: ADMIN_ROUTES.paperEdit, params: { id: row.id } })
}

async function remove(row: Row): Promise<void> {
  try {
    await server.deletePaper(row.id)
    flash.show({ type: 'success', message: 'Kertas dipadam.' })
    await reload()
  } catch (e) {
    flash.show({ type: 'error', message: detailMessage(e) })
  }
}
</script>

<template>
  <DsPage layout="list" data-testid="papers-page">
    <template #subtitle>
      <p class="text-body text-muted">
        Bina kertas SPM mengikut blueprint dari bank soalan, kemudian terbitkan ke Bijak SPM.
      </p>
    </template>
    <template #actions>
      <UButton
        :to="BUILDER_PATH"
        color="neutral"
        variant="soft"
        icon="i-ph-hammer"
        label="Set Builder"
        class="min-h-11"
        data-testid="paper-set-builder"
      />
      <UButton
        icon="i-ph-plus"
        label="Kertas Baharu"
        class="min-h-11"
        :to="{ name: ADMIN_ROUTES.paperNew }"
        data-testid="paper-new"
      />
    </template>

    <DsStatRow :items="stats" density="compact" :cols="3" aria-label="Ringkasan kertas" />

    <DsLoadError v-if="error" message="Tidak dapat memuatkan senarai kertas." @retry="reload()" />
    <DsDataTable
      v-else
      :data="rows"
      :columns="columns"
      caption="Senarai kertas"
      variant="flush"
      density="compact"
      :loading="loading && !data"
      empty-title="Belum ada kertas"
      empty-description="Tekan Kertas Baharu untuk mula."
      card-title="title"
      :card-fields="[
        { key: 'subjectName', label: 'Subjek' },
        { key: 'marks', label: 'Markah' },
      ]"
      :page-size="20"
      row-key="id"
      data-testid="papers-table"
      @row-click="open"
    >
      <template #title-cell="{ row }">
        <div class="flex flex-col">
          <span class="text-body text-default">{{ row.original.title }}</span>
          <span class="text-caption text-muted"
            >{{ row.original.subjectName }} · {{ row.original.questionCount }} soalan ·
            {{ row.original.marks }} / {{ row.original.budget }} markah · {{ row.original.code }} · Kertas
            {{ row.original.kertas }}</span
          >
        </div>
      </template>
      <template #ok-cell="{ row }">
        <div class="flex flex-col items-start gap-1">
          <UBadge
            :color="row.original.ok ? 'success' : 'warning'"
            variant="subtle"
            :icon="row.original.ok ? 'i-ph-check-circle' : 'i-ph-warning'"
            :label="row.original.ok ? 'Sepadan' : 'Belum sepadan'"
          />
          <span v-if="attentionOf(row.original)" class="text-caption text-muted">{{
            attentionOf(row.original)
          }}</span>
        </div>
      </template>
      <template #status-cell="{ row }">
        <DsStatusBadge :status="row.original.status === 'terbit' ? 'published' : 'draft'" />
      </template>
      <template #card="{ row }">
        <div class="flex min-w-0 flex-col gap-1" :data-testid="`paper-card-${String(row.id)}`">
          <UButton
            type="button"
            color="neutral"
            variant="link"
            class="h-auto justify-start p-0 text-start text-label whitespace-normal"
            :label="String(row.title)"
            @click="open(row as Row)"
          />
          <span class="text-caption text-muted">{{ row.code }} · Kertas {{ row.kertas }}</span>
          <dl class="grid grid-cols-2 gap-x-3 gap-y-1">
            <div class="min-w-0">
              <dt class="text-caption text-muted">Subjek</dt>
              <dd class="text-body break-words">{{ row.subjectName }}</dd>
            </div>
            <div class="min-w-0">
              <dt class="text-caption text-muted">Markah</dt>
              <dd class="tabular text-body">{{ row.marks }} / {{ row.budget }}</dd>
            </div>
            <div class="col-span-2 min-w-0">
              <dt class="text-caption text-muted">Dikemas kini</dt>
              <dd class="text-body">{{ formatDateTime(row.updatedAt as number) }}</dd>
            </div>
          </dl>
          <div class="flex flex-wrap items-center gap-2">
            <DsStatusBadge :status="row.status === 'terbit' ? 'published' : 'draft'" />
            <UBadge
              :color="row.ok ? 'success' : 'warning'"
              variant="subtle"
              :icon="row.ok ? 'i-ph-check-circle' : 'i-ph-warning'"
              :label="row.ok ? 'Sepadan' : 'Belum sepadan'"
            />
          </div>
        </div>
      </template>
      <template #card-actions="{ row }">
        <div class="flex shrink-0 flex-col gap-1">
          <UButton
            size="sm"
            icon="i-ph-pencil-simple"
            :label="bt.edit"
            class="min-h-11"
            :to="{ name: ADMIN_ROUTES.paperEdit, params: { id: row.id } }"
            :data-testid="`paper-open-${String(row.id)}`"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-ph-eye"
            :label="bt.preview"
            class="min-h-11"
            :data-testid="`paper-preview-${String(row.id)}`"
            @click.stop="openPreview(row as Row)"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-ph-copy"
            :label="bt.copy"
            class="min-h-11"
            :data-testid="`paper-copy-${String(row.id)}`"
            @click.stop="copyRow(row as Row)"
          />
          <UButton
            v-if="row.status === 'draf'"
            size="sm"
            color="error"
            variant="ghost"
            icon="i-ph-trash"
            aria-label="Padam kertas"
            class="min-h-11 min-w-11"
            :data-testid="`paper-delete-${String(row.id)}`"
            @click.stop="remove(row as Row)"
          />
        </div>
      </template>
      <template #actions-cell="{ row }">
        <div class="flex flex-wrap gap-1">
          <UButton
            size="sm"
            icon="i-ph-pencil-simple"
            :label="bt.edit"
            class="min-h-11"
            :to="{ name: ADMIN_ROUTES.paperEdit, params: { id: row.original.id } }"
            :data-testid="`paper-open-${row.original.id}`"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-ph-eye"
            :label="bt.preview"
            class="min-h-11"
            :data-testid="`paper-preview-${row.original.id}`"
            @click.stop="openPreview(row.original)"
          />
          <UButton
            size="sm"
            color="neutral"
            variant="soft"
            icon="i-ph-copy"
            :label="bt.copy"
            class="min-h-11"
            :data-testid="`paper-copy-${row.original.id}`"
            @click.stop="copyRow(row.original)"
          />
          <UButton
            v-if="row.original.status === 'draf'"
            size="sm"
            color="error"
            variant="ghost"
            icon="i-ph-trash"
            aria-label="Padam kertas"
            class="min-h-11 min-w-11"
            @click.stop="remove(row.original)"
          />
        </div>
      </template>
    </DsDataTable>

    <StudentViewDrawer v-model:open="preview.viewOpen.value" :view="preview.view.value" :error="preview.viewError.value" />
  </DsPage>
</template>
