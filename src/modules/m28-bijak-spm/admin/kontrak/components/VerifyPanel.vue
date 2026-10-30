<script setup lang="ts">
/**
 * Tab "Pengesahan" (design 4.5, US-39): status block, evidence list, evidence check table, the
 * Syarat Disahkan gates and the Sahkan block. Sahkan is never silently disabled (D-10): it is
 * `aria-disabled` with the reason written next to it, and the server re-checks and answers with
 * the full failure list (422 `details.check`).
 */
import type {
  BijakBlueprintVersionItem,
  BijakBlueprintView,
  BijakEvidenceInput,
  BijakEvidenceItem,
  BijakVerificationCheck,
  BijakVerificationState,
} from '@pp/contract'
import { computed, ref, watch } from 'vue'

import { useFlash } from '@/composables/useFlash'
import { DsDialog, DsFormField, DsLoadError, DsPanel, useConfirm } from '@/ds'
import { useSessionStore } from '@/stores/session'

import { formatDateTime } from '../../../lib/use-bijak'
import type { ContractForm } from '../domain/form'
import {
  PADANAN,
  bodyName,
  evidenceBodies,
  evidenceFieldLabel,
  evidenceStatements,
  evidenceSummary,
  formatValue,
  gateRows,
  groupLines,
  KIND_LABEL,
  type GateRow,
} from '../domain/verify'
import { KontrakError, type KontrakApi } from '../server/api'
import EvidenceDrawer from './EvidenceDrawer.vue'
import SourceBadge from './SourceBadge.vue'
import SumMeter from './SumMeter.vue'

const props = defineProps<{
  api: KontrakApi
  subject: string
  kertas: number
  subjectName: string
  view: BijakBlueprintView
  versions: BijakBlueprintVersionItem[]
  form: ContractForm
  dirty: boolean
  /** Bumped by the page after a save so the panel reloads its data. */
  reloadKey: number
}>()
const emit = defineEmits<{
  verified: [view: BijakBlueprintView]
  goto: [target: { section: number | null; part: string; target: string }]
}>()

const flash = useFlash()
const confirm = useConfirm()
const session = useSessionStore()

const state = ref<BijakVerificationState | null>(null)
const evidence = ref<BijakEvidenceItem[]>([])
const loadError = ref(false)
const checking = ref(false)
const checkedAt = ref<number | null>(null)

async function load(): Promise<void> {
  loadError.value = false
  try {
    const [st, ev] = await Promise.all([
      props.api.verification(props.subject, props.kertas),
      props.api.evidence(props.subject, props.kertas),
    ])
    state.value = st
    evidence.value = ev
    checkedAt.value = Date.now()
  } catch {
    loadError.value = true
  }
}
watch(() => [props.reloadKey, props.view.version], load, { immediate: true })

async function recheck(): Promise<void> {
  checking.value = true
  await load()
  checking.value = false
}

const locked = computed(() => props.view.source === 'Disahkan')
const serving = computed(() => props.versions.find((v) => v.servesStudents) ?? null)
const check = computed<BijakVerificationCheck | null>(() => state.value?.check ?? null)
const gates = computed<GateRow[]>(() => (check.value ? gateRows(check.value, props.form) : []))
const failing = computed(() => gates.value.filter((g) => !g.ok))
const lineGroups = computed(() => (check.value ? groupLines(check.value.lines, props.form) : []))
const bodyCount = computed(() => evidenceBodies(evidence.value))
const record = computed(() => state.value?.record ?? null)

/* ------------------------------------------------------------------------- evidence */
const drawer = ref(false)
const editing = ref<BijakEvidenceItem | null>(null)
const savingEvidence = ref(false)
const evidenceError = ref('')

function openAdd(): void {
  editing.value = null
  evidenceError.value = ''
  drawer.value = true
}
function openEdit(e: BijakEvidenceItem): void {
  editing.value = e
  evidenceError.value = ''
  drawer.value = true
}
async function saveEvidence(body: BijakEvidenceInput): Promise<void> {
  savingEvidence.value = true
  evidenceError.value = ''
  try {
    await props.api.addEvidence(props.subject, props.kertas, body)
    if (editing.value) await props.api.removeEvidence(props.subject, props.kertas, editing.value.id)
    drawer.value = false
    flash.show({ type: 'success', message: 'Bukti disimpan.' })
    await load()
  } catch (e) {
    evidenceError.value = e instanceof Error ? e.message : 'Bukti tidak dapat disimpan.'
  } finally {
    savingEvidence.value = false
  }
}
async function removeEvidence(e: BijakEvidenceItem): Promise<void> {
  const ok = await confirm({
    message: `Padam bukti ${bodyName(e.body)} ${e.year}?`,
    tone: 'error',
    confirmLabel: 'Padam',
  })
  if (!ok) return
  try {
    await props.api.removeEvidence(props.subject, props.kertas, e.id)
    await load()
  } catch (err) {
    flash.show({ type: 'error', message: err instanceof Error ? err.message : 'Bukti tidak dapat dipadam.' })
  }
}

/* ------------------------------------------------------------------------- sahkan */
const note = ref('')
const verifying = ref(false)
const dialog = ref(false)
const failure = ref<BijakVerificationCheck | null>(null)
const failureText = ref('')
const reasonId = 'sahkan-reason'

const verifierName = computed(() => session.user?.name ?? 'Admin Pusat')
const reason = computed(() => {
  if (props.dirty) return 'Simpan perubahan dahulu.'
  if (failing.value.length)
    return `Selesaikan ${failing.value.length} syarat di atas dahulu.`
  if (!note.value.trim()) return 'Isi nota pengesahan dahulu.'
  return ''
})
const failureRows = computed(() => (failure.value ? gateRows(failure.value, props.form).filter((g) => !g.ok) : []))

function press(): void {
  if (reason.value) {
    document.getElementById(reasonId)?.focus()
    return
  }
  dialog.value = true
}

async function sahkan(): Promise<void> {
  verifying.value = true
  failure.value = null
  failureText.value = ''
  try {
    const v = await props.api.verify(props.subject, props.kertas, note.value)
    dialog.value = false
    flash.show({ type: 'success', message: 'Kontrak berjaya disahkan.' })
    note.value = ''
    emit('verified', v)
  } catch (e) {
    dialog.value = false
    if (e instanceof KontrakError && e.kind === 'verification' && e.check) failure.value = e.check
    else failureText.value = e instanceof Error ? e.message : 'Kontrak tidak dapat disahkan.'
    await load()
  } finally {
    verifying.value = false
  }
}

const evidenceLabel = computed(() => evidence.value.filter((e) => e.origin === 'admin').map((e) => `${bodyName(e.body)} ${e.year}`).join(', ') || '-')
</script>

<template>
  <div class="flex min-w-0 flex-col gap-6" data-testid="verify-panel">
    <DsLoadError v-if="loadError" message="Tidak dapat memuatkan data pengesahan." @retry="load" />
    <template v-else>
      <DsPanel title="Status Pengesahan">
        <dl class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <dt class="text-caption text-muted">Status</dt>
            <dd class="mt-1 flex flex-wrap items-center gap-2">
              <SourceBadge :source="view.source" />
              <UBadge color="neutral" variant="subtle" :label="`Versi ${view.version}`" />
            </dd>
          </div>
          <div>
            <dt class="text-caption text-muted">Murid sedang guna</dt>
            <dd class="mt-1 text-body" data-testid="serving">
              <template v-if="serving">
                v{{ serving.version }} (Disahkan<template v-if="serving.verification">
                  oleh {{ serving.verification.verifierName }}, {{ formatDateTime(Date.parse(serving.verification.verifiedAt)) }}</template>)
              </template>
              <template v-else>Belum ada</template>
            </dd>
          </div>
          <div>
            <dt class="text-caption text-muted">Pengesah</dt>
            <dd class="mt-1 text-body">{{ record?.verifierName ?? '-' }}</dd>
          </div>
          <div>
            <dt class="text-caption text-muted">Tarikh</dt>
            <dd class="mt-1 text-body">{{ record ? formatDateTime(Date.parse(record.verifiedAt)) : '-' }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-caption text-muted">Nota</dt>
            <dd class="mt-1 text-body break-words">{{ record?.note ?? '-' }}</dd>
          </div>
        </dl>
      </DsPanel>

      <DsPanel title="Bukti Pengesahan">
        <template #actions>
          <UButton v-if="!locked" icon="i-ph-plus" class="min-h-11" label="Tambah Bukti" data-testid="evidence-add" @click="openAdd" />
          <p v-else class="flex items-center gap-1 text-caption text-muted" data-testid="evidence-locked">
            <UIcon name="i-ph-lock-simple" class="size-4" aria-hidden="true" />
            Rekod pengesahan tidak boleh diubah.
          </p>
        </template>
        <div class="flex flex-col gap-3">
          <SumMeter label="Badan berbeza dengan skema:" :value="bodyCount" :target="2" />
          <p v-if="!evidence.length" class="text-body text-muted" data-testid="evidence-empty">
            Belum ada bukti. Tambah kertas percubaan dan skema dari sekurang-kurangnya dua badan.
          </p>
          <ul v-else class="flex flex-col gap-2" data-testid="evidence-list">
            <li
              v-for="e in evidence"
              :key="e.id"
              class="flex min-w-0 flex-wrap items-center gap-3 rounded-md bg-elevated p-3"
              :data-testid="`evidence-${e.id}`"
            >
              <div class="min-w-0 flex-1 basis-56">
                <p class="text-label text-highlighted">
                  {{ bodyName(e.body) }} {{ e.year }}
                  <UBadge v-if="e.origin === 'study'" class="ms-1" color="info" variant="subtle" label="Kajian" />
                </p>
                <p class="text-caption text-muted">
                  {{ e.paperCode }} - {{ KIND_LABEL[e.kind] }} - {{ evidenceSummary(e) }}
                </p>
                <p v-if="e.origin === 'study'" class="text-caption text-muted">Dari kajian, belum disahkan oleh manusia</p>
              </div>
              <div v-if="!locked" class="flex gap-1">
                <UButton color="neutral" variant="soft" size="sm" class="min-h-11" icon="i-ph-pencil-simple" label="Edit" :aria-label="`Edit bukti ${bodyName(e.body)} ${e.year}`" @click="openEdit(e)" />
                <UButton color="error" variant="ghost" size="sm" class="min-h-11 min-w-11" icon="i-ph-trash" :aria-label="`Padam bukti ${bodyName(e.body)} ${e.year}`" @click="removeEvidence(e)" />
              </div>
            </li>
          </ul>
        </div>
      </DsPanel>

      <DsPanel title="Semakan Bukti">
        <template #actions>
          <UButton
            color="neutral"
            variant="soft"
            class="min-h-11"
            icon="i-ph-arrow-clockwise"
            :label="checking ? 'Menyemak...' : 'Semak Bukti'"
            :loading="checking"
            data-testid="recheck"
            @click="recheck"
          />
        </template>
        <div class="flex flex-col gap-3">
          <p v-if="!lineGroups.length" class="text-body text-muted">Tiada nilai untuk dibandingkan.</p>
          <template v-else>
            <!-- md and up: a table per Bahagian group -->
            <div class="hidden overflow-x-auto md:block">
              <table class="w-full text-body" data-testid="evidence-check">
                <caption class="sr-only">Perbandingan blueprint dengan bukti</caption>
                <thead>
                  <tr class="text-start text-caption text-muted">
                    <th scope="col" class="py-2 pe-3 text-start font-medium">Nilai</th>
                    <th scope="col" class="py-2 pe-3 text-start font-medium">Blueprint</th>
                    <th scope="col" class="py-2 pe-3 text-start font-medium">Bukti</th>
                    <th scope="col" class="py-2 text-start font-medium">Padanan</th>
                  </tr>
                </thead>
                <tbody v-for="g in lineGroups" :key="g.title">
                  <tr><th colspan="4" scope="colgroup" class="pt-3 pb-1 text-start text-label text-highlighted">{{ g.title }}</th></tr>
                  <tr v-for="(l, i) in g.lines" :key="i">
                    <th scope="row" class="py-2 pe-3 text-start font-normal">{{ evidenceFieldLabel(l, form) }}</th>
                    <td class="tabular py-2 pe-3">{{ formatValue(l.field, l.expected) }}</td>
                    <td class="py-2 pe-3 break-words">{{ evidenceStatements(l) }}</td>
                    <td class="py-2">
                      <UBadge :color="PADANAN[l.status].color" variant="subtle" :icon="PADANAN[l.status].icon" :label="PADANAN[l.status].word" />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <!-- below md: one card per Bahagian group -->
            <div class="flex flex-col gap-3 md:hidden" data-testid="evidence-check-cards">
              <section v-for="g in lineGroups" :key="g.title" class="rounded-md bg-elevated p-3">
                <h4 class="text-label text-highlighted">{{ g.title }}</h4>
                <ul class="mt-2 flex flex-col gap-2">
                  <li v-for="(l, i) in g.lines" :key="i" class="text-caption">
                    <p class="text-default">
                      {{ evidenceFieldLabel(l, form) }}: blueprint {{ formatValue(l.field, l.expected) }} - bukti {{ evidenceStatements(l) }}
                    </p>
                    <UBadge class="mt-1" :color="PADANAN[l.status].color" variant="subtle" :icon="PADANAN[l.status].icon" :label="PADANAN[l.status].word" />
                  </li>
                </ul>
              </section>
            </div>
          </template>
          <p class="text-caption text-muted">
            Kuota topik dan KBAT ditetapkan oleh penulis kontrak; tidak dibandingkan dengan bukti.
          </p>
          <p v-if="checkedAt" class="text-caption text-muted">Disemak {{ formatDateTime(checkedAt) }}</p>
        </div>
      </DsPanel>

      <DsPanel title="Syarat Disahkan">
        <ul class="flex flex-col gap-2" data-testid="gates">
          <li
            v-for="g in gates"
            :key="g.key"
            class="flex min-w-0 flex-wrap items-start gap-2"
            :data-testid="`gate-${g.key}`"
            :data-ok="g.ok"
          >
            <UIcon
              :name="g.ok ? 'i-ph-check-circle' : 'i-ph-warning-circle'"
              class="mt-0.5 size-5 shrink-0"
              :class="g.ok ? 'text-success' : 'text-error'"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1 basis-56">
              <p class="text-body"><span class="sr-only">{{ g.ok ? 'Lulus: ' : 'Gagal: ' }}</span>{{ g.label }}</p>
              <ul v-if="!g.ok" class="mt-1 list-disc ps-5 text-caption text-muted">
                <li v-for="d in g.details" :key="d" class="break-words">{{ d }}</li>
              </ul>
            </div>
            <UButton
              v-if="!g.ok && g.goto"
              color="neutral"
              variant="soft"
              size="sm"
              class="min-h-11"
              label="Pergi ke medan"
              @click="emit('goto', g.goto)"
            />
          </li>
        </ul>
      </DsPanel>

      <DsPanel title="Sahkan Kontrak">
        <div class="flex flex-col gap-4">
          <UAlert
            v-if="failure || failureText"
            color="error"
            variant="subtle"
            icon="i-ph-warning-circle"
            title="Kontrak belum boleh disahkan."
            data-testid="verify-failure"
          >
            <template #description>
              <p v-if="failureText">{{ failureText }}</p>
              <ul v-else class="list-disc ps-5">
                <li v-for="g in failureRows" :key="g.key">
                  {{ g.label }}
                  <ul class="list-disc ps-5"><li v-for="d in g.details" :key="d">{{ d }}</li></ul>
                </li>
              </ul>
            </template>
          </UAlert>
          <template v-if="locked">
            <p class="flex items-center gap-1 text-body text-muted">
              <UIcon name="i-ph-check-circle" class="size-5 text-success" aria-hidden="true" />
              Kontrak ini sudah Disahkan.
            </p>
          </template>
          <template v-else>
            <DsFormField native for="verify-note" label="Nota pengesahan" required>
              <template #default="f">
                <UTextarea :id="f.id" v-model="note" :rows="3" :maxlength="2000" class="w-full" data-testid="verify-note" />
              </template>
            </DsFormField>
            <p class="text-caption text-muted">
              Pengesah: {{ verifierName }}, Admin Pusat. Tarikh ditetapkan oleh pelayan.
            </p>
            <div class="flex flex-wrap items-center gap-3">
              <UButton
                class="min-h-11"
                icon="i-ph-seal-check"
                label="Sahkan"
                :aria-disabled="reason ? 'true' : undefined"
                :aria-describedby="reason ? reasonId : undefined"
                :loading="verifying"
                data-testid="sahkan"
                @click="press"
              />
              <p
                v-if="reason"
                :id="reasonId"
                tabindex="-1"
                class="text-caption text-muted"
                data-testid="sahkan-reason"
              >
                {{ reason }}
              </p>
            </div>
          </template>
        </div>
      </DsPanel>
    </template>

    <EvidenceDrawer v-model:open="drawer" :editing="editing" :saving="savingEvidence" :error="evidenceError" @save="saveEvidence" />

    <DsDialog v-model:open="dialog" title="Sahkan kontrak ini?" :loading="verifying">
      <p class="text-body">{{ subjectName }} - Kertas {{ kertas }} ({{ view.code }}), versi {{ view.version }}</p>
      <p class="mt-2 text-body text-muted">
        Selepas disahkan, murid boleh menjana kertas daripada kontrak ini. Rekod pengesahan (bukti dan nota) tidak boleh diubah.
      </p>
      <p class="mt-2 text-caption text-muted">Bukti: {{ evidenceLabel }}</p>
      <template #footer>
        <UButton color="neutral" variant="soft" class="min-h-11" label="Batal" :disabled="verifying" @click="dialog = false" />
        <UButton class="min-h-11" label="Sahkan" :loading="verifying" data-testid="sahkan-confirm" @click="sahkan" />
      </template>
    </DsDialog>
  </div>
</template>
