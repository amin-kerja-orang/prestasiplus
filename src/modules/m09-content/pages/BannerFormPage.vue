<script setup lang="ts">
/**
 * S10 `/admin/banners/create` "Tambah Banner - Admin PRESTASIPLUS" and S11 `/admin/banners/:id/edit`
 * "Edit Banner - Admin PRESTASIPLUS" (M09; FR-M09-54..59, BR-M09-12, BR-M09-13). One form for both:
 * `mode="create"` posts ("Simpan Banner"), `mode="edit"` loads the banner and pre-fills it
 * ("Kemaskini Banner").
 *
 * - Native HTML5 validation only (`title`, `banner_type` required; no `novalidate`).
 * - "Jenis Pautan" drives `linkType`: only "Pautan Luar" shows the unlabelled URL input; hiding it keeps
 *   its value; the URL is sent only for "Pautan Luar".
 * - S11 selects show the stored values (DV-M09-07, BR-M09-13); an unknown id returns to S9 with the
 *   one-time flash "Banner tidak dijumpai.". A 422 shows under the fields and keeps the input.
 */
import { ArrowLeft, ArrowUpDown, Info } from '@lucide/vue'
import { computed, reactive, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { createBanner, fetchAdminBanner, updateBanner } from '../api/admin-media'
import MediaFormActions from '../components/admin-media/MediaFormActions.vue'
import {
  AUDIENCE_OPTIONS,
  BANNER_TYPE_OPTIONS,
  LINK_TYPE_OPTIONS,
  bannerPayload,
  bannerToForm,
  emptyBannerForm,
  preselect,
  type SelectOption,
} from '../lib/admin-media/banners'
import {
  BANNERS_PATH,
  COPY,
  ERROR_BORDER_CLASS,
  ERROR_TEXT_CLASS,
  HINT_CLASS,
  INPUT_CLASS,
  LABEL_CLASS,
  errorLines,
  fieldErrors,
  isNotFoundError,
} from '../lib/admin-media/common'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: number }>(), { id: 0 })

const router = useRouter()
const flash = useFlash()

const editing = computed(() => props.mode === 'edit')

const form = reactive(emptyBannerForm())
/** The S11 extra option of a stored code the form offers no option for (BR-M09-13). */
const typeExtra = ref<SelectOption | null>(null)
const linkExtra = ref<SelectOption | null>(null)
const audienceExtra = ref<SelectOption | null>(null)

// S11: GET /api/admin/banners/:id pre-fills the form.
const { data: loaded, error: loadError } = useApi(
  (signal) => fetchAdminBanner(props.id, { signal }),
  () => props.id,
  { immediate: props.mode === 'edit' },
)

watch(
  loaded,
  (banner) => {
    if (!banner) return
    const type = preselect(BANNER_TYPE_OPTIONS, banner.bannerType, '')
    const link = preselect(LINK_TYPE_OPTIONS, banner.linkType, 'none')
    const audience = preselect(AUDIENCE_OPTIONS, banner.targetAudience, 'all')
    typeExtra.value = type.extra
    linkExtra.value = link.extra
    audienceExtra.value = audience.extra
    Object.assign(
      form,
      bannerToForm(banner, {
        bannerType: type.value,
        linkType: link.value,
        targetAudience: audience.value,
      }),
    )
  },
  { immediate: true },
)

/** FR-M09-53: an unknown banner returns to S9 with the one-time error flash. */
watch(
  loadError,
  (err) => {
    if (err && isNotFoundError(err)) {
      flash.error(COPY.bannerNotFound)
      void router.replace(BANNERS_PATH)
    }
  },
  { immediate: true },
)

const failed = computed(() => loadError.value !== null && !isNotFoundError(loadError.value))
const ready = computed(() => !editing.value || loaded.value !== null)

const saving = ref(false)
const errors = ref<Record<string, string>>({})
const failure = ref<string[]>([])

const showExternal = computed(() => form.linkType === 'external')

const KNOWN_FIELDS = [
  'title',
  'description',
  'imageUrl',
  'bannerType',
  'linkType',
  'externalUrl',
  'targetAudience',
  'displayOrder',
  'startDate',
  'endDate',
]

/** Messages for fields this form has no spot for sit in the red box above the form. */
const boxMessages = computed(() => {
  const unmatched = Object.entries(errors.value)
    .filter(([key]) => !KNOWN_FIELDS.includes(key))
    .map(([, message]) => message)
  return [...failure.value, ...unmatched]
})

const field = (name: string): string[] => [
  INPUT_CLASS,
  ...(errors.value[name] ? [ERROR_BORDER_CLASS] : []),
]

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  errors.value = {}
  failure.value = []
  const body = bannerPayload(form)
  try {
    const result = editing.value ? await updateBanner(props.id, body) : await createBanner(body)
    flash.success(result.status)
    await router.push(BANNERS_PATH)
  } catch (err) {
    if (isNotFoundError(err)) {
      flash.error(COPY.bannerNotFound)
      await router.replace(BANNERS_PATH)
      return
    }
    errors.value = fieldErrors(err)
    if (Object.keys(errors.value).length === 0) failure.value = errorLines(err)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="banner-form-page">
    <RouterLink
      :to="BANNERS_PATH"
      class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
      data-testid="banner-back"
    >
      <ArrowLeft class="h-4 w-4" aria-hidden="true" />
      Kembali ke Senarai
    </RouterLink>

    <AlertBox v-if="failed" :messages="COPY.loadFailed" data-testid="banner-load-error" />

    <form
      v-else-if="ready"
      method="post"
      class="space-y-5 rounded-2xl bg-white p-5 shadow sm:p-6"
      data-testid="banner-form"
      @submit.prevent="submit"
    >
      <AlertBox :messages="boxMessages" data-testid="banner-form-alert" />

      <div>
        <label for="banner-title" :class="LABEL_CLASS"
          >Tajuk Banner <span class="text-red-500">*</span></label
        >
        <input
          id="banner-title"
          v-model="form.title"
          type="text"
          name="title"
          required
          placeholder="cth: Promosi SPM 2024"
          :class="field('title')"
          data-testid="banner-title"
        />
        <p v-if="errors.title" :class="ERROR_TEXT_CLASS">{{ errors.title }}</p>
      </div>

      <div>
        <label for="banner-description" :class="LABEL_CLASS">Penerangan</label>
        <textarea
          id="banner-description"
          v-model="form.description"
          name="description"
          rows="3"
          placeholder="Penerangan ringkas tentang banner"
          :class="field('description')"
          data-testid="banner-description"
        ></textarea>
        <p v-if="errors.description" :class="ERROR_TEXT_CLASS">{{ errors.description }}</p>
      </div>

      <div>
        <label for="banner-image" :class="LABEL_CLASS">URL Gambar</label>
        <input
          id="banner-image"
          v-model="form.imageUrl"
          type="url"
          name="image_url"
          placeholder="https://example.com/image.jpg"
          :class="field('imageUrl')"
          data-testid="banner-image-url"
        />
        <p :class="HINT_CLASS">
          <Info class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Masukkan URL gambar banner
        </p>
        <p v-if="errors.imageUrl" :class="ERROR_TEXT_CLASS">{{ errors.imageUrl }}</p>
      </div>

      <div>
        <label for="banner-type" :class="LABEL_CLASS"
          >Jenis Banner <span class="text-red-500">*</span></label
        >
        <select
          id="banner-type"
          v-model="form.bannerType"
          name="banner_type"
          required
          :class="field('bannerType')"
          data-testid="banner-type"
        >
          <option v-if="typeExtra" :value="typeExtra.value">{{ typeExtra.label }}</option>
          <option value="">Pilih jenis banner</option>
          <option v-for="o in BANNER_TYPE_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
        <p v-if="errors.bannerType" :class="ERROR_TEXT_CLASS">{{ errors.bannerType }}</p>
      </div>

      <div>
        <label for="banner-link-type" :class="LABEL_CLASS">Jenis Pautan</label>
        <select
          id="banner-link-type"
          v-model="form.linkType"
          name="link_type"
          :class="field('linkType')"
          data-testid="banner-link-type"
        >
          <option v-if="linkExtra" :value="linkExtra.value">{{ linkExtra.label }}</option>
          <option v-for="o in LINK_TYPE_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
        <input
          v-show="showExternal"
          v-model="form.externalUrl"
          type="url"
          name="external_url"
          placeholder="https://example.com"
          :class="[...field('externalUrl'), 'mt-2']"
          data-testid="banner-external-url"
        />
        <p v-if="showExternal && errors.externalUrl" :class="ERROR_TEXT_CLASS">
          {{ errors.externalUrl }}
        </p>
      </div>

      <div>
        <label for="banner-audience" :class="LABEL_CLASS"
          >Sasaran Penonton <span class="text-red-500">*</span></label
        >
        <select
          id="banner-audience"
          v-model="form.targetAudience"
          name="target_audience"
          required
          :class="field('targetAudience')"
          data-testid="banner-audience"
        >
          <option v-if="audienceExtra" :value="audienceExtra.value">
            {{ audienceExtra.label }}
          </option>
          <option v-for="o in AUDIENCE_OPTIONS" :key="o.value" :value="o.value">
            {{ o.label }}
          </option>
        </select>
        <p v-if="errors.targetAudience" :class="ERROR_TEXT_CLASS">{{ errors.targetAudience }}</p>
      </div>

      <div>
        <label for="banner-order" :class="LABEL_CLASS">Susunan Paparan</label>
        <input
          id="banner-order"
          v-model.number="form.displayOrder"
          type="number"
          name="display_order"
          min="0"
          :class="field('displayOrder')"
          data-testid="banner-order"
        />
        <p :class="HINT_CLASS">
          <ArrowUpDown class="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Nombor lebih kecil akan dipaparkan dahulu
        </p>
        <p v-if="errors.displayOrder" :class="ERROR_TEXT_CLASS">{{ errors.displayOrder }}</p>
      </div>

      <div>
        <label for="banner-start" :class="LABEL_CLASS">Tarikh Mula</label>
        <input
          id="banner-start"
          v-model="form.startDate"
          type="date"
          name="start_date"
          :class="field('startDate')"
          data-testid="banner-start"
        />
        <p v-if="errors.startDate" :class="ERROR_TEXT_CLASS">{{ errors.startDate }}</p>
      </div>

      <div>
        <label for="banner-end" :class="LABEL_CLASS">Tarikh Tamat</label>
        <input
          id="banner-end"
          v-model="form.endDate"
          type="date"
          name="end_date"
          :class="field('endDate')"
          data-testid="banner-end"
        />
        <p v-if="errors.endDate" :class="ERROR_TEXT_CLASS">{{ errors.endDate }}</p>
      </div>

      <div>
        <label class="inline-flex min-h-11 cursor-pointer items-center gap-2.5">
          <input
            v-model="form.isActive"
            type="checkbox"
            name="is_active"
            value="1"
            class="h-4 w-4 rounded border-slate-300 accent-indigo-600"
            data-testid="banner-active"
          />
          <span class="text-sm font-semibold text-slate-700">Banner Aktif</span>
        </label>
        <p class="ml-6.5 text-xs text-slate-500">Tandakan untuk memaparkan banner</p>
      </div>

      <MediaFormActions
        :cancel-to="BANNERS_PATH"
        :submit-label="editing ? 'Kemaskini Banner' : 'Simpan Banner'"
        :saving="saving"
      />
    </form>
  </div>
</template>
