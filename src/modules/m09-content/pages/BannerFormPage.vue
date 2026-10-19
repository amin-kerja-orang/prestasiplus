<script setup lang="ts">
/**
 * S10 `/admin/banners/create` "Tambah Banner - Admin PRESTASIPLUS" and S11 `/admin/banners/:id/edit`
 * "Edit Banner - Admin PRESTASIPLUS" (M09; FR-M09-54..59, BR-M09-12, BR-M09-13), v2 staff theme. One form for
 * both: `mode="create"` posts ("Simpan Banner"), `mode="edit"` loads the banner and pre-fills it
 * ("Kemaskini Banner").
 *
 * - Native HTML5 validation only (`title`, `banner_type` required; no `novalidate`). Fields sit in cards
 *   (Maklumat, Pautan & Sasaran, Jadual); Batal / Simpan are in a sticky action bar.
 * - "Jenis Pautan" drives `linkType`: only "Pautan Luar" shows the unlabelled URL input; hiding it keeps
 *   its value; the URL is sent only for "Pautan Luar".
 * - S11 selects show the stored values (DV-M09-07, BR-M09-13); an unknown id returns to S9 with the
 *   one-time flash "Banner tidak dijumpai.". A 422 shows under the fields and keeps the input.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsArt3D,
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
} from '@/ds'

import { createBanner, fetchAdminBanner, updateBanner } from '../api/admin-media'
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
const {
  data: loaded,
  error: loadError,
  reload,
} = useApi(
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
const previewUrl = computed(() =>
  /^https?:\/\//i.test(form.imageUrl.trim()) ? form.imageUrl.trim() : '',
)

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

const invalid = (name: string): boolean => errors.value[name] !== undefined

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
  <DsPage :back-to="BANNERS_PATH" back-label="Kembali ke Senarai" data-testid="banner-form-page">
    <DsLoadError
      v-if="failed"
      :message="COPY.loadFailed"
      testid="banner-load-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="!ready" data-testid="banner-form-skeleton">
      <div class="flex flex-col gap-6">
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </div>
    </DsPanel>

    <form
      v-else
      method="post"
      class="flex min-w-0 flex-col gap-6"
      data-testid="banner-form"
      @submit.prevent="submit"
    >
      <UAlert
        v-if="boxMessages.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        data-testid="banner-form-alert"
      >
        <template #description>
          <p v-for="m in boxMessages" :key="m">{{ m }}</p>
        </template>
      </UAlert>

      <DsFormSection title="Maklumat Banner" icon="i-ph-image" accent="action">
        <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div class="flex min-w-0 flex-col gap-6 lg:col-span-2">
            <DsFormField
              native
              for="banner-title"
              label="Tajuk Banner"
              required
              :error="errors.title"
            >
              <UInput
                id="banner-title"
                v-model="form.title"
                type="text"
                name="title"
                required
                placeholder="cth: Promosi SPM 2024"
                size="md"
                class="w-full"
                :color="invalid('title') ? 'error' : undefined"
                data-testid="banner-title"
              />
            </DsFormField>

            <DsFormField
              native
              for="banner-description"
              label="Penerangan"
              :error="errors.description"
            >
              <UTextarea
                id="banner-description"
                v-model="form.description"
                name="description"
                :rows="3"
                placeholder="Penerangan ringkas tentang banner"
                size="md"
                class="w-full"
                :color="invalid('description') ? 'error' : undefined"
                data-testid="banner-description"
              />
            </DsFormField>

            <DsFormField
              native
              for="banner-image"
              label="URL Gambar"
              hint="Masukkan URL gambar banner"
              :error="errors.imageUrl"
            >
              <UInput
                id="banner-image"
                v-model="form.imageUrl"
                type="url"
                name="image_url"
                placeholder="https://example.com/image.jpg"
                size="md"
                class="w-full"
                :color="invalid('imageUrl') ? 'error' : undefined"
                data-testid="banner-image-url"
              />
            </DsFormField>
          </div>

          <div class="flex min-w-0 flex-col gap-2">
            <span class="text-label text-default">Pratonton</span>
            <DsArt3D
              v-if="previewUrl"
              variant="plain"
              ratio="video"
              :src="previewUrl"
              alt="Pratonton banner"
              data-testid="banner-preview"
            />
            <div
              v-else
              class="grid aspect-video place-items-center bg-soft text-dimmed"
              aria-hidden="true"
            >
              <UIcon name="i-ph-image" class="size-10" />
            </div>
          </div>
        </div>
      </DsFormSection>

      <DsFormSection title="Pautan & Sasaran" icon="link" accent="friend">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DsFormField
            native
            for="banner-type"
            label="Jenis Banner"
            required
            :error="errors.bannerType"
          >
            <DsNativeSelect
              id="banner-type"
              v-model="form.bannerType"
              name="banner_type"
              required
              :aria-invalid="invalid('bannerType') ? 'true' : undefined"
              data-testid="banner-type"
            >
              <option v-if="typeExtra" :value="typeExtra.value">{{ typeExtra.label }}</option>
              <option value="">Pilih jenis banner</option>
              <option v-for="o in BANNER_TYPE_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <DsFormField
            native
            for="banner-audience"
            label="Sasaran Penonton"
            required
            :error="errors.targetAudience"
          >
            <DsNativeSelect
              id="banner-audience"
              v-model="form.targetAudience"
              name="target_audience"
              required
              :aria-invalid="invalid('targetAudience') ? 'true' : undefined"
              data-testid="banner-audience"
            >
              <option v-if="audienceExtra" :value="audienceExtra.value">
                {{ audienceExtra.label }}
              </option>
              <option v-for="o in AUDIENCE_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <div class="flex min-w-0 flex-col gap-3 md:col-span-2">
            <DsFormField
              native
              for="banner-link-type"
              label="Jenis Pautan"
              :error="errors.linkType"
            >
              <DsNativeSelect
                id="banner-link-type"
                v-model="form.linkType"
                name="link_type"
                :aria-invalid="invalid('linkType') ? 'true' : undefined"
                data-testid="banner-link-type"
              >
                <option v-if="linkExtra" :value="linkExtra.value">{{ linkExtra.label }}</option>
                <option v-for="o in LINK_TYPE_OPTIONS" :key="o.value" :value="o.value">
                  {{ o.label }}
                </option>
              </DsNativeSelect>
            </DsFormField>
            <div v-show="showExternal" class="flex flex-col gap-2">
              <UInput
                v-model="form.externalUrl"
                type="url"
                name="external_url"
                aria-label="URL pautan luar"
                placeholder="https://example.com"
                size="md"
                class="w-full"
                :color="invalid('externalUrl') ? 'error' : undefined"
                data-testid="banner-external-url"
              />
              <p v-if="showExternal && errors.externalUrl" class="text-caption text-error">
                {{ errors.externalUrl }}
              </p>
            </div>
          </div>
        </div>
      </DsFormSection>

      <DsFormSection title="Jadual & Status" icon="i-ph-calendar-check" accent="heat">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-3">
          <DsFormField
            native
            for="banner-order"
            label="Susunan Paparan"
            hint="Nombor lebih kecil akan dipaparkan dahulu"
            :error="errors.displayOrder"
          >
            <UInput
              id="banner-order"
              v-model.number="form.displayOrder"
              type="number"
              name="display_order"
              min="0"
              size="md"
              class="w-full"
              :color="invalid('displayOrder') ? 'error' : undefined"
              data-testid="banner-order"
            />
          </DsFormField>

          <DsFormField native for="banner-start" label="Tarikh Mula" :error="errors.startDate">
            <UInput
              id="banner-start"
              v-model="form.startDate"
              type="date"
              name="start_date"
              size="md"
              class="w-full"
              :color="invalid('startDate') ? 'error' : undefined"
              data-testid="banner-start"
            />
          </DsFormField>

          <DsFormField native for="banner-end" label="Tarikh Tamat" :error="errors.endDate">
            <UInput
              id="banner-end"
              v-model="form.endDate"
              type="date"
              name="end_date"
              size="md"
              class="w-full"
              :color="invalid('endDate') ? 'error' : undefined"
              data-testid="banner-end"
            />
          </DsFormField>
        </div>

        <USwitch
          v-model="form.isActive"
          name="is_active"
          label="Banner Aktif"
          description="Tandakan untuk memaparkan banner"
          class="min-h-11"
          data-testid="banner-active"
        />
      </DsFormSection>

      <DsFormBar
        :cancel-to="BANNERS_PATH"
        :submit-label="editing ? 'Kemaskini Banner' : 'Simpan Banner'"
        :saving="saving"
      />
    </form>
  </DsPage>
</template>
