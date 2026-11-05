<script setup lang="ts">
/**
 * S16 `/timeline` "Timeline Saya" (R1-MUR-39; FR-M08-97..99), from `GET /api/timeline`: heading, "Tambah Post", the feed
 * (finished sessions, badges earned and own posts, newest first, grouped by Malaysian day) or the empty card, and the
 * "Profil Awam Anda" box with the viewer's own public link (DV-19) and a copy button (`fa-copy` / `fa-check` for
 * 2,000ms, only when the write succeeds). An own post has "Padam" with a confirm dialog (B-056).
 */
import { computed, onBeforeUnmount, ref } from 'vue'

import { isApiError } from '@/api'
import {
  DsCluster,
  DsDialog,
  DsEmptyState,
  DsHeading,
  DsIcon,
  DsIconChip,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsText,
} from '@/ds'

import { deleteTimelinePost, fetchTimeline } from '../api/performance'
import type { TimelinePost } from '../api/types'
import PostCard from '../components/timeline/PostCard.vue'
import { entriesOf, groupByDay, badgeEmoji, badgeTitle, rowKey, rowTime, sessionDetail, sessionTitle } from '../lib/timeline/feed'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { copyText } from '../lib/timeline/clipboard'
import { absoluteUrl } from '../lib/timeline/profile'

const { data, error, reload } = useRouteData((signal) => fetchTimeline({ signal }))
const loadFailed = computed(() => isLoadError(error.value))
const days = computed(() => groupByDay(data.value ? entriesOf(data.value) : []))
const empty = computed(() => days.value.length === 0)
const publicUrl = computed(() => (data.value ? absoluteUrl(data.value.profileUrl) : ''))
// The box is always shown with the pupil's public address (the profile is a public page, open to every role).
const showProfile = computed(() => !!data.value?.profileUrl)

const copied = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

async function copy(): Promise<void> {
  if (!(await copyText(publicUrl.value))) return
  copied.value = true
  clearTimeout(timer)
  timer = setTimeout(() => {
    copied.value = false
  }, 2000)
}

// Padam (B-056): the dialog names no post; the confirmed delete reloads the feed.
const dialogOpen = ref(false)
const pending = ref<TimelinePost | null>(null)
const deleting = ref(false)
const deleteError = ref('')

function askDelete(post: TimelinePost): void {
  pending.value = post
  deleteError.value = ''
  dialogOpen.value = true
}

async function confirmDelete(): Promise<void> {
  const post = pending.value
  if (!post || deleting.value) return
  deleting.value = true
  deleteError.value = ''
  try {
    await deleteTimelinePost(post.id)
    dialogOpen.value = false
    pending.value = null
    await reload()
  } catch (err) {
    // A post that is already gone (404) is gone: close and refresh; any other failure keeps the dialog open.
    if (isApiError(err) && err.status === 404) {
      dialogOpen.value = false
      pending.value = null
      await reload()
    } else {
      deleteError.value = LOAD_ERROR
    }
  } finally {
    deleting.value = false
  }
}

onBeforeUnmount(() => {
  clearTimeout(timer)
})
</script>

<template>
  <DsPage
    title="📸 Timeline Saya"
    subtitle="Aktiviti terkini anda — latihan, pencapaian &amp; mata diperoleh"
    data-testid="timeline-page"
  >
    <template v-if="data" #actions>
      <UButton
        to="/timeline/create"
        icon="i-ph-plus"
        label="Tambah Post"
        size="lg"
        data-testid="add-post"
      />
    </template>

    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <div v-if="empty" data-testid="timeline-empty">
        <DsEmptyState
          title="Timeline Kosong"
          description="Belum ada aktiviti lagi. Mula buat latihan untuk mengisi timeline anda dengan pencapaian dan mata!"
          icon="images"
          friend="aisyah"
        >
          <template #actions>
            <UButton
              to="/timeline/create"
              icon="i-ph-plus"
              label="Tambah Post Pertama"
              size="lg"
              data-testid="add-first"
            />
          </template>
        </DsEmptyState>
      </div>

      <DsStack v-else gap="lg" data-testid="timeline-feed">
        <DsStack
          v-for="day in days"
          :key="day.key"
          as="section"
          gap="md"
          :data-day="day.key"
          data-testid="timeline-day"
        >
          <DsCluster gap="sm" :wrap="false">
            <UBadge color="primary" variant="soft" :label="day.badge" class="shrink-0" data-testid="day-badge" />
            <DsHeading :level="2" variant="label" wrap="anywhere" data-testid="day-heading">{{ day.heading }}</DsHeading>
          </DsCluster>
          <DsStack as="ol" gap="md" data-testid="timeline-posts">
            <li v-for="row in day.rows" :key="rowKey(row)" class="min-w-0" :data-kind="row.kind" data-testid="timeline-row">
              <DsCluster v-if="row.kind === 'session'" gap="md" align="start" :wrap="false">
                <DsIconChip icon="notebook" accent="action" size="sm" />
                <DsStack gap="2xs" class="grow">
                  <DsText variant="label" tone="highlighted" wrap="anywhere" data-testid="session-title">{{ sessionTitle(row) }}</DsText>
                  <DsText variant="caption" wrap="anywhere" data-testid="session-detail">{{ sessionDetail(row) }}</DsText>
                </DsStack>
                <DsText as="time" variant="meta" class="shrink-0" :datetime="row.at" data-testid="row-time">{{ rowTime(row) }}</DsText>
              </DsCluster>

              <DsCluster v-else-if="row.kind === 'badge'" gap="md" align="start" :wrap="false">
                <DsText v-if="badgeEmoji(row.icon)" as="span" variant="heading" class="shrink-0" data-testid="badge-emoji">{{ badgeEmoji(row.icon) }}</DsText>
                <DsIconChip v-else icon="medal" accent="win" size="sm" data-testid="badge-icon" />
                <DsStack gap="2xs" class="grow">
                  <DsText variant="label" tone="highlighted" wrap="anywhere" data-testid="badge-title">{{ badgeTitle(row) }}</DsText>
                </DsStack>
                <DsText as="time" variant="meta" class="shrink-0" :datetime="row.at" data-testid="row-time">{{ rowTime(row) }}</DsText>
              </DsCluster>

              <DsCluster v-else gap="md" align="start" :wrap="false">
                <DsIconChip icon="image" accent="heat" size="sm" />
                <DsStack gap="sm" class="grow">
                  <PostCard :post="row.post" />
                  <DsCluster justify="end">
                    <UButton
                      type="button"
                      color="error"
                      variant="soft"
                      size="md"
                      label="Padam"
                      data-testid="post-delete"
                      @click="askDelete(row.post)"
                    >
                      <template #leading><DsIcon name="trash" /></template>
                    </UButton>
                  </DsCluster>
                </DsStack>
              </DsCluster>
            </li>
          </DsStack>
        </DsStack>
      </DsStack>

      <DsPanel v-if="showProfile" data-testid="public-profile-box">
        <div class="flex items-center gap-3">
        <DsIconChip icon="i-ph-globe" accent="friend" size="sm" />
        <div class="min-w-0 flex-1">
          <p class="text-label text-highlighted">Profil Awam Anda</p>
          <ULink
            :href="publicUrl"
            target="_blank"
            class="block min-h-6 text-caption break-all text-primary-t"
            data-testid="public-url"
            >{{ publicUrl }}</ULink
          >
        </div>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          size="lg"
          :icon="copied ? 'i-ph-check' : 'i-ph-copy'"
          :aria-label="copied ? 'Disalin' : 'Salin pautan'"
          data-testid="copy-url"
          :data-copied="copied"
          @click="copy"
        />
        </div>
      </DsPanel>

      <DsDialog
        v-model:open="dialogOpen"
        title="Padam catatan ini?"
        tone="error"
        size="sm"
        :loading="deleting"
        data-testid="delete-dialog"
      >
        <DsStack gap="sm">
          <DsText variant="body" data-testid="delete-body">Catatan ini akan dipadam secara kekal.</DsText>
          <DsText v-if="deleteError" variant="caption" tone="error" data-testid="delete-error">{{ deleteError }}</DsText>
        </DsStack>
        <template #footer>
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            label="Batal"
            autofocus
            :disabled="deleting"
            data-testid="delete-cancel"
            @click="dialogOpen = false"
          />
          <UButton
            type="button"
            color="error"
            label="Padam"
            :loading="deleting"
            data-testid="delete-confirm"
            @click="confirmDelete"
          />
        </template>
      </DsDialog>
    </template>
    <div v-else-if="!error" class="flex flex-col gap-4 md:gap-6" aria-busy="true" data-testid="page-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
