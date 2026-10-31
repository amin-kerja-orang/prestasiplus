<script setup lang="ts">
/**
 * K1: Senarai Kontrak Blueprint (`/admin/spm/kontrak`, design 3). One contract per subject and
 * kertas; Jana Kertas reads it. "Tambah Kontrak" opens an empty Draf in the editor.
 */
import type { BijakBlueprintView } from '@pp/contract'
import type { TableColumn } from '@nuxt/ui'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import {
  DsDataTable,
  DsDialog,
  DsFilterBar,
  DsFormField,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsRowActions,
  DsStatRow,
  type RowAction,
  type StatItem,
} from '@/ds'

import { formatDateTime } from '../../../lib/use-bijak'
import SourceBadge from '../components/SourceBadge.vue'
import SharedBanner from '../components/SharedBanner.vue'
import { KONTRAK_ROUTES } from '../server/api'
import { kontrakServer } from '../server/client'
import { bodyName } from '../domain/verify'

type Row = BijakBlueprintView & {
  title: string
  tempohMarkah: string
  bahagian: string
  pengesahan: string
} & Record<string, unknown>

const api = kontrakServer()
const router = useRouter()
/** V2 empty state (K10, cloud-student-mechanism 3.4); the create button is "Baharu" as there. */
const EMPTY_FIRST = 'Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang "Baharu" di atas.'
const flash = useFlash()
const { data, error, loading, reload } = useApi(() => api.list())

const draft = reactive({ q: '', subject: '', kertas: '', source: '' })
const applied = ref({ ...draft })
const apply = (): void => {
  applied.value = { ...draft }
}
const reset = (): void => {
  Object.assign(draft, { q: '', subject: '', kertas: '', source: '' })
  apply()
}

function pengesahanOf(v: BijakBlueprintView): string {
  if (v.verification) {
    const d = formatDateTime(Date.parse(v.verification.verifiedAt))
    return `Admin Pusat - ${d} (${v.verification.bodies.length} badan: ${v.verification.bodies.map(bodyName).join(', ')})`
  }
  return v.evidenceCount ? `${v.evidenceCount} bukti` : '-'
}

const all = computed<Row[]>(() =>
  (data.value ?? []).map(
    (v): Row =>
      ({
        ...v,
        title: `${v.subjectName} - Kertas ${v.kertas}`,
        tempohMarkah: `${v.durationMin} minit - ${v.totalMarks} markah`,
        bahagian: `${v.sections.length} (${v.sections.map((s) => s.label.replace(/^Bahagian\s+/i, '')).join(', ')})`,
        pengesahan: pengesahanOf(v),
      }),
  ),
)
const subjectItems = computed(() => {
  const seen = new Map<string, string>()
  for (const r of all.value) seen.set(r.subject, r.subjectName)
  return [...seen].map(([value, label]) => ({ value, label }))
})
const rows = computed(() => {
  const a = applied.value
  const needle = a.q.trim().toLowerCase()
  return all.value.filter(
    (r) =>
      (!a.subject || r.subject === a.subject) &&
      (!a.kertas || String(r.kertas) === a.kertas) &&
      (!a.source || r.source === a.source) &&
      (!needle || `${r.subjectName} ${r.code}`.toLowerCase().includes(needle)),
  )
})
const chips = computed(() => {
  const a = applied.value
  const out: { key: string; label: string }[] = []
  if (a.q.trim()) out.push({ key: 'q', label: `Cari: ${a.q.trim()}` })
  if (a.subject) out.push({ key: 'subject', label: subjectItems.value.find((s) => s.value === a.subject)?.label ?? a.subject })
  if (a.kertas) out.push({ key: 'kertas', label: `Kertas ${a.kertas}` })
  if (a.source) out.push({ key: 'source', label: a.source })
  return out
})
function removeChip(key: string): void {
  ;(draft as Record<string, string>)[key] = ''
  apply()
}

const stats = computed<StatItem[]>(() => [
  { key: 'all', label: 'Jumlah Kontrak', value: all.value.length, icon: 'scroll' },
  { key: 'disahkan', label: 'Disahkan', value: all.value.filter((r) => r.source === 'Disahkan').length, icon: 'check-circle', accent: 'win' },
  { key: 'spec', label: 'Spec', value: all.value.filter((r) => r.source === 'Spec').length, icon: 'warning' },
  { key: 'draf', label: 'Draf', value: all.value.filter((r) => r.source === 'Draf').length, icon: 'pencil-simple' },
])

const columns: TableColumn<Row>[] = [
  { accessorKey: 'title', header: 'Subjek', meta: { class: { th: 'w-[24%]' } } },
  { accessorKey: 'durationMin', header: 'Tempoh' },
  { accessorKey: 'totalMarks', header: 'Markah' },
  { accessorKey: 'bahagian', header: 'Bahagian' },
  { accessorKey: 'source', header: 'Status' },
  { accessorKey: 'pengesahan', header: 'Pengesahan' },
  { id: 'actions', header: 'Tindakan' },
]

const editTo = (r: { subject: string; kertas: number }) => ({
  name: KONTRAK_ROUTES.edit,
  params: { subjek: r.subject, kertas: String(r.kertas) },
})
const poolTo = (r: { subject: string; kertas: number }) => ({
  name: KONTRAK_ROUTES.pool,
  params: { subjek: r.subject, kertas: String(r.kertas) },
})

async function retire(r: Row): Promise<void> {
  try {
    await api.retire(r.subject, r.kertas)
    flash.show({ type: 'success', message: 'Kontrak dipadam.' })
    await reload()
  } catch (e) {
    flash.show({ type: 'error', message: e instanceof Error ? e.message : 'Kontrak tidak dapat dipadam.' })
  }
}
function blocked(r: Row): void {
  flash.show({
    type: 'error',
    message: `Tidak boleh dipadam: ${r.dependentPaperCount} kertas Terbit bergantung pada kontrak ini.`,
  })
}
function actionsOf(r: Row): RowAction[] {
  return [
    { label: 'Edit', icon: 'i-ph-pencil-simple', to: editTo(r), testid: `edit-${r.subject}-${r.kertas}` },
    { label: 'Pratonton Kolam', icon: 'i-ph-stack', to: poolTo(r), testid: `pool-${r.subject}-${r.kertas}` },
    {
      label: 'Padam',
      danger: true,
      icon: 'i-ph-trash',
      confirm: {
        title: 'Padam kontrak ini?',
        body: `Padam kontrak Kertas ${r.kertas} bagi ${r.subjectName}? Semua Bahagian kontrak turut dipadam. Ini menjejaskan pintu terbitan untuk SEMUA kertas subjek/kertas ini. Tindakan ini tidak boleh dibatalkan.`,
        confirmLabel: 'Padam',
      },
      onSelect: () => (r.dependentPaperCount > 0 ? blocked(r) : void retire(r)),
      testid: `retire-${r.subject}-${r.kertas}`,
    },
  ]
}

/* ------------------------------------------------------------------ Tambah Kontrak */
const addOpen = ref(false)
const subjects = ref<{ code: string; name: string }[]>([])
const add = reactive({ subject: '', kertas: '' })
const addTried = ref(false)
watch(addOpen, async (o) => {
  if (!o) return
  Object.assign(add, { subject: '', kertas: '' })
  addTried.value = false
  try {
    subjects.value = await api.subjectOptions()
  } catch {
    subjects.value = []
  }
})
const existing = computed(() =>
  all.value.find((r) => r.subject === add.subject && String(r.kertas) === add.kertas),
)
function proceed(): void {
  addTried.value = true
  if (!add.subject || !add.kertas || existing.value) return
  addOpen.value = false
  void router.push({ ...editTo({ subject: add.subject, kertas: Number(add.kertas) }), query: { baharu: '1' } })
}
</script>

<template>
  <DsPage
    layout="list"
    subtitle="Satu kontrak bagi setiap subjek dan kertas. Jana Kertas membaca kontrak ini."
    data-testid="kontrak-list"
  >
    <template #actions>
      <UButton icon="i-ph-plus" label="Baharu" class="min-h-11" data-testid="kontrak-add" @click="addOpen = true" />
    </template>

    <DsLoadError v-if="error" message="Tidak dapat memuatkan senarai kontrak. Sila cuba semula." @retry="reload()" />
    <template v-else>
      <SharedBanner scope="list" />
      <h2 class="text-heading text-highlighted" data-testid="kontrak-list-heading">Senarai Kontrak</h2>
      <DsStatRow :items="stats" density="roomy" :loading="loading && !data" aria-label="Ringkasan kontrak" />

      <DsFilterBar
        :chips="chips"
        :active-count="chips.length"
        data-testid="kontrak-filter"
        @apply="apply"
        @reset="reset"
        @remove-chip="removeChip"
      >
        <template #search>
          <UInput
            v-model="draft.q"
            type="text"
            aria-label="Cari subjek atau kod"
            placeholder="Cari subjek atau kod..."
            icon="i-ph-magnifying-glass"
            class="w-full md:min-w-64 md:flex-1"
            data-testid="kontrak-search"
          />
        </template>
        <DsNativeSelect v-model="draft.subject" aria-label="Subjek" class="md:w-44" data-testid="kontrak-subject">
          <option value="">Semua Subjek</option>
          <option v-for="s in subjectItems" :key="s.value" :value="s.value">{{ s.label }}</option>
        </DsNativeSelect>
        <DsNativeSelect v-model="draft.kertas" aria-label="Kertas" class="md:w-36" data-testid="kontrak-kertas">
          <option value="">Semua Kertas</option>
          <option value="1">Kertas 1</option>
          <option value="2">Kertas 2</option>
        </DsNativeSelect>
        <DsNativeSelect v-model="draft.source" aria-label="Status" class="md:w-40" data-testid="kontrak-status">
          <option value="">Semua Status</option>
          <option value="Draf">Draf</option>
          <option value="Spec">Spec</option>
          <option value="Disahkan">Disahkan</option>
        </DsNativeSelect>
      </DsFilterBar>

      <DsDataTable
        :data="rows"
        :columns="columns"
        caption="Senarai kontrak blueprint"
        variant="flush"
        layout="fixed"
        density="cozy"
        :loading="loading && !data"
        :filtered="chips.length > 0"
        :empty-title="chips.length ? 'Tiada kontrak dijumpai.' : EMPTY_FIRST"
        card-title="title"
        :card-fields="[
          { key: 'code', label: 'Kod' },
          { key: 'tempohMarkah', label: 'Tempoh / Markah' },
          { key: 'pengesahan', label: 'Pengesahan' },
        ]"
        :page-size="20"
        row-key="code"
        data-testid="kontrak-table"
        @row-click="(r: Row) => router.push(editTo(r))"
      >
        <template #title-cell="{ row }">
          <div class="flex min-w-0 flex-col">
            <span class="text-body break-words text-default">{{ row.original.subjectName }}</span>
            <span class="text-caption text-muted">Kertas {{ row.original.kertas }} - {{ row.original.code }}</span>
          </div>
        </template>
        <template #durationMin-cell="{ row }">{{ row.original.durationMin }} minit</template>
        <template #totalMarks-cell="{ row }"><span class="tabular">{{ row.original.totalMarks }}</span></template>
        <template #source-cell="{ row }">
          <div class="flex flex-col items-start gap-1">
            <SourceBadge :source="row.original.source" />
            <span class="text-caption text-muted">
              Versi {{ row.original.version }}<template v-if="row.original.servingVersion && row.original.servingVersion !== row.original.version"> - murid guna v{{ row.original.servingVersion }}</template>
            </span>
            <UBadge
              v-if="row.original.needsReview"
              color="warning"
              variant="subtle"
              icon="i-ph-warning-circle"
              label="Blueprint perlu disemak"
            />
          </div>
        </template>
        <template #pengesahan-cell="{ row }"><span class="text-body break-words">{{ row.original.pengesahan }}</span></template>
        <template #actions-cell="{ row }">
          <DsRowActions :actions="actionsOf(row.original)" :inline="2" />
        </template>
        <template #card="{ row }">
          <div class="flex min-w-0 flex-col gap-1" :data-testid="`kontrak-card-${String(row.subject)}-${String(row.kertas)}`">
            <UButton
              type="button"
              color="neutral"
              variant="link"
              class="h-auto justify-start p-0 text-start text-label whitespace-normal"
              :label="String(row.title)"
              @click="router.push(editTo(row as Row))"
            />
            <dl class="grid grid-cols-2 gap-x-3 gap-y-1">
              <div class="min-w-0">
                <dt class="text-caption text-muted">Kod</dt>
                <dd class="text-body break-words">{{ row.code }}</dd>
              </div>
              <div class="min-w-0">
                <dt class="text-caption text-muted">Tempoh / Markah</dt>
                <dd class="text-body">{{ row.tempohMarkah }}</dd>
              </div>
              <div class="col-span-2 min-w-0">
                <dt class="text-caption text-muted">Pengesahan</dt>
                <dd class="text-body break-words">{{ row.pengesahan }}</dd>
              </div>
            </dl>
            <div class="flex flex-wrap items-center gap-2">
              <SourceBadge :source="(row as Row).source" />
              <UBadge color="neutral" variant="subtle" :label="`Versi ${String(row.version)}`" />
            </div>
          </div>
        </template>
        <template #card-actions="{ row }">
          <DsRowActions :actions="actionsOf(row as Row)" :inline="2" />
        </template>
      </DsDataTable>
    </template>

    <DsDialog v-model:open="addOpen" title="Kontrak Baharu" size="sm">
      <form id="kontrak-add-form" class="flex flex-col gap-4" novalidate @submit.prevent="proceed">
        <DsFormField native for="add-subject" label="Subjek" required :error="addTried && !add.subject ? 'Pilih subjek.' : undefined">
          <template #default="f">
            <DsNativeSelect :id="f.id" v-model="add.subject" blank :invalid="f.invalid" data-testid="add-subject">
              <option v-for="s in subjects" :key="s.code" :value="s.code">{{ s.name }}</option>
            </DsNativeSelect>
          </template>
        </DsFormField>
        <DsFormField native for="add-kertas" label="Kertas" required :error="addTried && !add.kertas ? 'Pilih kertas.' : undefined">
          <template #default="f">
            <DsNativeSelect :id="f.id" v-model="add.kertas" blank :invalid="f.invalid" data-testid="add-kertas">
              <option value="1">Kertas 1</option>
              <option value="2">Kertas 2</option>
            </DsNativeSelect>
          </template>
        </DsFormField>
        <UAlert
          v-if="existing"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          role="alert"
          description="Kontrak untuk subjek dan kertas ini sudah wujud."
          :actions="[{ label: 'Buka kontrak', color: 'neutral', variant: 'soft', class: 'min-h-11', to: editTo(existing) }]"
          data-testid="add-exists"
        />
      </form>
      <template #footer>
        <UButton color="neutral" variant="soft" class="min-h-11" label="Batal" @click="addOpen = false" />
        <UButton type="submit" form="kontrak-add-form" class="min-h-11" label="Teruskan" data-testid="add-continue" />
      </template>
    </DsDialog>
  </DsPage>
</template>
