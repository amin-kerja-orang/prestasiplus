<script setup lang="ts">
/**
 * S8 `/admin/notes/:id` "Lihat Nota - Admin PRESTASIPLUS" (FR-M09-47..49; DV-M09-04, DV-M09-05), v2 staff theme.
 *
 * - Shell header = the note title / "Paparan nota" (set once the note has loaded).
 * - Card: title, author, created date, views, downloads, status badge, summary, the Subjek / Tahap / Jenis
 *   details and the stored body printed as escaped text (never rendered as HTML).
 * - An unknown id (or a non-numeric one) returns to S5 without a flash.
 */
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, usePageMeta } from '@/composables'
import { DsLoadError, DsPage, DsPanel, DsStatusBadge, DsStack, DsHeading, DsText } from '@/ds'

import { fetchAdminNote } from '../api/admin-articles-notes'
import {
  COPY,
  NOTES_LIST_PATH,
  isNotFoundError,
  noteGradeText,
  noteSubjectText,
  previewDate,
} from '../lib/admin-articles-notes'

const props = defineProps<{ id: string }>()

const router = useRouter()
const meta = usePageMeta()

const numericId = computed(() => (/^\d+$/.test(props.id) ? Number(props.id) : null))

const {
  data: note,
  error,
  reload,
} = useApi(
  (signal) => fetchAdminNote(numericId.value ?? 0, { signal }),
  () => props.id,
  { immediate: numericId.value !== null },
)

function backToList(): void {
  void router.replace(NOTES_LIST_PATH)
}

if (numericId.value === null) backToList()

watch(error, (err) => {
  if (err && isNotFoundError(err)) backToList()
})

watch(note, (loaded) => {
  if (loaded) meta.setHeader({ title: loaded.title, subtitle: 'Paparan nota' })
})

const failed = computed(() => error.value !== null && !isNotFoundError(error.value))
</script>

<template>
  <DsPage
    :back-to="NOTES_LIST_PATH"
    back-label="Kembali ke Senarai"
    data-testid="admin-note-preview-page"
  >
    <DsLoadError
      v-if="failed"
      :message="COPY.loadFailed"
      testid="admin-note-load-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="note" data-testid="admin-note-card">
      <article class="flex min-w-0 flex-col gap-6 p-2 sm:p-4">
        <DsStack gap="sm">
          <div>
            <DsStatusBadge
              :status="note.isPublished ? 'published' : 'draft'"
              data-testid="status-pill"
            />
          </div>
          <DsHeading :level="1" wrap="anywhere" data-testid="preview-title">
            {{ note.title }}
          </DsHeading>
          <div class="flex flex-wrap items-center gap-x-6 gap-y-2 text-body text-muted">
            <span
              v-if="note.author"
              class="inline-flex items-center gap-2"
              data-testid="preview-author"
            >
              <UIcon name="i-ph-user" class="size-5" aria-hidden="true" />{{ note.author.name }}
            </span>
            <span class="inline-flex items-center gap-2" data-testid="preview-date">
              <UIcon name="i-ph-calendar-blank" class="size-5" aria-hidden="true" />{{
                previewDate(note.createdAt)
              }}
            </span>
            <span class="inline-flex items-center gap-2" data-testid="preview-views">
              <UIcon name="i-ph-eye" class="size-5" aria-hidden="true" />{{ note.views }} tontonan
            </span>
            <span class="inline-flex items-center gap-2" data-testid="preview-downloads">
              <UIcon name="i-ph-download-simple" class="size-5" aria-hidden="true" />{{
                note.downloads
              }}
              muat turun
            </span>
          </div>
        </DsStack>

        <DsText
          v-if="note.summary"
          variant="body"
          tone="muted"
          wrap="anywhere"
          data-testid="preview-summary"
        >
          {{ note.summary }}
        </DsText>

        <dl class="grid grid-cols-1 gap-4 sm:grid-cols-3" data-testid="preview-details">
          <DsStack gap="2xs">
            <DsText variant="overline" as="dt">Subjek</DsText>
            <DsText
              variant="label"
              as="dd"
              tone="highlighted"
              wrap="anywhere"
              data-testid="preview-subject"
            >
              {{ noteSubjectText(note.subject) }}
            </DsText>
          </DsStack>
          <DsStack gap="2xs">
            <DsText variant="overline" as="dt">Tahap</DsText>
            <DsText
              variant="label"
              as="dd"
              tone="highlighted"
              wrap="anywhere"
              data-testid="preview-grade"
            >
              {{ noteGradeText(note.grade) }}
            </DsText>
          </DsStack>
          <DsStack gap="2xs">
            <DsText variant="overline" as="dt">Jenis</DsText>
            <DsText
              variant="label"
              as="dd"
              tone="highlighted"
              wrap="anywhere"
              data-testid="preview-type"
            >
              {{ note.noteType }}
            </DsText>
          </DsStack>
        </dl>

        <USeparator />

        <!-- Escaped text, never rendered (DV-M09-04); wraps anywhere (DV-M09-05). -->
        <div class="text-body break-words" data-testid="preview-body">
          {{ note.content }}
        </div>

        <div>
          <UButton
            :to="`${NOTES_LIST_PATH}/${note.id}/edit`"
            icon="i-ph-pencil-simple"
            label="Edit Nota"
            class="min-h-11"
            data-testid="preview-edit"
          />
        </div>
      </article>
    </DsPanel>
  </DsPage>
</template>
