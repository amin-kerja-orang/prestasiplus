<script setup lang="ts">
/**
 * S8 `/admin/notes/:id` "Lihat Nota - Admin PRESTASIPLUS" (FR-M09-49, FR-M09-20; DV-M09-04,
 * DV-M09-05). Shell header = the note title / "Paparan nota". Card: title, author, date, views,
 * downloads, status, summary, the Subjek / Tahap / Jenis grid and the stored body printed as escaped
 * text that wraps anywhere inside the card. An unknown id returns to S5 without a flash.
 */
import { Calendar, Download, Eye, SquarePen, User } from '@lucide/vue'
import { computed, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'

import { fetchAdminNote } from '../api/admin-articles-notes'
import AdminBackLink from '../components/admin-articles-notes/AdminBackLink.vue'
import AdminStatusPill from '../components/admin-articles-notes/AdminStatusPill.vue'
import {
  COPY,
  NOTES_LIST_PATH,
  PRIMARY_BUTTON_CLASS,
  isNotFoundError,
  noteGradeText,
  noteSubjectText,
  previewDate,
} from '../lib/admin-articles-notes'

const props = defineProps<{ id: string }>()

const router = useRouter()
const meta = usePageMeta()

const numericId = computed(() => (/^\d+$/.test(props.id) ? Number(props.id) : null))

const { data: note, error } = useApi(
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

const LABEL = 'text-xs font-bold tracking-wide text-slate-500 uppercase'
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="admin-note-preview-page">
    <AdminBackLink :to="NOTES_LIST_PATH" />

    <AlertBox v-if="failed" :messages="COPY.loadFailed" data-testid="admin-note-load-error" />

    <article
      v-else-if="note"
      class="min-w-0 space-y-4 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="admin-note-card"
    >
      <h1
        class="font-heading text-2xl font-bold [overflow-wrap:anywhere] text-slate-800"
        data-testid="preview-title"
      >
        {{ note.title }}
      </h1>

      <div class="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
        <span
          v-if="note.author"
          class="inline-flex items-center gap-1.5"
          data-testid="preview-author"
        >
          <User class="h-4 w-4" aria-hidden="true" />{{ note.author.name }}
        </span>
        <span class="inline-flex items-center gap-1.5" data-testid="preview-date">
          <Calendar class="h-4 w-4" aria-hidden="true" />{{ previewDate(note.createdAt) }}
        </span>
        <span class="inline-flex items-center gap-1.5" data-testid="preview-views">
          <Eye class="h-4 w-4" aria-hidden="true" />{{ note.views }} tontonan
        </span>
        <span class="inline-flex items-center gap-1.5" data-testid="preview-downloads">
          <Download class="h-4 w-4" aria-hidden="true" />{{ note.downloads }} muat turun
        </span>
      </div>

      <div><AdminStatusPill :published="note.isPublished" /></div>

      <p
        v-if="note.summary"
        class="[overflow-wrap:anywhere] text-slate-600"
        data-testid="preview-summary"
      >
        {{ note.summary }}
      </p>

      <dl class="grid grid-cols-3 gap-4 rounded-xl bg-slate-50 p-4" data-testid="preview-details">
        <div class="min-w-0">
          <dt :class="LABEL">Subjek</dt>
          <dd
            class="text-sm font-semibold break-words text-slate-800"
            data-testid="preview-subject"
          >
            {{ noteSubjectText(note.subject) }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt :class="LABEL">Tahap</dt>
          <dd class="text-sm font-semibold break-words text-slate-800" data-testid="preview-grade">
            {{ noteGradeText(note.grade) }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt :class="LABEL">Jenis</dt>
          <dd class="text-sm font-semibold break-words text-slate-800" data-testid="preview-type">
            {{ note.noteType }}
          </dd>
        </div>
      </dl>

      <!-- Escaped text, never rendered (DV-M09-04); wraps anywhere (DV-M09-05). -->
      <div
        class="border-t border-slate-100 pt-4 text-sm [overflow-wrap:anywhere] text-slate-700"
        data-testid="preview-body"
      >
        {{ note.content }}
      </div>

      <div>
        <RouterLink
          :to="`${NOTES_LIST_PATH}/${note.id}/edit`"
          :class="PRIMARY_BUTTON_CLASS"
          data-testid="preview-edit"
        >
          <SquarePen class="h-4 w-4" aria-hidden="true" />
          Edit Nota
        </RouterLink>
      </div>
    </article>
  </div>
</template>
