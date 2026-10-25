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
 *
 * v2 restyle (B04): AR-FORM cards with `UFormField`, `UInput`, `USelect`, `URadioGroup` (card
 * variant) and a `DsPage` shell.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isHttpMode, wireId } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useDebounce, useFlash, usePageMeta, useSession } from '@/composables'
import { DsFormBar, DsFormField, DsLoadError, DsPage, DsPanel } from '@/ds'

import { fetchSubjectOptions } from '../api/admin-media'
import { createVideo, fetchVideoFormContext, updateVideo } from '../api/content'
import type { VideoCategory, VideoInput, VideoVisibility } from '../api/types'
import { fetchVideoForEdit } from '../lib/video-edit-api'
import VideoThumb from '../components/video/VideoThumb.vue'
import {
  CATEGORY_OPTIONS,
  COPY,
  VIDEO_PATH,
  VIDEO_STAFF_ROLES,
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

/**
 * http mode only (the real API refuses `global` from non-staff with a 422; the mock does not, so mock
 * mode keeps the live two-option form): outside admin/teacher the form defaults to "Sekolah Saya"
 * and does not offer "Semua Pengguna".
 */
const globalRefused = isHttpMode() && !VIDEO_STAFF_ROLES.includes(session.role.value ?? '')

const { data: context } = useApi((signal) => fetchVideoFormContext({ signal }))
const { data: subjectList } = useApi((signal) => fetchSubjectOptions({ signal }))
const {
  data: video,
  error: videoError,
  reload,
} = useApi(
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
  /** The id as the API gave it (a number in mock mode, a string in http mode); '' = none. */
  subjectId: number | string
  visibility: VideoVisibility
}

const form = reactive<FormState>({
  videoUrl: '',
  title: '',
  description: '',
  category: '',
  subjectId: '',
  visibility: globalRefused ? 'school' : 'global',
})

const preview = ref<DetectedPlatform | null>(null)

// A stored "school" visibility without a video-form school cannot stay selected: the radio is
// disabled, so the form shows "Semua Pengguna" (live form semantics).
function normalizeVisibility(): void {
  if (
    !globalRefused &&
    context.value !== null &&
    context.value.school === null &&
    form.visibility === 'school'
  ) {
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
    subjectId: form.subjectId === '' ? null : wireId(form.subjectId),
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

const categoryItems = CATEGORY_OPTIONS.map((o) => ({ label: o.label, value: o.value }))
/** Reka selects cannot hold an empty value: `none` stands for "no subject". */
const subjectItems = computed(() => [
  { label: COPY.subjectNone, value: 'none' },
  ...subjects.value.map((s) => ({ label: s.name, value: String(s.id) })),
])
const subjectModel = computed({
  get: () => (form.subjectId === '' ? 'none' : String(form.subjectId)),
  set: (v: string) => {
    // Keep the id as the list holds it; `body()` puts it on the wire as the transport expects.
    form.subjectId = v === 'none' ? '' : (subjects.value.find((s) => String(s.id) === v)?.id ?? '')
  },
})
const categoryModel = computed({
  get: () => (form.category === '' ? undefined : form.category),
  set: (v: VideoCategory | undefined) => {
    form.category = v ?? ''
  },
})
const visibilityItems = computed(() => {
  const schoolItem = {
    label: COPY.visibilitySchool,
    description: school.value
      ? school.value.name
      : isEdit.value
        ? undefined
        : COPY.visibilityNoSchool,
    value: 'school',
    disabled: school.value === null,
  }
  // A stored `global` video stays visible on its own edit form so the selection is not blank.
  if (globalRefused && !(isEdit.value && video.value?.visibility === 'global')) return [schoolItem]
  return [
    {
      label: COPY.visibilityGlobal,
      description: isEdit.value ? undefined : COPY.visibilityGlobalHint,
      value: 'global',
    },
    schoolItem,
  ]
})
</script>

<template>
  <DsPage
    class="max-w-3xl"
    :title="isEdit ? COPY.editHeader : COPY.addH1"
    :subtitle="isEdit ? COPY.editSub : COPY.addSub"
    :show-title="true"
    :back-to="backTo"
    title-testid="video-form-h1"
    subtitle-testid="video-form-sub"
    data-testid="video-form-page"
  >
    <DsLoadError
      v-if="videoError && !notFound"
      :message="errorLines(videoError).join(' ')"
      testid="video-form-load-error"
      @retry="reload()"
    />

    <template v-else-if="ready">
      <form class="flex flex-col gap-4 md:gap-6" data-testid="video-form" @submit.prevent="submit">
        <UAlert
          v-if="failure.length"
          color="error"
          variant="subtle"
          icon="i-ph-warning-circle"
          :description="failure.join(' ')"
          data-testid="video-form-error"
        />

        <!-- URL and the detected platform. -->
        <DsPanel>
          <DsFormField
            :label="COPY.urlLabel"
            name="video_url"
            required
            :help="COPY.urlHint"
            :error="errors.videoUrl"
          >
            <UInput
              id="video_url"
              v-model="form.videoUrl"
              type="url"
              name="video_url"
              required
              icon="i-ph-link-duotone"
              :placeholder="COPY.urlPlaceholder"
              class="w-full"
              data-testid="video-url"
              @update:model-value="parseUrl()"
            />
          </DsFormField>
          <UCard v-if="preview" variant="soft" class="mt-3" data-testid="video-preview">
            <div class="flex items-center gap-3">
              <div class="h-14 w-24 shrink-0 overflow-hidden">
                <VideoThumb v-if="preview.thumbnailUrl" :thumbnail-url="preview.thumbnailUrl" />
              </div>
              <p
                class="flex min-w-0 items-center gap-2 text-label text-highlighted"
                data-testid="video-preview-label"
              >
                <UIcon
                  name="i-ph-check-circle-duotone"
                  class="size-5 shrink-0"
                  aria-hidden="true"
                />
                {{ COPY.detected(preview.label) }}
              </p>
            </div>
          </UCard>
        </DsPanel>

        <!-- Title and description. -->
        <DsPanel>
          <div class="flex flex-col gap-4">
            <DsFormField :label="COPY.titleLabel" name="title" required :error="errors.title">
              <UInput
                id="title"
                v-model="form.title"
                type="text"
                name="title"
                required
                maxlength="255"
                :placeholder="COPY.titlePlaceholder"
                class="w-full"
                data-testid="video-title-input"
              />
            </DsFormField>
            <DsFormField
              :label="COPY.descriptionLabel"
              name="description"
              :hint="isEdit ? undefined : COPY.optional"
              :error="errors.description"
            >
              <UTextarea
                id="description"
                v-model="form.description"
                name="description"
                :rows="3"
                maxlength="1000"
                :placeholder="COPY.descriptionPlaceholder"
                class="w-full"
                data-testid="video-description-input"
              />
            </DsFormField>
          </div>
        </DsPanel>

        <!-- Category, subject, visibility. -->
        <DsPanel>
          <div class="flex flex-col gap-4">
            <div class="grid gap-4 sm:grid-cols-2">
              <DsFormField
                :label="COPY.categoryLabel"
                name="category"
                required
                :error="errors.category"
              >
                <USelect
                  v-model="categoryModel"
                  :items="categoryItems"
                  name="category"
                  required
                  :placeholder="COPY.categoryPlaceholder"
                  class="w-full"
                  data-testid="video-category-input"
                />
              </DsFormField>
              <DsFormField
                :label="COPY.subjectLabel"
                name="subject_id"
                :hint="isEdit ? undefined : COPY.optional"
              >
                <USelect
                  v-model="subjectModel"
                  :items="subjectItems"
                  name="subject_id"
                  class="w-full"
                  data-testid="video-subject-input"
                />
              </DsFormField>
            </div>

            <DsFormField
              :label="COPY.visibilityLabel"
              name="visibility"
              required
              :error="errors.visibility"
            >
              <URadioGroup
                v-model="form.visibility"
                :items="visibilityItems"
                variant="card"
                orientation="horizontal"
                class="w-full"
                data-testid="video-visibility"
              />
            </DsFormField>
          </div>
        </DsPanel>

        <!-- Uploader strip (S20 only). -->
        <UCard v-if="!isEdit && context" variant="soft" data-testid="video-uploader-strip">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex min-w-0 items-center gap-3">
              <UAvatar :text="context.uploader.initial" size="md" />
              <p class="min-w-0 truncate text-label text-default">
                <span class="text-highlighted" data-testid="video-strip-name">{{
                  context.uploader.name
                }}</span>
                <span class="mx-2 text-muted" aria-hidden="true">·</span>
                <span data-testid="video-strip-role">{{ context.uploader.roleLabel }}</span>
              </p>
            </div>
            <p class="flex items-center gap-2 text-caption text-muted">
              <UIcon name="i-ph-info-duotone" class="size-4 shrink-0" aria-hidden="true" />
              {{ COPY.uploaderNote }}
            </p>
          </div>
        </UCard>

        <!-- Footer: one row at every width. -->
        <DsFormBar
          :sticky="false"
          :cancel-to="backTo"
          :cancel-label="COPY.cancel"
          :submit-label="isEdit ? COPY.save : COPY.publish"
          :submit-icon="isEdit ? 'i-ph-floppy-disk' : 'i-ph-upload-simple'"
          :saving="busy"
          data-testid="video-form-footer"
        />
      </form>
    </template>
  </DsPage>
</template>
