<script setup lang="ts">
/**
 * S17 `/timeline/create` "Post Baru" (M08-T3; FR-M08-100..103, BR-M08-34, FN-M08-6.2.*): native HTML5
 * validation, the photo drop zone with previews and per-file captions (DV-30: a typed caption stays with its
 * file), and `POST /api/timeline`. 201 goes to `/timeline`; a 422 shows its messages above the form and keeps
 * every value. Photo uploads are simulated by the mock; the page only previews them.
 */
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useToast } from '@nuxt/ui/composables'

import { isApiError } from '@/api'
import { DsBackLink, DsIconChip, DsPage, DsPanel } from '@/ds'

import PhotoPreview from '../components/timeline/PhotoPreview.vue'

import { createTimelinePost } from '../api/performance'
import type { TimelineCategory } from '../api/types'
import { LOAD_ERROR } from '../lib/prestasi/load'
import { CATEGORY_OPTIONS, appendFiles, removeAt, type PhotoItem } from '../lib/timeline/posts'

const router = useRouter()
const toast = useToast()
const categoryItems = CATEGORY_OPTIONS.map((o) => ({ label: o.label, value: o.value }))

const title = ref('')
const category = ref<TimelineCategory>('cerita')
const eventDate = ref('')
const story = ref('')

interface Item extends PhotoItem {
  preview: string
}
const items = ref<Item[]>([])
let seq = 0

const sending = ref(false)
const errors = ref<Record<string, string>>({})
const failure = ref<string | null>(null)
const messages = computed(() => (failure.value ? [failure.value] : Object.values(errors.value)))

const previewOf = (f: File): string =>
  typeof URL.createObjectURL === 'function' ? URL.createObjectURL(f) : ''
const release = (url: string): void => {
  if (url && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url)
}

function handleFiles(list: FileList | File[] | null): void {
  if (!list) return
  const before = new Set(items.value.map((i) => i.key))
  const next = appendFiles(
    items.value,
    [...list],
    () => ++seq,
    (name) => {
      toast.add({ title: `${name} terlalu besar (maks 2MB)`, color: 'warning' })
    },
  )
  // Existing items keep their captions (DV-30); only the new ones get a preview.
  items.value = next.map((n) =>
    before.has(n.key) ? (n as Item) : { ...n, preview: previewOf(n.file) },
  )
}

function remove(index: number): void {
  const gone = items.value[index]
  if (gone) release(gone.preview)
  items.value = removeAt(items.value, index) as Item[]
}

function onPick(e: Event): void {
  const input = e.target as HTMLInputElement
  handleFiles(input.files)
  input.value = ''
}

const dragging = ref(false)
function onDrop(e: DragEvent): void {
  dragging.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

onBeforeUnmount(() => {
  items.value.forEach((i) => {
    release(i.preview)
  })
})

async function submit(): Promise<void> {
  if (sending.value) return
  sending.value = true
  errors.value = {}
  failure.value = null
  try {
    await createTimelinePost({
      title: title.value,
      category: category.value,
      ...(eventDate.value ? { eventDate: eventDate.value } : {}),
      ...(story.value ? { story: story.value } : {}),
      photos: items.value.map((i) => i.file),
      captions: items.value.map((i) => i.caption),
    })
    await router.push('/timeline')
  } catch (err) {
    if (isApiError(err) && err.status === 422 && err.fields) errors.value = err.fields
    else failure.value = LOAD_ERROR
  } finally {
    sending.value = false
  }
}

const fieldError = (name: string): string | undefined => errors.value[name]
</script>

<template>
  <DsPage title="📸 Post Baru" data-testid="timeline-create-page">
    <DsBackLink to="/timeline" label="Kembali ke Timeline" data-testid="back-link" />

    <DsPanel>
      <form class="flex flex-col gap-6" data-testid="timeline-form" @submit.prevent="submit">
        <UAlert
          v-if="messages.length"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          role="alert"
        >
          <template #description>
            <p v-for="m in messages" :key="m">{{ m }}</p>
          </template>
        </UAlert>

        <UFormField label="Tajuk" for="tl-title" required :error="fieldError('title')">
          <UInput
            id="tl-title"
            v-model="title"
            type="text"
            name="title"
            required
            maxlength="150"
            placeholder="cth: Sijil Kecemerlangan Matematik 2026"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <UFormField label="Kategori" for="tl-category" required :error="fieldError('category')">
            <USelect
              id="tl-category"
              v-model="category"
              name="category"
              :items="categoryItems"
              size="lg"
              class="w-full"
              data-testid="tl-category"
            />
          </UFormField>
          <UFormField label="Tarikh Acara" for="tl-date" :error="fieldError('eventDate')">
            <UInput
              id="tl-date"
              v-model="eventDate"
              type="date"
              name="event_date"
              size="lg"
              class="w-full"
            />
          </UFormField>
        </div>

        <UFormField
          label="Cerita / Keterangan"
          for="tl-story"
          hint="Maks 2000 aksara"
          :error="fieldError('story')"
        >
          <UTextarea
            id="tl-story"
            v-model="story"
            name="story"
            :rows="4"
            maxlength="2000"
            placeholder="Ceritakan pengalaman anda..."
            size="lg"
            class="w-full"
          />
        </UFormField>

        <div class="flex flex-col gap-3">
          <p class="text-label text-highlighted">
            Gambar <span class="text-error">*</span>
            <span class="text-caption text-muted">(Maks 5 gambar, 2MB setiap satu)</span>
          </p>
          <label
            id="dropZone"
            for="photoInput"
            class="flex min-h-11 cursor-pointer flex-col items-center gap-2 bg-elevated px-4 py-8 text-center"
            data-testid="drop-zone"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <DsIconChip :icon="dragging ? 'i-ph-download-simple' : 'i-ph-cloud-arrow-up'" accent="action" size="lg" />
            <span class="text-label text-highlighted">Klik atau seret gambar ke sini</span>
            <span class="text-caption text-muted">JPG, PNG, WEBP • Maks 2MB • 1-5 gambar</span>
          </label>
          <UInput
            id="photoInput"
            type="file"
            name="photos[]"
            accept="image/jpeg,image/png,image/webp"
            multiple
            class="sr-only"
            data-testid="photo-input"
            @change="onPick"
          />
          <p v-if="errors.photos" class="text-caption text-error">{{ errors.photos }}</p>

          <div
            v-if="items.length"
            class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
            data-testid="photo-previews"
          >
            <PhotoPreview
              v-for="(it, i) in items"
              :key="it.key"
              :src="it.preview"
              @remove="remove(i)"
            />
          </div>

          <div v-if="items.length" class="flex flex-col gap-2" data-testid="caption-fields">
            <p class="flex items-center gap-2 text-label text-highlighted">
              <UIcon name="i-ph-tag" class="size-4" aria-hidden="true" /> Keterangan Gambar
              (opsional)
            </p>
            <UInput
              v-for="(it, i) in items"
              :key="it.key"
              v-model="it.caption"
              type="text"
              name="captions[]"
              maxlength="200"
              :placeholder="`Keterangan gambar ${String(i + 1)}...`"
              size="lg"
              class="w-full"
              data-testid="caption-input"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-3">
          <UButton
            to="/timeline"
            color="neutral"
            variant="soft"
            size="lg"
            label="Batal"
            data-testid="cancel"
          />
          <UButton
            type="submit"
            :disabled="sending"
            :loading="sending"
            size="lg"
            icon="i-ph-paper-plane-tilt"
            label="Terbitkan"
            data-testid="submit"
          />
        </div>
      </form>
    </DsPanel>
  </DsPage>
</template>
