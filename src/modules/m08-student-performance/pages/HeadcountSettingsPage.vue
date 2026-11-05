<script setup lang="ts">
/**
 * `/headcount/{id}/settings` "Tetapan" (S10-T02; R1-GUR-3 Forms, AC-GUR-3-17, FR-GUR-3-9/-11, AC-GUR-3-15).
 * Two blocks. "Bilangan OTR" (2-5; the mode is read-only after creation): lowering the count over keyed AR
 * is answered by the API with a 409 and the text "OTR{k} ke atas mempunyai markah. Padam markah tersebut?",
 * shown in the CF-05 dialog ("Batal" keeps the count, "Ya, Padam" repeats the save with `confirm`); toast
 * "Tetapan disimpan.". "Sasaran" (the subject card, DOC DEFECT 1: it has no page of its own): the TOV and
 * RS (Sasaran) defaults of every config of this subject and year of the teacher, Jurang, "Simpan Sasaran",
 * toast "Sasaran disimpan." or "Gagal menyimpan sasaran. Cuba lagi.".
 */
import { useToast } from '@nuxt/ui/composables'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { PERFORMANCE_HEADCOUNT_MESSAGES } from '@pp/contract'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router'
import {
  DsBackLink,
  DsCluster,
  DsDialog,
  DsHeading,
  DsLoadError,
  DsPage,
  DsPageHeader,
  DsPanel,
  DsStack,
  DsStickyActions,
  DsText,
} from '@/ds'

import {
  fetchHeadcountDetail,
  fetchHeadcounts,
  saveHeadcountDefaults,
  saveHeadcountSettings,
} from '../api/headcount'
import type { HeadcountDetail } from '../api/headcount-types'
import MarkInput from '../components/headcount/MarkInput.vue'
import { headcountActionError } from '../lib/headcount/error-text'
import { DASH, selisihText } from '../lib/headcount/format'
import { jurangOf, parseMark } from '../lib/headcount/otr'
import { LOAD_ERROR, isLoadError, useRouteData } from '../lib/prestasi/load'
import { routeId } from '../lib/route-id'

const SAVE_TARGET_ERROR = PERFORMANCE_HEADCOUNT_MESSAGES.saved.targetsFailed

const route = useRoute()
const toast = useToast()
const id = computed(() => routeId(route.params.id))

const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountDetail(id.value, { signal }),
  [id],
)

const detail = ref<HeadcountDetail | null>(null)
const activeOtrs = ref(3)
const tov = ref('')
const rs = ref('')

function fill(d: HeadcountDetail): void {
  detail.value = d
  activeOtrs.value = d.config.activeOtrs
  tov.value = d.config.defaultTov === null ? '' : String(d.config.defaultTov)
  rs.value = d.config.defaultEtr === null ? '' : String(d.config.defaultEtr)
}
watch(
  data,
  (d) => {
    if (d) fill(d)
  },
  { immediate: true },
)

const OTR_ITEMS = [2, 3, 4, 5].map((n) => ({ label: `${String(n)} OTR`, value: n }))

const subtitle = computed(() => {
  const c = detail.value?.config
  return c ? `${c.subject} · ${c.className} · ${c.levelName} · ${String(c.year)}` : ''
})
const modeLabel = computed(() => (detail.value?.config.mode === 'manual' ? 'Manual' : 'Auto'))

// ---- Bilangan OTR + CF-05 -------------------------------------------------------------------------

const savingSettings = ref(false)
const settingsError = ref<string | null>(null)
const confirmText = ref<string | null>(null)
const confirmOpen = computed({
  get: () => confirmText.value !== null,
  set: (open: boolean) => {
    if (!open) cancelDelete()
  },
})

async function saveSettings(confirm: boolean): Promise<void> {
  if (savingSettings.value || !detail.value) return
  savingSettings.value = true
  settingsError.value = null
  try {
    const next = await saveHeadcountSettings(id.value, {
      activeOtrs: activeOtrs.value,
      ...(confirm ? { confirm: true } : {}),
    })
    confirmText.value = null
    detail.value = next
    activeOtrs.value = next.config.activeOtrs
    toast.add({ title: PERFORMANCE_HEADCOUNT_MESSAGES.saved.settings, color: 'success' })
  } catch (err) {
    if (isApiError(err) && err.status === 404) setRouteOutcome(404)
    else if (isApiError(err) && err.status === 409 && !confirm) confirmText.value = headcountActionError(err)
    else {
      confirmText.value = null
      settingsError.value = headcountActionError(err)
    }
  } finally {
    savingSettings.value = false
  }
}

/** CF-05 "Batal": the count stays as it was. */
function cancelDelete(): void {
  confirmText.value = null
  if (detail.value) activeOtrs.value = detail.value.config.activeOtrs
}

// ---- Sasaran (Simpan Sasaran) -----------------------------------------------------------------------

const tovError = ref<string | undefined>()
const rsError = ref<string | undefined>()
const savingTarget = ref(false)
const targetError = ref<string | null>(null)

const jurang = computed(() => {
  const a = parseMark(tov.value)
  const b = parseMark(rs.value)
  const diff = a.ok && b.ok ? jurangOf(a.value, b.value) : null
  if (diff === null) return DASH
  return diff === 0 ? '0' : selisihText(diff)
})

/** "AR {n}%": the class mean of the latest checkpoint that has one, "AR —" without. */
const arPill = computed(() => {
  const ars = detail.value?.averages.ars ?? []
  for (let i = ars.length - 1; i >= 0; i--) {
    const v = ars[i]
    if (v !== null && v !== undefined) return `AR ${String(Math.round(v))}%`
  }
  return 'AR —'
})

async function saveTargets(): Promise<void> {
  const c = detail.value?.config
  if (savingTarget.value || !c) return
  tovError.value = undefined
  rsError.value = undefined
  targetError.value = null
  const a = parseMark(tov.value)
  const b = parseMark(rs.value)
  if (!a.ok) tovError.value = a.error
  if (!b.ok) rsError.value = b.error
  if (!a.ok || !b.ok) return
  savingTarget.value = true
  try {
    // Every config of this subject and year of the teacher (FR-GUR-3-11); a config the list does not show is this one.
    const own = (await fetchHeadcounts()).filter(
      (h) =>
        h.subjectName === c.subject &&
        h.year === c.year &&
        (h.teacherName === undefined || h.teacherName === c.teacherName),
    )
    const ids: (number | string)[] = own.map((h) => h.id)
    if (!ids.some((x) => String(x) === String(id.value))) ids.push(id.value)
    const results = await Promise.all(
      ids.map((x) => saveHeadcountDefaults(x, { defaultTov: a.value, defaultEtr: b.value })),
    )
    const mine = results.find((r) => String(r.config.id) === String(id.value))
    if (mine) fill(mine)
    toast.add({ title: PERFORMANCE_HEADCOUNT_MESSAGES.saved.targets, color: 'success' })
  } catch (err) {
    if (isApiError(err) && err.status === 404) setRouteOutcome(404)
    else targetError.value = SAVE_TARGET_ERROR
  } finally {
    savingTarget.value = false
  }
}
</script>

<template>
  <DsPage data-testid="headcount-settings-page">
    <DsLoadError v-if="isLoadError(error)" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="detail">
      <DsPageHeader title="Tetapan" :subtitle="subtitle" subtitle-testid="settings-subtitle">
        <template #breadcrumb>
          <DsBackLink :to="`/headcount/${String(id)}`" label="Kembali" data-testid="back-link" />
        </template>
      </DsPageHeader>

      <DsPanel data-testid="settings-panel">
        <DsStack
          as="form"
          gap="xl"
          novalidate
          data-testid="settings-form"
          @submit.prevent="saveSettings(false)"
        >
          <UAlert
            v-if="settingsError"
            color="error"
            variant="subtle"
            icon="i-ph-warning-circle"
            :title="settingsError"
            role="alert"
            data-testid="settings-error"
          />
          <URadioGroup
            v-model="activeOtrs"
            legend="Bilangan OTR"
            name="active_otrs"
            :items="OTR_ITEMS"
            orientation="horizontal"
            variant="card"
            hint="Minimum 2 OTR · Default 3 OTR · Boleh tukar 2/3/4/5 ikut keperluan kelas."
            data-testid="field-otr"
          />
          <DsText as="p" variant="body" tone="default" data-testid="mode-readonly">
            <DsText as="span" variant="label" tone="highlighted">Mod Pengiraan Markah:</DsText> {{ modeLabel }}
          </DsText>
          <DsStickyActions>
            <UButton
              type="submit"
              size="lg"
              icon="i-ph-floppy-disk"
              label="Simpan"
              :loading="savingSettings"
              data-testid="settings-save"
            />
          </DsStickyActions>
        </DsStack>
      </DsPanel>

      <DsPanel data-testid="target-panel">
        <DsStack
          as="form"
          gap="xl"
          novalidate
          data-testid="target-form"
          @submit.prevent="saveTargets"
        >
          <DsCluster justify="between">
            <DsStack gap="none">
              <DsHeading :level="2" variant="label">{{ detail.config.subject }}</DsHeading>
              <DsText as="p" variant="caption" tone="muted">Sasaran TOV → RS</DsText>
            </DsStack>
            <UBadge color="neutral" variant="subtle" size="lg" :label="arPill" data-testid="ar-pill" />
          </DsCluster>
          <UAlert
            v-if="targetError"
            color="error"
            variant="subtle"
            icon="i-ph-warning-circle"
            :title="targetError"
            role="alert"
            data-testid="target-error"
          />
          <UFormField label="TOV">
            <MarkInput v-model="tov" label="TOV" :error="tovError" data-testid="target-tov" />
          </UFormField>
          <UFormField label="RS (Sasaran)">
            <MarkInput v-model="rs" label="RS (Sasaran)" :error="rsError" data-testid="target-rs" />
          </UFormField>
          <DsText as="p" variant="body" tone="default" data-testid="jurang">Jurang: {{ jurang }}</DsText>
          <DsStickyActions>
            <UButton
              type="submit"
              size="lg"
              icon="i-ph-floppy-disk"
              label="Simpan Sasaran"
              :loading="savingTarget"
              data-testid="target-save"
            />
          </DsStickyActions>
        </DsStack>
      </DsPanel>

      <DsDialog
        v-model:open="confirmOpen"
        :title="confirmText ?? ''"
        :loading="savingSettings"
        data-testid="cf05-dialog"
      >
        <template #footer>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            label="Batal"
            data-testid="cf05-cancel"
            @click="cancelDelete"
          />
          <UButton
            type="button"
            color="error"
            icon="i-ph-trash"
            label="Ya, Padam"
            :disabled="savingSettings"
            data-testid="cf05-confirm"
            @click="saveSettings(true)"
          />
        </template>
      </DsDialog>
    </template>
    <DsStack v-else-if="!error" gap="lg" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </DsStack>
  </DsPage>
</template>
