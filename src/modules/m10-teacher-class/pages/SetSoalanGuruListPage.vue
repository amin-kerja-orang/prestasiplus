<script setup lang="ts">
/**
 * R1-GUR-8b Screen A `/guru/set-soalan` "Set Soalan Anda" (S6-T14; API-GUR-16): header with the count and
 * "Cipta Set Baru", the counters Diterbitkan / Draf / Penyertaan, and one card per own set (newest
 * update first): title, status, subject, "{n} soalan", "{n} siap" and the actions Hasil, Urus →, Salin,
 * Terbit / Jadikan Draf and Padam (after a confirm). "Salin" opens the dialog "Salin Set ke Kelas": one
 * target class, sent as a one-element `classroomIds`. Toasts use the server texts (`GURU_SET_MESSAGES`).
 */
import { GURU_SET_MESSAGES } from '@pp/contract'
import { computed, ref } from 'vue'

import { ApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import {
  DsCluster,
  DsDialog,
  DsEmptyState,
  DsFormField,
  DsGrid,
  DsGridItem,
  DsHeading,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsStatRow,
  DsText,
  useConfirm,
} from '@/ds'

import {
  copyGuruSet,
  deleteGuruSet,
  fetchGuruClasses,
  fetchGuruSets,
  setGuruSetStatus,
  type QuestionSetRow,
} from '../api/guru'
import { moduleMessage } from '../lib/generic-server-text'

const COPY = {
  title: 'Set Soalan Anda',
  create: 'Cipta Set Baru',
  emptyTitle: 'Belum ada set soalan',
  emptyBody: 'Cipta set soalan tersendiri dan kongsi dengan kelas anda.',
  emptyAction: 'Cipta Set Pertama',
  published: 'Diterbitkan',
  draft: 'Draf',
  participation: 'Penyertaan',
  results: 'Hasil',
  manage: 'Urus →',
  copy: 'Salin',
  publish: 'Terbit',
  unpublish: 'Jadikan Draf',
  remove: 'Padam',
  copyTitle: 'Salin Set ke Kelas',
  copyLabel: 'Pilih Kelas Sasaran',
  copyPlaceholder: '-- Pilih kelas --',
  cancel: 'Batal',
  confirmLabel: 'Padam',
  loadFailed: 'Gagal memuatkan senarai set soalan. Sila cuba lagi.',
  retry: 'Cuba Lagi',
  failed: 'Tindakan tidak dapat dilaksanakan. Sila cuba lagi.',
  noSubject: 'Tiada subjek',
} as const

const flash = useFlash()
const confirm = useConfirm()
const { data, error, reload } = useApi((signal) => fetchGuruSets({ signal }))
const { data: classList } = useApi((signal) => fetchGuruClasses({ signal }))
const classes = computed(() => (classList.value?.data ?? []).filter((c) => c.isActive))

const counters = computed(() => [
  {
    key: 'published',
    label: COPY.published,
    value: data.value?.counters.published ?? 0,
    icon: 'check-circle',
  },
  { key: 'draft', label: COPY.draft, value: data.value?.counters.draft ?? 0, icon: 'note-pencil' },
  {
    key: 'participation',
    label: COPY.participation,
    value: data.value?.counters.participation ?? 0,
    icon: 'users',
  },
])

const busy = ref<string | null>(null)

/** The first field message of a 422 (e.g. no class to publish), else the module message, else `fallback`. */
function failText(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.fields) {
    const first = Object.values(err.fields)[0]
    if (first) return first
  }
  return moduleMessage(err) ?? fallback
}

async function toggleStatus(set: QuestionSetRow): Promise<void> {
  if (busy.value !== null) return
  const next = set.status === 'published' ? 'draft' : 'published'
  busy.value = set.id
  try {
    await setGuruSetStatus(set.id, next)
    flash.show({
      type: 'success',
      message: next === 'published' ? GURU_SET_MESSAGES.published : GURU_SET_MESSAGES.unpublished,
    })
  } catch (err) {
    flash.show({ type: 'error', message: failText(err, COPY.failed) })
  } finally {
    busy.value = null
    await reload()
  }
}

async function remove(set: QuestionSetRow): Promise<void> {
  if (busy.value !== null) return
  const ok = await confirm({
    title: `${COPY.remove}?`,
    message: `Padam set "${set.title}"? Tindakan ini tidak boleh diundur.`,
    tone: 'error',
    confirmLabel: COPY.confirmLabel,
  })
  if (!ok) return
  busy.value = set.id
  try {
    await deleteGuruSet(set.id)
    flash.show({ type: 'success', message: GURU_SET_MESSAGES.deleted })
  } catch (err) {
    flash.show({ type: 'error', message: failText(err, COPY.failed) })
  } finally {
    busy.value = null
    await reload()
  }
}

// --- "Salin Set ke Kelas" -------------------------------------------------------------------------

const copyFor = ref<QuestionSetRow | null>(null)
const copyOpen = computed({
  get: () => copyFor.value !== null,
  set: (v: boolean) => {
    if (!v) copyFor.value = null
  },
})
const targetClass = ref('')
const copyError = ref('')
const copying = ref(false)

function openCopy(set: QuestionSetRow): void {
  copyFor.value = set
  targetClass.value = ''
  copyError.value = ''
}

async function submitCopy(): Promise<void> {
  const set = copyFor.value
  if (set === null || copying.value) return
  if (targetClass.value === '') {
    copyError.value = GURU_SET_MESSAGES.classRequiredToCopy
    return
  }
  copying.value = true
  try {
    await copyGuruSet(set.id, [targetClass.value])
    flash.show({ type: 'success', message: GURU_SET_MESSAGES.copied })
    copyFor.value = null
    await reload()
  } catch (err) {
    copyError.value = failText(err, COPY.failed)
  } finally {
    copying.value = false
  }
}
</script>

<template>
  <DsPage :title="COPY.title" data-testid="set-list-page">
    <DsCluster justify="between" stack-below="sm">
      <DsText variant="body" tone="muted" data-testid="set-count"
        >{{ data?.summary.total ?? 0 }} set soalan</DsText
      >
      <UButton
        to="/guru/set-soalan/cipta"
        icon="i-ph-plus-circle-duotone"
        class="min-h-11 shrink-0"
        data-testid="set-create"
        >{{ COPY.create }}</UButton
      >
    </DsCluster>

    <DsLoadError
      v-if="error"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="set-error"
      @retry="reload"
    />
    <DsGrid
      v-else-if="!data"
      :cols="{ base: 1, md: 2, xl: 3 }"
      aria-busy="true"
      data-testid="set-loading"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-36 w-full" />
    </DsGrid>

    <template v-else>
      <DsStatRow :items="counters" prefix="set-counter" :cols="3" />

      <DsPanel v-if="data.rows.length === 0" data-testid="set-empty">
        <DsEmptyState :title="COPY.emptyTitle" :description="COPY.emptyBody" icon="note-pencil">
          <template #actions>
            <UButton to="/guru/set-soalan/cipta" class="min-h-11" data-testid="set-empty-create">{{
              COPY.emptyAction
            }}</UButton>
          </template>
        </DsEmptyState>
      </DsPanel>

      <DsGrid v-else as="ul" :cols="{ base: 1, md: 2, xl: 3 }" data-testid="set-list">
        <DsGridItem v-for="s in data.rows" :key="s.id" as="li" data-testid="set-card">
          <DsPanel class="h-full">
            <DsStack gap="sm">
              <DsCluster justify="between" align="start" :wrap="false">
                <DsHeading :level="2" variant="subheading" wrap="anywhere" data-testid="set-title">{{
                  s.title
                }}</DsHeading>
                <UBadge
                  :color="s.status === 'published' ? 'success' : 'neutral'"
                  variant="subtle"
                  class="shrink-0"
                  data-testid="set-status"
                  >{{ s.status === 'published' ? COPY.published : COPY.draft }}</UBadge
                >
              </DsCluster>
              <DsCluster gap="sm" data-testid="set-facts">
                <DsText as="span" variant="caption" data-testid="set-subject">{{
                  s.subjectName || COPY.noSubject
                }}</DsText>
                <DsText as="span" variant="caption" data-testid="set-questions"
                  >{{ s.questionCount }} soalan</DsText
                >
                <DsText as="span" variant="caption" data-testid="set-siap">{{ s.siap }} siap</DsText>
              </DsCluster>
              <DsCluster gap="xs">
                <UButton
                  :to="`/guru/set-soalan/${encodeURIComponent(s.id)}/keputusan`"
                  color="neutral"
                  variant="soft"
                  icon="i-ph-chart-bar-duotone"
                  class="min-h-11"
                  data-testid="set-results"
                  >{{ COPY.results }}</UButton
                >
                <UButton
                  :to="`/guru/set-soalan/${encodeURIComponent(s.id)}`"
                  color="neutral"
                  variant="soft"
                  class="min-h-11"
                  data-testid="set-manage"
                  >{{ COPY.manage }}</UButton
                >
                <UButton
                  type="button"
                  color="neutral"
                  variant="soft"
                  icon="i-ph-copy-duotone"
                  class="min-h-11"
                  :disabled="busy !== null"
                  data-testid="set-copy"
                  @click="openCopy(s)"
                  >{{ COPY.copy }}</UButton
                >
                <UButton
                  type="button"
                  color="primary"
                  variant="soft"
                  class="min-h-11"
                  :loading="busy === s.id"
                  :disabled="busy !== null"
                  data-testid="set-toggle"
                  @click="toggleStatus(s)"
                  >{{ s.status === 'published' ? COPY.unpublish : COPY.publish }}</UButton
                >
                <UButton
                  type="button"
                  color="error"
                  variant="soft"
                  icon="i-ph-trash-duotone"
                  class="min-h-11"
                  :disabled="busy !== null"
                  :aria-label="`${COPY.remove} ${s.title}`"
                  data-testid="set-delete"
                  @click="remove(s)"
                  >{{ COPY.remove }}</UButton
                >
              </DsCluster>
            </DsStack>
          </DsPanel>
        </DsGridItem>
      </DsGrid>
    </template>

    <DsDialog v-model:open="copyOpen" :title="COPY.copyTitle" :loading="copying">
      <DsStack gap="md" data-testid="set-copy-dialog">
        <DsText variant="body" tone="muted">{{ GURU_SET_MESSAGES.copyNote }}</DsText>
        <DsFormField :label="COPY.copyLabel" name="set-copy-class" :error="copyError">
          <DsNativeSelect id="set-copy-class" v-model="targetClass" data-testid="set-copy-class">
            <option value="">{{ COPY.copyPlaceholder }}</option>
            <option v-for="c in classes" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </DsNativeSelect>
        </DsFormField>
      </DsStack>
      <template #footer>
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          class="min-h-11"
          :disabled="copying"
          data-testid="set-copy-cancel"
          @click="copyOpen = false"
          >{{ COPY.cancel }}</UButton
        >
        <UButton
          type="button"
          class="min-h-11"
          :loading="copying"
          :disabled="copying"
          data-testid="set-copy-submit"
          @click="submitCopy"
          >{{ COPY.copy }}</UButton
        >
      </template>
    </DsDialog>
  </DsPage>
</template>
