<script setup lang="ts">
/**
 * S20 `/video/tambah` "Tambah Video Baru" and S19 `/video/:id/edit` "Edit Video" (M09-T3;
 * FR-M09-87..92, BR-M09-17/21, URS FT-M09-6.4/6.5). One form for both:
 *
 * - URL field with the 500 ms debounced platform preview ("Platform dikesan: {label}" + thumbnail;
 *   nothing for an unsupported URL, which is still accepted). S19 starts with the stored spelling
 *   ("Youtube"). The thumbnail is the live img.youtube.com image (D22).
 * - Native validation (`required`, `type=url`) on `video_url`, `title`, `category`; server 422 field
 *   messages show under the fields (UNVERIFIED COPY).
 * - "Sekolah Saya" is enabled only when `GET /api/videos/form-context` returns a video-form school.
 * - S20 shows the uploader strip; S19 does not. S19 is for the uploader or the admin: anyone else is
 *   sent to their landing page (the API answers 403, M09 §9); an unknown id is the 404 page.
 */
import {
  AlignLeft,
  ArrowLeft,
  BookOpen,
  CircleCheck,
  Eye,
  Globe,
  Heading,
  Info,
  Link as LinkIcon,
  Pencil,
  Plus,
  Save,
  School,
  Tag,
  Upload,
} from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import {
  FORM_ERROR_MODIFIER,
  FORM_ERROR_TEXT_CLASS,
  FORM_INPUT_CLASS,
  FORM_TEXTAREA_CLASS,
} from '@/components/form'
import { useApi, useDebounce, useFlash, usePageMeta, useSession } from '@/composables'

import { fetchSubjectOptions } from '../api/admin-media'
import { createVideo, fetchVideoFormContext, updateVideo } from '../api/content'
import type { VideoCategory, VideoInput, VideoVisibility } from '../api/types'
import { fetchVideoForEdit } from '../lib/video-edit-api'
import VideoThumb from '../components/video/VideoThumb.vue'
import {
  CATEGORY_OPTIONS,
  COPY,
  VIDEO_PATH,
  VIDEO_TITLES,
  detectPlatform,
  errorLines,
  fieldErrors,
  isStatus,
  videoPath,
  type DetectedPlatform,
} from '../lib/video'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: number }>(), { id: 0 })

const router = useRouter()
const flash = useFlash()
const pageMeta = usePageMeta()
const session = useSession()

const isEdit = computed(() => props.mode === 'edit')

const { data: context } = useApi((signal) => fetchVideoFormContext({ signal }))
const { data: subjectList } = useApi((signal) => fetchSubjectOptions({ signal }))
const { data: video, error: videoError } = useApi(
  (signal) => (isEdit.value ? fetchVideoForEdit(props.id, { signal }) : Promise.resolve(null)),
  () => props.id,
)

const subjects = computed(() => [...(subjectList.value?.data ?? [])].sort((a, b) => a.id - b.id))

// --- guards of S19 -------------------------------------------------------------------------------

const notFound = computed(() => isStatus(videoError.value, 404))
watch(
  notFound,
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

/** Not the uploader and not the admin: refused; the SPA sends the user to their landing page. */
const refused = computed(() => isEdit.value && video.value !== null && !video.value.canManage)
watch(
  refused,
  (is403) => {
    if (!is403) return
    const landing = session.landingPath.value
    if (landing && landing !== '/video' && !landing.startsWith('/video/')) {
      void router.replace(landing)
    } else {
      setRouteOutcome(403)
    }
  },
  { immediate: true },
)

// --- form state ----------------------------------------------------------------------------------

interface FormState {
  videoUrl: string
  title: string
  description: string
  category: VideoCategory | ''
  subjectId: number | ''
  visibility: VideoVisibility
}

const form = reactive<FormState>({
  videoUrl: '',
  title: '',
  description: '',
  category: '',
  subjectId: '',
  visibility: 'global',
})

const preview = ref<DetectedPlatform | null>(null)

// A stored "school" visibility without a video-form school cannot stay selected: the radio is
// disabled, so the form shows "Semua Pengguna" (live form semantics).
function normalizeVisibility(): void {
  if (context.value !== null && context.value.school === null && form.visibility === 'school') {
    form.visibility = 'global'
  }
}

const parseUrl = useDebounce(() => {
  preview.value = detectPlatform(form.videoUrl)
}, 500)

watch(
  video,
  (row) => {
    if (!row) return
    form.videoUrl = row.videoUrl
    form.title = row.title
    form.description = row.description ?? ''
    form.category = row.category
    form.subjectId = row.subject?.id ?? ''
    form.visibility = row.visibility
    normalizeVisibility()
    preview.value = { label: row.platform, thumbnailUrl: row.thumbnailUrl }
    pageMeta.setHeader({ title: COPY.editHeader, subtitle: row.title })
    pageMeta.setTitle(VIDEO_TITLES.edit(row.title))
  },
  { immediate: true },
)

const school = computed(() => context.value?.school ?? null)

watch([context, video], normalizeVisibility)
const ready = computed(
  () =>
    context.value !== null &&
    subjectList.value !== null &&
    (!isEdit.value || (video.value !== null && video.value.canManage)),
)

const busy = ref(false)
const failure = ref<string[]>([])
const errors = ref<Record<string, string>>({})

function body(): VideoInput {
  return {
    videoUrl: form.videoUrl.trim(),
    title: form.title.trim(),
    description: form.description.trim() === '' ? null : form.description,
    category: form.category as VideoCategory,
    subjectId: form.subjectId === '' ? null : form.subjectId,
    visibility: form.visibility,
  }
}

async function submit(): Promise<void> {
  if (busy.value) return
  busy.value = true
  failure.value = []
  errors.value = {}
  try {
    const result = isEdit.value ? await updateVideo(props.id, body()) : await createVideo(body())
    flash.success(result.status)
    await router.push(isEdit.value ? videoPath(props.id) : VIDEO_PATH)
  } catch (err) {
    failure.value = errorLines(err)
    errors.value = fieldErrors(err)
  } finally {
    busy.value = false
  }
}

const backTo = computed(() => (isEdit.value ? videoPath(props.id) : VIDEO_PATH))

const CARD = 'rounded-2xl bg-white p-4 shadow sm:p-6'
const LABEL = 'mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800'
const field = (name: string) => [errors.value[name] ? FORM_ERROR_MODIFIER : '']
const OPTION_CARD =
  'flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-slate-200 px-3 py-3 text-center transition peer-checked:border-emerald-400 peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-50'
</script>

<template>
  <div class="mx-auto max-w-3xl min-w-0" data-testid="video-form-page">
    <AlertBox
      v-if="videoError && !notFound"
      :messages="errorLines(videoError)"
      data-testid="video-form-load-error"
    />

    <div v-else-if="ready" class="space-y-5 sm:space-y-6">
      <div class="flex items-center gap-3">
        <RouterLink
          :to="backTo"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
          aria-label="Kembali"
          data-testid="video-form-back"
        >
          <ArrowLeft class="h-5 w-5" aria-hidden="true" />
        </RouterLink>
        <div class="min-w-0">
          <h1
            class="flex items-center gap-2 font-heading text-xl font-bold text-slate-900"
            data-testid="video-form-h1"
          >
            <Pencil v-if="isEdit" class="h-5 w-5 shrink-0 text-blue-500" aria-hidden="true" />
            <Plus
              v-else
              class="h-5 w-5 shrink-0 rounded-full bg-red-500 p-0.5 text-white"
              aria-hidden="true"
            />
            {{ isEdit ? COPY.editHeader : COPY.addH1 }}
          </h1>
          <p class="text-sm text-slate-500" data-testid="video-form-sub">
            {{ isEdit ? COPY.editSub : COPY.addSub }}
          </p>
        </div>
      </div>

      <form class="space-y-5 sm:space-y-6" data-testid="video-form" @submit.prevent="submit">
        <AlertBox :messages="failure" data-testid="video-form-error" />

        <!-- URL and the detected platform. -->
        <div :class="CARD">
          <label for="video_url" :class="LABEL">
            <LinkIcon class="h-4 w-4 text-red-500" aria-hidden="true" />
            {{ COPY.urlLabel }} <span class="text-red-500">*</span>
          </label>
          <input
            id="video_url"
            v-model="form.videoUrl"
            type="url"
            name="video_url"
            required
            :placeholder="COPY.urlPlaceholder"
            :class="[FORM_INPUT_CLASS, 'min-h-11', ...field('videoUrl')]"
            data-testid="video-url"
            @input="parseUrl()"
          />
          <p v-if="errors.videoUrl" :class="FORM_ERROR_TEXT_CLASS" data-testid="field-error">
            {{ errors.videoUrl }}
          </p>
          <p class="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
            <Info class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {{ COPY.urlHint }}
          </p>
          <div
            v-if="preview"
            class="mt-3 flex items-center gap-3 rounded-xl bg-slate-50 p-3"
            data-testid="video-preview"
          >
            <div class="h-14 w-24 shrink-0 overflow-hidden rounded-lg bg-slate-200">
              <VideoThumb v-if="preview.thumbnailUrl" :thumbnail-url="preview.thumbnailUrl" />
            </div>
            <p
              class="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-slate-700"
              data-testid="video-preview-label"
            >
              <CircleCheck class="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
              {{ COPY.detected(preview.label) }}
            </p>
          </div>
        </div>

        <!-- Title and description. -->
        <div :class="[CARD, 'space-y-4']">
          <div>
            <label for="title" :class="LABEL">
              <Heading class="h-4 w-4 text-orange-500" aria-hidden="true" />
              {{ COPY.titleLabel }} <span class="text-red-500">*</span>
            </label>
            <input
              id="title"
              v-model="form.title"
              type="text"
              name="title"
              required
              maxlength="255"
              :placeholder="COPY.titlePlaceholder"
              :class="[FORM_INPUT_CLASS, 'min-h-11', ...field('title')]"
              data-testid="video-title-input"
            />
            <p v-if="errors.title" :class="FORM_ERROR_TEXT_CLASS" data-testid="field-error">
              {{ errors.title }}
            </p>
          </div>
          <div>
            <label for="description" :class="LABEL">
              <AlignLeft class="h-4 w-4 text-slate-400" aria-hidden="true" />
              {{ COPY.descriptionLabel }}
              <span v-if="!isEdit" class="text-xs font-normal text-slate-400">{{
                COPY.optional
              }}</span>
            </label>
            <textarea
              id="description"
              v-model="form.description"
              name="description"
              rows="3"
              maxlength="1000"
              :placeholder="COPY.descriptionPlaceholder"
              :class="[FORM_TEXTAREA_CLASS, ...field('description')]"
              data-testid="video-description-input"
            />
            <p v-if="errors.description" :class="FORM_ERROR_TEXT_CLASS" data-testid="field-error">
              {{ errors.description }}
            </p>
          </div>
        </div>

        <!-- Category, subject, visibility. -->
        <div :class="CARD">
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="min-w-0">
              <label for="category" :class="LABEL">
                <Tag class="h-4 w-4 text-orange-500" aria-hidden="true" />
                {{ COPY.categoryLabel }} <span class="text-red-500">*</span>
              </label>
              <select
                id="category"
                v-model="form.category"
                name="category"
                required
                :class="[FORM_INPUT_CLASS, 'min-h-11', ...field('category')]"
                data-testid="video-category-input"
              >
                <option v-if="!isEdit" value="">{{ COPY.categoryPlaceholder }}</option>
                <option v-for="o in CATEGORY_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </select>
              <p v-if="errors.category" :class="FORM_ERROR_TEXT_CLASS" data-testid="field-error">
                {{ errors.category }}
              </p>
            </div>
            <div class="min-w-0">
              <label for="subject_id" :class="LABEL">
                <BookOpen class="h-4 w-4 text-indigo-500" aria-hidden="true" />
                {{ COPY.subjectLabel }}
                <span v-if="!isEdit" class="text-xs font-normal text-slate-400">{{
                  COPY.optional
                }}</span>
              </label>
              <select
                id="subject_id"
                v-model="form.subjectId"
                name="subject_id"
                :class="[FORM_INPUT_CLASS, 'min-h-11', ...field('subjectId')]"
                data-testid="video-subject-input"
              >
                <option value="">{{ COPY.subjectNone }}</option>
                <option v-for="s in subjects" :key="s.id" :value="s.id">{{ s.name }}</option>
              </select>
            </div>
          </div>

          <fieldset class="mt-5 min-w-0">
            <legend :class="LABEL">
              <Eye class="h-4 w-4 text-emerald-500" aria-hidden="true" />
              {{ COPY.visibilityLabel }} <span class="text-red-500">*</span>
            </legend>
            <div class="grid grid-cols-2 gap-3">
              <div class="relative min-w-0">
                <input
                  id="visibility_global"
                  v-model="form.visibility"
                  type="radio"
                  name="visibility"
                  value="global"
                  class="peer sr-only"
                  data-testid="video-visibility-global"
                />
                <label for="visibility_global" :class="OPTION_CARD">
                  <Globe class="h-5 w-5" aria-hidden="true" />
                  <span class="text-sm font-semibold">{{ COPY.visibilityGlobal }}</span>
                  <span v-if="!isEdit" class="text-xs text-slate-500">{{
                    COPY.visibilityGlobalHint
                  }}</span>
                </label>
              </div>
              <div class="relative min-w-0">
                <input
                  id="visibility_school"
                  v-model="form.visibility"
                  type="radio"
                  name="visibility"
                  value="school"
                  :disabled="school === null"
                  class="peer sr-only"
                  data-testid="video-visibility-school"
                />
                <label for="visibility_school" :class="OPTION_CARD">
                  <School class="h-5 w-5" aria-hidden="true" />
                  <span class="text-sm font-semibold">{{ COPY.visibilitySchool }}</span>
                  <span
                    v-if="school || !isEdit"
                    class="text-xs text-slate-500"
                    data-testid="video-school-hint"
                    >{{ school ? school.name : COPY.visibilityNoSchool }}</span
                  >
                </label>
              </div>
            </div>
            <p v-if="errors.visibility" :class="FORM_ERROR_TEXT_CLASS" data-testid="field-error">
              {{ errors.visibility }}
            </p>
          </fieldset>
        </div>

        <!-- Uploader strip (S20 only). -->
        <div
          v-if="!isEdit && context"
          class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white/70 p-3 shadow-sm"
          data-testid="video-uploader-strip"
        >
          <div class="flex min-w-0 items-center gap-3">
            <span
              class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-red-500 to-orange-500 text-sm font-bold text-white"
              >{{ context.uploader.initial }}</span
            >
            <p class="min-w-0 truncate text-sm text-slate-700">
              <span class="font-semibold" data-testid="video-strip-name">{{
                context.uploader.name
              }}</span>
              <span class="mx-1.5 text-slate-400" aria-hidden="true">·</span>
              <span class="capitalize" data-testid="video-strip-role">{{
                context.uploader.roleLabel
              }}</span>
            </p>
          </div>
          <p class="flex items-center gap-1.5 text-xs text-slate-500">
            <Info class="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {{ COPY.uploaderNote }}
          </p>
        </div>

        <!-- Footer: one row at every width. -->
        <div class="flex flex-nowrap items-center gap-3" data-testid="video-form-footer">
          <button
            type="submit"
            :disabled="busy"
            :class="[
              'inline-flex h-12 min-w-0 items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold whitespace-nowrap text-white shadow transition focus:outline-none focus-visible:ring-2 disabled:cursor-wait disabled:opacity-60',
              isEdit
                ? 'bg-linear-to-r from-blue-500 to-indigo-600 focus-visible:ring-blue-300'
                : 'bg-linear-to-r from-red-500 to-orange-500 focus-visible:ring-orange-300',
            ]"
            data-testid="video-form-submit"
          >
            <Save v-if="isEdit" class="h-4 w-4" aria-hidden="true" />
            <Upload v-else class="h-4 w-4" aria-hidden="true" />
            {{ isEdit ? COPY.save : COPY.publish }}
          </button>
          <RouterLink
            :to="backTo"
            class="inline-flex h-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            data-testid="video-form-cancel"
          >
            {{ COPY.cancel }}
          </RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
