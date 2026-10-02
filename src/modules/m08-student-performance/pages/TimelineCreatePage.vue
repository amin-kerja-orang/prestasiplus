<script setup lang="ts">
/**
 * S17 `/timeline/create` "Post Baru" (M08-T3; FR-M08-100..103, BR-M08-34, FN-M08-6.2.*): native HTML5
 * validation, the photo drop zone with previews and per-file captions (DV-30: a typed caption stays with its
 * file), and `POST /api/timeline`. 201 goes to `/timeline`; a 422 shows its messages above the form and keeps
 * every value. Photo uploads are simulated by the mock; the page only previews them.
 */
import { CloudUpload, Send, Tag, X, ArrowLeft } from '@lucide/vue'
import { computed, onBeforeUnmount, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { AlertBox } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS,
  FORM_SELECT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'
import { alertNative } from '@/components/overlay/native-dialogs'

import { createTimelinePost } from '../api/performance'
import type { TimelineCategory } from '../api/types'
import { LOAD_ERROR } from '../lib/prestasi/load'
import { CATEGORY_OPTIONS, appendFiles, removeAt, type PhotoItem } from '../lib/timeline/posts'

const router = useRouter()

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
      alertNative(`${name} terlalu besar (maks 2MB)`)
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

const LABEL = 'mb-1.5 block text-sm font-semibold text-slate-700'
const field = (name: string): string[] => [
  FORM_INPUT_CLASS,
  ...(errors.value[name] ? [FORM_ERROR_MODIFIER] : []),
]
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="timeline-create-page">
    <RouterLink
      to="/timeline"
      class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-600 hover:text-slate-800"
      data-testid="back-link"
    >
      <ArrowLeft class="h-4 w-4" /> Kembali ke Timeline
    </RouterLink>

    <div class="rounded-2xl bg-white shadow-sm">
      <h2
        class="flex items-center gap-2 border-b border-slate-100 px-4 py-5 text-xl font-bold text-slate-800 sm:px-6"
      >
        📸 Post Baru
      </h2>

      <form class="space-y-5 p-4 sm:p-6" data-testid="timeline-form" @submit.prevent="submit">
        <AlertBox :messages="messages" />

        <div>
          <label for="tl-title" :class="LABEL">Tajuk <span class="text-red-500">*</span></label>
          <input
            id="tl-title"
            v-model="title"
            type="text"
            name="title"
            required
            maxlength="150"
            placeholder="cth: Sijil Kecemerlangan Matematik 2026"
            :class="field('title')"
          />
          <p v-if="errors.title" :class="FORM_ERROR_TEXT_CLASS">{{ errors.title }}</p>
        </div>

        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label for="tl-category" :class="LABEL"
              >Kategori <span class="text-red-500">*</span></label
            >
            <select
              id="tl-category"
              v-model="category"
              name="category"
              required
              :class="[FORM_SELECT_CLASS, errors.category ? FORM_ERROR_MODIFIER : '']"
            >
              <option v-for="o in CATEGORY_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </select>
          </div>
          <div>
            <label for="tl-date" :class="LABEL">Tarikh Acara</label>
            <input
              id="tl-date"
              v-model="eventDate"
              type="date"
              name="event_date"
              :class="field('eventDate')"
            />
            <p v-if="errors.eventDate" :class="FORM_ERROR_TEXT_CLASS">{{ errors.eventDate }}</p>
          </div>
        </div>

        <div>
          <label for="tl-story" :class="LABEL">Cerita / Keterangan</label>
          <textarea
            id="tl-story"
            v-model="story"
            name="story"
            rows="4"
            maxlength="2000"
            placeholder="Ceritakan pengalaman anda..."
            :class="[FORM_TEXTAREA_CLASS, errors.story ? FORM_ERROR_MODIFIER : '']"
          ></textarea>
          <p class="mt-1 text-xs text-slate-500">Maks 2000 aksara</p>
        </div>

        <div>
          <p :class="LABEL">
            Gambar <span class="text-red-500">*</span>
            <span class="text-xs font-normal text-slate-500">(Maks 5 gambar, 2MB setiap satu)</span>
          </p>
          <label
            id="dropZone"
            for="photoInput"
            class="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition"
            :class="
              dragging
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-slate-300 hover:border-indigo-300'
            "
            data-testid="drop-zone"
            @dragover.prevent="dragging = true"
            @dragleave.prevent="dragging = false"
            @drop.prevent="onDrop"
          >
            <span
              class="flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-500"
            >
              <CloudUpload class="h-6 w-6" />
            </span>
            <span class="mt-3 text-sm font-medium text-slate-700"
              >Klik atau seret gambar ke sini</span
            >
            <span class="mt-1 text-xs text-slate-500">JPG, PNG, WEBP • Maks 2MB • 1-5 gambar</span>
          </label>
          <input
            id="photoInput"
            type="file"
            name="photos[]"
            accept="image/jpeg,image/png,image/webp"
            multiple
            class="sr-only"
            data-testid="photo-input"
            @change="onPick"
          />
          <p v-if="errors.photos" :class="FORM_ERROR_TEXT_CLASS">{{ errors.photos }}</p>

          <div
            v-if="items.length"
            class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5"
            data-testid="photo-previews"
          >
            <div
              v-for="(it, i) in items"
              :key="it.key"
              class="relative aspect-square overflow-hidden rounded-xl bg-slate-100"
              data-testid="photo-preview"
            >
              <img :src="it.preview" alt="Preview" class="h-full w-full object-cover" />
              <button
                type="button"
                class="absolute top-1 right-1 flex h-11 w-11 items-center justify-center rounded-full bg-red-500 text-white shadow"
                data-testid="photo-remove"
                @click="remove(i)"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
          </div>

          <div v-if="items.length" class="mt-4 space-y-2" data-testid="caption-fields">
            <p class="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Tag class="h-4 w-4" /> Keterangan Gambar (opsional)
            </p>
            <input
              v-for="(it, i) in items"
              :key="it.key"
              v-model="it.caption"
              type="text"
              name="captions[]"
              maxlength="200"
              :placeholder="`Keterangan gambar ${String(i + 1)}...`"
              :class="FORM_INPUT_CLASS"
              data-testid="caption-input"
            />
          </div>
        </div>

        <div class="flex items-center justify-end gap-3 pt-2">
          <RouterLink
            to="/timeline"
            class="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
            data-testid="cancel"
            >Batal</RouterLink
          >
          <button
            type="submit"
            :disabled="sending"
            class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2.5 text-sm font-bold text-white shadow transition hover:opacity-90 disabled:opacity-60"
            data-testid="submit"
          >
            <Send class="h-4 w-4" /> Terbitkan
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
