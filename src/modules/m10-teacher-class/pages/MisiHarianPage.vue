<script setup lang="ts">
/**
 * R1-GUR-2b `/guru/misi-harian` "Misi Harian" (API-GUR-11; S6-T07). Regions: header with intro and
 * "Misi Baru", the form card "Cipta Misi" (`MisiHarianFormPage`, opened by the button or `?baru=1`)
 * and the mission cards (own and Global, date descending). Delete only on own missions, after the
 * CF-07 confirm; a refusal (403 Global, 404) shows its message as a toast.
 */
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsCluster,
  DsEmptyState,
  DsGrid,
  DsGridItem,
  DsHeading,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsText,
  useConfirm,
} from '@/ds'
import { formatDate } from '@/lib/time'

import { deleteTeacherMission, fetchTeacherMissions, type TeacherMission } from '../api/guru'
import { moduleMessage } from '../lib/generic-server-text'
import MisiHarianFormPage from './MisiHarianFormPage.vue'

const COPY = {
  title: 'Misi Harian',
  intro: 'Assign misi harian kepada pelajar. Fokus: Latih Tubi SPM & Tracking A.',
  create: 'Misi Baru',
  emptyTitle: 'Belum ada misi',
  emptyBody: 'Cipta misi harian pertama untuk pelajar anda.',
  emptyAction: 'Cipta Misi',
  global: 'Global',
  completed: 'pelajar selesai',
  remove: 'Padam',
  confirmTitle: 'Padam misi ini?',
  confirmLabel: 'Padam',
  deleteFailed: 'Misi tidak dapat dipadam. Sila cuba lagi.',
  loadFailed: 'Gagal memuatkan senarai misi. Sila cuba lagi.',
  retry: 'Cuba Lagi',
} as const

const route = useRoute()
const router = useRouter()
const flash = useFlash()
const confirm = useConfirm()
const { data, error, reload } = useApi((signal) => fetchTeacherMissions({ signal }))

/** D115: `/guru/misi-harian/cipta` redirects here with `?baru=1`, the form open. */
const formOpen = ref(route.query.baru === '1')

function openForm(): void {
  formOpen.value = true
}

async function closeForm(): Promise<void> {
  formOpen.value = false
  if (route.query.baru !== undefined) await router.replace({ path: route.path })
}

async function onCreated(): Promise<void> {
  await closeForm()
  await reload()
}

const deleting = ref<string | null>(null)

async function remove(m: TeacherMission): Promise<void> {
  if (m.global || deleting.value !== null) return
  const ok = await confirm({
    title: COPY.confirmTitle,
    // [PROPOSED] body: the PRD gives no confirm text (CF-07).
    message: `Misi "${m.title}" akan dipadam. Ganjaran yang telah dibayar kekal.`,
    tone: 'error',
    confirmLabel: COPY.confirmLabel,
  })
  if (!ok) return
  deleting.value = m.id
  try {
    await deleteTeacherMission(m.id)
    await reload()
  } catch (err) {
    flash.show({ type: 'error', message: moduleMessage(err) ?? COPY.deleteFailed })
    // A mission already gone (404) or never deletable (403): refresh so the list is truthful.
    await reload()
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <DsPage :title="COPY.title" data-testid="misi-page">
    <DsCluster justify="between" stack-below="sm">
      <DsText variant="body" tone="muted" data-testid="misi-intro">{{ COPY.intro }}</DsText>
      <UButton
        type="button"
        icon="i-ph-plus-circle-duotone"
        class="min-h-11 shrink-0"
        :disabled="formOpen"
        data-testid="misi-new"
        @click="openForm"
        >{{ COPY.create }}</UButton
      >
    </DsCluster>

    <MisiHarianFormPage v-if="formOpen" @created="onCreated" @cancel="closeForm" />

    <DsLoadError
      v-if="error"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="misi-error"
      @retry="reload"
    />
    <DsGrid
      v-else-if="!data"
      :cols="{ base: 1, md: 2, xl: 3 }"
      aria-busy="true"
      data-testid="misi-loading"
    >
      <USkeleton v-for="n in 3" :key="n" class="h-36 w-full" />
    </DsGrid>

    <DsPanel v-else-if="data.length === 0" data-testid="misi-empty">
      <DsEmptyState :title="COPY.emptyTitle" :description="COPY.emptyBody" icon="target">
        <template #actions>
          <UButton
            type="button"
            class="min-h-11"
            data-testid="misi-empty-create"
            @click="openForm"
            >{{ COPY.emptyAction }}</UButton
          >
        </template>
      </DsEmptyState>
    </DsPanel>

    <DsGrid v-else as="ul" :cols="{ base: 1, md: 2, xl: 3 }" data-testid="misi-list">
      <DsGridItem v-for="m in data" :key="m.id" as="li" data-testid="misi-card">
        <DsPanel class="h-full">
          <DsStack gap="sm">
            <DsCluster justify="between" align="start" :wrap="false">
              <DsStack gap="xs" class="grow">
                <DsCluster gap="sm">
                  <DsHeading
                    :level="2"
                    variant="subheading"
                    wrap="anywhere"
                    data-testid="misi-title-text"
                    >{{ m.title }}</DsHeading
                  >
                  <UBadge
                    v-if="m.global"
                    color="primary"
                    variant="subtle"
                    data-testid="misi-global"
                    >{{ COPY.global }}</UBadge
                  >
                </DsCluster>
                <DsText
                  v-if="m.description"
                  variant="body"
                  tone="muted"
                  wrap="anywhere"
                  data-testid="misi-desc"
                  >{{ m.description }}</DsText
                >
                <DsCluster gap="sm" data-testid="misi-facts">
                  <DsText as="span" variant="caption">{{ m.targetQuestions }} soalan</DsText>
                  <DsText as="span" variant="caption">+{{ m.rewardCoins }} syiling</DsText>
                  <DsText as="span" variant="caption">{{
                    formatDate(`${m.date}T00:00:00+08:00`)
                  }}</DsText>
                </DsCluster>
              </DsStack>
              <DsStack gap="2xs" align="center" class="shrink-0">
                <DsText variant="kpi" data-testid="misi-completed">{{ m.completedCount }}</DsText>
                <DsText variant="caption">{{ COPY.completed }}</DsText>
              </DsStack>
            </DsCluster>
            <DsCluster v-if="!m.global" justify="end">
              <UButton
                type="button"
                color="error"
                variant="soft"
                icon="i-ph-trash-duotone"
                class="min-h-11 min-w-11"
                :loading="deleting === m.id"
                :disabled="deleting !== null"
                :aria-label="`${COPY.remove} misi ${m.title}`"
                data-testid="misi-delete"
                @click="remove(m)"
                >{{ COPY.remove }}</UButton
              >
            </DsCluster>
          </DsStack>
        </DsPanel>
      </DsGridItem>
    </DsGrid>
  </DsPage>
</template>
