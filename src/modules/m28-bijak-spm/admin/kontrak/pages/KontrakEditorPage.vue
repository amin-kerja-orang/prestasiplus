<script setup lang="ts">
/**
 * K2: Penyunting Kontrak (`/admin/spm/kontrak/:subjek/:kertas`, design 4). Tabs Umum, one per
 * Bahagian, Pengesahan; the live "Semakan Kontrak" panel; save as a new version (AC-39.4); the
 * Pengesahan tab verifies the contract (US-39). `?baharu=1` opens an empty Draf (K1 "Tambah Kontrak").
 */
import type { BijakBlueprintVersionItem, BijakBlueprintView, BijakUnitRefView } from '@pp/contract'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import { useFlash } from '@/composables/useFlash'
import {
  DsEmptyState,
  DsFormBar,
  DsLoadError,
  DsPage,
  DsPillNav,
  DsSplit,
  DsDialog,
  useConfirm,
  type PillItem,
} from '@/ds'

import ContractCheckPanel from '../components/ContractCheckPanel.vue'
import GeneralTab from '../components/GeneralTab.vue'
import SectionEditor from '../components/SectionEditor.vue'
import SourceBadge from '../components/SourceBadge.vue'
import VerifyPanel from '../components/VerifyPanel.vue'
import {
  emptyForm,
  formFromView,
  structuralKey,
  toInput,
  type ContractForm,
} from '../domain/form'
import { errorsOf, incompleteOf, issueFromProblem, validateForm, type Issue } from '../domain/validate'
import { KONTRAK_ROUTES, KontrakError } from '../server/api'
import { kontrakServer } from '../server/client'

const api = kontrakServer()
const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()

const subject = computed(() => String(route.params.subjek))
const kertas = computed(() => Number(route.params.kertas))
const view = ref<BijakBlueprintView | null>(null)
const isNew = computed(() => route.query.baharu === '1' && !view.value)
const versions = ref<BijakBlueprintVersionItem[]>([])
const subjectName = ref('')
const status = ref<'loading' | 'error' | 'missing' | 'ready'>('loading')
const form = ref<ContractForm>(emptyForm())
const baseline = ref('')
const reloadKey = ref(0)

const serialize = (f: ContractForm): string => JSON.stringify(f)
const dirty = computed(() => status.value === 'ready' && serialize(form.value) !== baseline.value)

async function load(): Promise<void> {
  status.value = 'loading'
  refused.value = []
  conflict.value = false
  try {
    if (route.query.baharu === '1') {
      const subs = await api.subjectOptions()
      subjectName.value = subs.find((s) => s.code === subject.value)?.name ?? subject.value
      view.value = null
      versions.value = []
      form.value = emptyForm()
    } else {
      const v = await api.get(subject.value, kertas.value)
      view.value = v
      subjectName.value = v.subjectName
      versions.value = await api.versions(subject.value, kertas.value)
      form.value = formFromView(v)
    }
    baseline.value = serialize(form.value)
    status.value = 'ready'
  } catch (e) {
    status.value = e instanceof KontrakError && e.kind === 'not_found' ? 'missing' : 'error'
  }
}
onMounted(load)
watch(() => [route.params.subjek, route.params.kertas, route.query.baharu], load)

/* -------------------------------------------------------------------------- issues, tabs */
const refused = ref<Issue[]>([])
const issues = computed(() => (status.value === 'ready' ? validateForm(form.value) : []))
const problemCount = computed(() => errorsOf(issues.value).length + incompleteOf(issues.value).length)

const tab = computed(() => String(route.query.paparan ?? 'umum'))
const sectionIndex = computed(() => {
  const m = /^bahagian-(\d+)$/.exec(tab.value)
  return m ? Number(m[1]) - 1 : -1
})
function tabTo(key: string) {
  return { query: { ...route.query, paparan: key } }
}
const countFor = (section: number | null): number =>
  issues.value.filter((i) => i.section === section && i.level !== 'warning').length
const tabs = computed<PillItem<string>[]>(() => {
  const out: PillItem<string>[] = []
  const n0 = countFor(null)
  out.push({ key: 'umum', label: n0 ? `Umum (${n0})` : 'Umum', to: tabTo('umum') })
  form.value.sections.forEach((s, i) => {
    const n = countFor(i)
    const short = (s.label.trim() || `Bahagian ${i + 1}`).slice(0, 12)
    out.push({ key: `bahagian-${i + 1}`, label: n ? `${short} (${n})` : short, to: tabTo(`bahagian-${i + 1}`) })
  })
  if (!isNew.value) out.push({ key: 'pengesahan', label: 'Pengesahan', to: tabTo('pengesahan') })
  return out
})
const activeTab = computed(() => {
  if (tab.value === 'pengesahan' && !isNew.value) return 'pengesahan'
  if (sectionIndex.value >= 0 && sectionIndex.value < form.value.sections.length) return tab.value
  return 'umum'
})
const activeSection = computed(() => (activeTab.value.startsWith('bahagian-') ? Number(activeTab.value.slice(9)) - 1 : -1))

async function focusTarget(target: string): Promise<void> {
  await nextTick()
  await nextTick()
  const el = document.getElementById(target)
  el?.scrollIntoView?.({ block: 'center' })
  el?.focus?.()
}
async function gotoIssue(i: { section: number | null; part: string; target: string }): Promise<void> {
  const key = i.section === null ? 'umum' : `bahagian-${i.section + 1}`
  if (tab.value !== key) await router.replace(tabTo(key))
  await focusTarget(i.target)
}

/* -------------------------------------------------------------------------- banners */
const sharedOpen = ref(localStorage.getItem('kontrak-dikongsi') !== 'closed')
function toggleShared(): void {
  sharedOpen.value = !sharedOpen.value
  localStorage.setItem('kontrak-dikongsi', sharedOpen.value ? 'open' : 'closed')
}
const serving = computed(() => versions.value.find((v) => v.servesStudents) ?? null)
const structuralChanged = computed(() => {
  if (!view.value || status.value !== 'ready') return false
  return structuralKey(toInput(form.value)) !== structuralKey(toInput({ ...formFromView(view.value) }))
})
const versionBanner = computed<{ color: 'info' | 'warning'; text: string } | null>(() => {
  const v = view.value
  if (!v) return null
  if (v.source === 'Disahkan') {
    return structuralChanged.value
      ? { color: 'warning', text: `Perubahan ini akan disimpan sebagai v${v.version + 1} (Spec). Murid masih menggunakan v${v.version} (Disahkan).` }
      : { color: 'info', text: `Kontrak ini Disahkan (v${v.version}). Mengubah markah, struktur, profil, kuota atau KBAT akan disimpan sebagai versi baharu berstatus Spec. Murid terus menggunakan v${v.version} sehingga versi baharu disahkan.` }
  }
  if (serving.value && serving.value.version !== v.version)
    return { color: 'warning', text: `Versi terkini (v${v.version}) berstatus Spec. Murid menggunakan v${serving.value.version} (Disahkan) sehingga v${v.version} disahkan.` }
  return null
})

/* -------------------------------------------------------------------------- save */
const saving = ref(false)
const conflict = ref(false)
const saveError = ref('')
const summaryRef = ref<HTMLElement | null>(null)
const newVersionDialog = ref(false)

const summaryIssues = computed(() => refused.value)

async function showSummary(list: Issue[]): Promise<void> {
  refused.value = list
  await nextTick()
  summaryRef.value?.focus()
}

async function save(): Promise<void> {
  saveError.value = ''
  conflict.value = false
  const errs = errorsOf(issues.value)
  if (errs.length) {
    await showSummary(errs)
    return
  }
  refused.value = []
  if (view.value?.source === 'Disahkan' && structuralChanged.value && !newVersionDialog.value) {
    newVersionDialog.value = true
    return
  }
  await commit()
}

async function commit(): Promise<void> {
  newVersionDialog.value = false
  saving.value = true
  try {
    const body = toInput(form.value)
    let saved: BijakBlueprintView
    if (isNew.value) {
      saved = await api.create({ subject: subject.value, kertas: kertas.value, ...body })
    } else {
      saved = await api.saveVersion(subject.value, kertas.value, body)
    }
    flash.show({ type: 'success', message: 'Kontrak berjaya disimpan.' })
    view.value = saved
    versions.value = await api.versions(subject.value, kertas.value)
    form.value = formFromView(saved)
    baseline.value = serialize(form.value)
    reloadKey.value += 1
    if (route.query.baharu) {
      const { baharu: _b, ...rest } = route.query
      void _b
      await router.replace({ query: rest })
    }
  } catch (e) {
    if (e instanceof KontrakError && e.kind === 'invalid') {
      await showSummary(e.problems.map((p) => issueFromProblem(p, form.value.sections)))
    } else if (e instanceof KontrakError && e.kind === 'conflict') {
      conflict.value = true
      saveError.value = e.message
    } else {
      saveError.value = e instanceof Error ? e.message : 'Kontrak tidak dapat disimpan.'
    }
  } finally {
    saving.value = false
  }
}

async function reload(): Promise<void> {
  await load()
  reloadKey.value += 1
}

async function retire(): Promise<void> {
  retireError.value = ''
  try {
    await api.retire(subject.value, kertas.value)
    flash.show({ type: 'success', message: 'Kontrak dipadam.' })
    baseline.value = serialize(form.value)
    await router.push({ name: KONTRAK_ROUTES.list })
  } catch (e) {
    retireError.value = e instanceof Error ? e.message : 'Kontrak tidak dapat dipadam.'
  }
}
const retireError = ref('')

/* Review stamp (AC-39.9): marks one section's seeded quota and KBAT values as reviewed, in place, no new version. */
const reviewing = ref(false)
const reviewError = ref('')
const canReview = computed(() => !isNew.value && !dirty.value && view.value !== null && view.value.source !== 'Disahkan')
async function reviewSection(index: number): Promise<void> {
  if (!canReview.value || reviewing.value) return
  reviewing.value = true
  reviewError.value = ''
  try {
    const saved = await api.reviewSection(subject.value, kertas.value, index + 1)
    view.value = saved
    form.value = formFromView(saved)
    baseline.value = serialize(form.value)
    reloadKey.value += 1
    flash.show({ type: 'success', message: 'Bahagian ditandakan sudah disemak.' })
  } catch (e) {
    reviewError.value = e instanceof Error ? e.message : 'Bahagian tidak dapat ditandakan.'
  } finally {
    reviewing.value = false
  }
}

function onVerified(v: BijakBlueprintView): void {
  void (async () => {
    view.value = v
    versions.value = await api.versions(subject.value, kertas.value)
    form.value = formFromView(v)
    baseline.value = serialize(form.value)
    reloadKey.value += 1
  })()
}

onBeforeRouteLeave(async (to) => {
  if (!dirty.value || to.path === route.path) return true
  return confirm({
    message: 'Tinggalkan halaman? Perubahan belum disimpan akan hilang.',
    confirmLabel: 'Tinggalkan',
    tone: 'error',
  })
})

const poolTo = computed(() => ({
  name: KONTRAK_ROUTES.pool,
  params: { subjek: subject.value, kertas: String(kertas.value) },
}))
const subtitle = computed(() => `${subjectName.value} - Kertas ${kertas.value}${form.value.code ? ` - ${form.value.code}` : ''}`)
const loadUnits = async (s: string): Promise<BijakUnitRefView[]> =>
  (await api.listUnits(s)).map((u) => ({ kind: 'unit' as const, nodeId: u.nodeId, code: u.code, level: u.level, title: u.title }))
function scrollToCheck(): void {
  document.getElementById('contract-check-anchor')?.scrollIntoView?.({ block: 'start' })
}
const poolReason = 'Simpan dahulu'
</script>

<template>
  <DsPage
    layout="form"
    width="wide"
    :back-to="{ name: KONTRAK_ROUTES.list }"
    back-label="Kembali"
    :subtitle="status === 'ready' ? subtitle : undefined"
    data-testid="kontrak-editor"
  >
    <template v-if="status === 'ready'" #meta>
      <SourceBadge :source="view?.source ?? form.source" />
      <UBadge v-if="view" color="neutral" variant="subtle" :label="`Versi ${view.version}`" />
      <UBadge
        v-if="serving && view && serving.version !== view.version"
        color="info"
        variant="subtle"
        :label="`Murid guna v${serving.version} (Disahkan)`"
      />
      <UBadge v-if="view?.needsReview" color="warning" variant="subtle" icon="i-ph-warning-circle" label="Blueprint perlu disemak" data-testid="needs-review" />
    </template>
    <template v-if="status === 'ready' && !isNew" #actions>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="neutral"
          variant="soft"
          class="min-h-11"
          icon="i-ph-stack"
          label="Pratonton Kolam"
          :to="dirty ? undefined : poolTo"
          :aria-disabled="dirty ? 'true' : undefined"
          aria-describedby="pool-reason"
          data-testid="pool-link"
        />
        <span v-if="dirty" id="pool-reason" class="text-caption text-muted">{{ poolReason }}</span>
      </div>
    </template>
    <template v-if="status === 'ready'" #tabs>
      <DsPillNav :items="tabs" :active="activeTab" label="Bahagian kontrak" testid-prefix="tab" />
    </template>

    <div v-if="status === 'loading'" role="status" aria-busy="true" class="flex flex-col gap-4">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
    <DsLoadError v-else-if="status === 'error'" message="Tidak dapat memuatkan kontrak. Sila cuba semula." @retry="load" />
    <DsEmptyState
      v-else-if="status === 'missing'"
      title="Kontrak tidak ditemui."
      icon="scroll"
    >
      <template #actions><UButton :to="{ name: KONTRAK_ROUTES.list }" label="Kembali" class="min-h-11" /></template>
    </DsEmptyState>

    <form v-else class="flex min-w-0 flex-col gap-4" novalidate @submit.prevent="save">
      <div v-if="sharedOpen" class="min-w-0">
        <UAlert
          color="info"
          variant="subtle"
          icon="i-ph-info"
          :description="`Kontrak ini dikongsi. Mengubahnya mengubah syarat terbit dan Jana Kertas bagi semua kertas ${subjectName} Kertas ${kertas}.`"
          :actions="[{ label: 'Tutup', color: 'neutral', variant: 'soft', class: 'min-h-11', onClick: toggleShared }]"
          data-testid="shared-banner"
        />
      </div>
      <div v-else>
        <UButton color="neutral" variant="link" class="min-h-11 px-0" icon="i-ph-info" label="Kontrak ini dikongsi" :aria-expanded="false" @click="toggleShared" />
      </div>

      <UAlert v-if="versionBanner" :color="versionBanner.color" variant="subtle" icon="i-ph-info" :description="versionBanner.text" data-testid="version-banner" />

      <UAlert
        v-if="conflict"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        description="Kontrak ini telah diubah oleh pengguna lain. Muat semula untuk melihat versi terkini."
        :actions="[{ label: 'Muat Semula', color: 'neutral', variant: 'soft', class: 'min-h-11', onClick: reload }]"
        data-testid="conflict"
      />
      <UAlert v-else-if="saveError" color="error" variant="subtle" icon="i-ph-warning-circle" :description="saveError" role="alert" data-testid="save-error" />

      <div v-if="summaryIssues.length" ref="summaryRef" tabindex="-1" class="outline-none" data-testid="save-summary">
        <UAlert
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          role="alert"
          :title="`Kontrak tidak dapat disimpan. Sila betulkan ${summaryIssues.length} masalah di bawah.`"
        >
          <template #description>
            <ul class="mt-1 flex flex-col gap-1">
              <li v-for="e in summaryIssues" :key="e.id">
                <UButton variant="link" color="error" class="h-auto min-h-11 justify-start p-0 text-start whitespace-normal" :label="e.message" @click="gotoIssue(e)" />
              </li>
            </ul>
          </template>
        </UAlert>
      </div>

      <DsSplit ratio="8-4" stack-below="xl" gap="lg" aside-first-when-stacked sticky-aside>
        <div class="flex min-w-0 flex-col gap-6" :aria-busy="saving ? 'true' : undefined">
          <GeneralTab
            v-if="activeTab === 'umum'"
            v-model:form="form"
            :subject-name="subjectName"
            :kertas="kertas"
            :is-new="isNew"
            :issues="issues"
            :retire-error="retireError"
            :dependent-papers="view?.dependentPaperCount ?? 0"
            :reference="view?.reference ?? []"
            @edit="(i) => router.replace(tabTo(`bahagian-${i + 1}`))"
            @retire="retire"
          />
          <SectionEditor
            v-else-if="activeSection >= 0 && form.sections[activeSection]"
            :key="form.sections[activeSection]!.uid"
            v-model="form.sections[activeSection]!"
            :index="activeSection"
            :form="form"
            :subject="subject"
            :issues="issues"
            :load-units="loadUnits"
            :can-review="canReview"
            :reviewing="reviewing"
            :review-error="reviewError"
            @review="reviewSection(activeSection)"
          />
          <VerifyPanel
            v-else-if="activeTab === 'pengesahan' && view"
            :api="api"
            :subject="subject"
            :kertas="kertas"
            :subject-name="subjectName"
            :view="view"
            :versions="versions"
            :form="form"
            :dirty="dirty"
            :reload-key="reloadKey"
            @verified="onVerified"
            @goto="gotoIssue"
          />
        </div>
        <template #aside>
          <div id="contract-check-anchor">
            <ContractCheckPanel :form="form" :issues="issues" @goto="gotoIssue" />
          </div>
        </template>
      </DsSplit>

      <DsFormBar :saving="saving" submit-label="Simpan" :cancel-to="{ name: KONTRAK_ROUTES.list }">
        <template #status>
          <UButton
            color="neutral"
            variant="link"
            class="min-h-11 px-0"
            :label="problemCount ? `${problemCount} masalah` : 'Tiada masalah'"
            data-testid="problem-chip"
            @click="scrollToCheck"
          />
        </template>
      </DsFormBar>
    </form>

    <DsDialog v-model:open="newVersionDialog" title="Simpan sebagai versi baharu?" :loading="saving">
      <p class="text-body">
        Versi {{ (view?.version ?? 0) + 1 }} akan berstatus Spec. Murid masih menggunakan v{{ view?.version }} sehingga versi baharu disahkan.
      </p>
      <template #footer>
        <UButton color="neutral" variant="soft" class="min-h-11" label="Batal" @click="newVersionDialog = false" />
        <UButton class="min-h-11" label="Simpan Versi Baharu" :loading="saving" data-testid="confirm-new-version" @click="commit" />
      </template>
    </DsDialog>
  </DsPage>
</template>
