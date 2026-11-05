<script setup lang="ts">
/**
 * P2-12 `/admin/marketplace/products/create` "Tambah Produk Marketplace" and `/admin/marketplace/products/:id/edit`
 * (R1-ADM-P2-12, fields P12-02..P12-11; API-ADM-19), admin shell. One form for both modes.
 *
 * - Validation runs in the page with the API's own texts ("Nama produk diperlukan.", "Harga asal mesti lebih besar
 *   daripada harga.", ...); a 422 from the API shows under its field and the input is kept.
 * - Images (up to 5, JPG/PNG/WebP, 2 MB each): a picked file is uploaded at once (`purpose=marketplace_image`) and its
 *   URL is sent as `images` (create) or `newImages` (edit, appended). In edit mode each saved image has its own
 *   `Padam` (a separate request, not a part of `Simpan Perubahan`, D-M20-01).
 * - `Status Produk` is edit only; a new product is `Aktif`.
 */
import { MARKETPLACE_ADMIN_LIMITS, MARKETPLACE_ADMIN_MESSAGES, MARKETPLACE_ADMIN_PROPOSED, type MarketplaceAdminProductDetail } from '@pp/contract'
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useApi, useFlash } from '@/composables'
import {
  DsCluster,
  DsFileField,
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsGrid,
  DsHeading,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
  DsStack,
  DsText,
  DsThumb,
} from '@/ds'

import {
  createAdminProduct,
  deleteAdminProductImage,
  fetchAdminProduct,
  fetchAdminSellerOptions,
  fetchMarketplaceCategories,
  updateAdminProduct,
  uploadMarketplaceImage,
} from '../api'
import {
  ADMIN_COPY,
  ADMIN_PRODUCTS_PATH,
  CONDITION_CHOICES,
  IMAGE_MAX_BYTES,
  IMAGE_TYPES,
  OFFICIAL_VALUE,
  PRODUCT_STATUS_CHOICES,
  SHIPPING_CHOICES,
  STOCK_CHOICES,
  createBody,
  errorText,
  fieldErrorsOf,
  sellerOptionValue,
  validateProductForm,
  type ProductFormValues,
} from '../components/admin/copy'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: string }>(), { id: '' })

const router = useRouter()
const flash = useFlash()
const editing = computed(() => props.mode === 'edit')

const form = reactive<ProductFormValues>({
  sellerId: OFFICIAL_VALUE,
  name: '',
  categoryId: '',
  price: '',
  originalPrice: '',
  description: '',
  condition: 'new',
  stockStatus: 'available',
  shippingMethod: '',
  shippingFee: '',
  location: '',
  status: 'active',
})

const sellers = useApi((signal) => fetchAdminSellerOptions({ signal }))
const categories = useApi((signal) => fetchMarketplaceCategories({ signal }))
const loaded = useApi((signal) => fetchAdminProduct(props.id, { signal }), () => props.id, { immediate: editing.value })

/** Saved images (edit); each has its own delete. */
const existing = ref<MarketplaceAdminProductDetail['images']>([])
/** Files uploaded in this form and not saved yet. */
const added = ref<{ url: string; name: string }[]>([])

watch(
  loaded.data,
  (p) => {
    if (!p) return
    form.sellerId = p.sellerId ?? OFFICIAL_VALUE
    form.name = p.name
    form.categoryId = p.categoryId
    form.price = p.price
    form.originalPrice = p.originalPrice ?? ''
    form.description = p.description ?? ''
    form.condition = p.condition
    form.stockStatus = p.stockStatus
    form.shippingMethod = p.shippingMethod
    form.shippingFee = p.shippingFee ?? ''
    form.location = p.location
    form.status = p.status
    existing.value = [...p.images]
  },
  { immediate: true },
)

// An unknown product returns to the list with the API's message.
watch(loaded.error, (err) => {
  if (isApiError(err) && err.status === 404) {
    flash.error(ADMIN_COPY.productNotFound)
    void router.replace(ADMIN_PRODUCTS_PATH)
  }
})

const loadFailed = computed(() =>
  [sellers.error.value, categories.error.value, loaded.error.value].some((e) => e !== null && !(isApiError(e) && e.status === 404)),
)
const ready = computed(
  () => sellers.data.value !== null && categories.data.value !== null && (!editing.value || loaded.data.value !== null),
)
function retry(): void {
  void sellers.reload()
  void categories.reload()
  if (editing.value) void loaded.reload()
}

const messages = ref<Record<string, string>>({})
const topError = ref('')
const saving = ref(false)
const uploading = ref(false)
const picked = ref<File | null>(null)
const imageTotal = computed(() => existing.value.length + added.value.length)
const imageMessage = computed(() => messages.value.images ?? messages.value.newImages)

async function onPick(next: File | File[] | null): Promise<void> {
  const files = Array.isArray(next) ? next : next ? [next] : []
  picked.value = null
  if (files.length === 0) return
  uploading.value = true
  delete messages.value.images
  delete messages.value.newImages
  try {
    for (const file of files) {
      if (imageTotal.value >= MARKETPLACE_ADMIN_LIMITS.maxImages) {
        messages.value.images = MARKETPLACE_ADMIN_MESSAGES.maxImages
        break
      }
      if (!(IMAGE_TYPES as readonly string[]).includes(file.type) || file.size > IMAGE_MAX_BYTES) {
        messages.value.images = MARKETPLACE_ADMIN_MESSAGES.imageInvalid
        continue
      }
      try {
        added.value.push({ url: await uploadMarketplaceImage(file), name: file.name })
      } catch (err) {
        messages.value.images = fieldErrorsOf(err).images ?? errorText(err)
      }
    }
  } finally {
    uploading.value = false
  }
}

function discard(url: string): void {
  added.value = added.value.filter((i) => i.url !== url)
  delete messages.value.images
}

const deleting = ref<string | null>(null)
/** Its own request: the form values are untouched and nothing else is saved. */
async function removeExisting(imageId: string): Promise<void> {
  if (deleting.value !== null) return
  deleting.value = imageId
  topError.value = ''
  try {
    const product = await deleteAdminProductImage(props.id, imageId)
    existing.value = [...product.images]
    flash.show({ type: 'success', message: MARKETPLACE_ADMIN_PROPOSED.flash.imageDeleted })
  } catch (err) {
    topError.value = errorText(err)
  } finally {
    deleting.value = null
  }
}

const FIELDS = ['sellerId', 'name', 'categoryId', 'price', 'originalPrice', 'description', 'condition', 'stockStatus', 'shippingMethod', 'shippingFee', 'location', 'status', 'images', 'newImages']

async function submit(): Promise<void> {
  if (saving.value || uploading.value) return
  topError.value = ''
  const found = validateProductForm(form, imageTotal.value)
  messages.value = found
  if (Object.keys(found).length > 0) return
  saving.value = true
  try {
    const urls = added.value.map((i) => i.url)
    const body = createBody(form, [])
    if (editing.value) {
      await updateAdminProduct(props.id, { ...body, ...(urls.length > 0 ? { newImages: urls } : {}) })
      flash.success(MARKETPLACE_ADMIN_PROPOSED.flash.productUpdated)
    } else {
      await createAdminProduct(urls.length > 0 ? { ...body, images: urls } : body)
      flash.success(MARKETPLACE_ADMIN_PROPOSED.flash.productCreated)
    }
    await router.push(ADMIN_PRODUCTS_PATH)
  } catch (err) {
    const fields = fieldErrorsOf(err)
    messages.value = fields
    const loose = Object.entries(fields).filter(([k]) => !FIELDS.includes(k)).map(([, v]) => v)
    topError.value = Object.keys(fields).length === 0 ? errorText(err) : loose.join(' ')
  } finally {
    saving.value = false
  }
}

const invalid = (name: string): 'error' | undefined => (messages.value[name] ? 'error' : undefined)
</script>

<template>
  <DsPage layout="form" :back-to="ADMIN_PRODUCTS_PATH" data-testid="admin-product-form-page">
    <DsLoadError v-if="loadFailed" :message="ADMIN_COPY.loadFailed" testid="admin-product-load-error" @retry="retry" />

    <DsPanel v-else-if="!ready" data-testid="admin-product-form-skeleton">
      <DsStack gap="lg">
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </DsStack>
    </DsPanel>

    <DsStack v-else as="form" gap="lg" data-testid="admin-product-form" @submit.prevent="submit">
      <DsHeading :level="2" variant="heading" data-testid="admin-product-form-title">{{ editing ? ADMIN_COPY.editTitle : ADMIN_COPY.createTitle }}</DsHeading>

      <UAlert v-if="topError" color="error" variant="subtle" icon="i-ph-warning-circle" role="alert" :description="topError" data-testid="admin-product-form-alert" />

      <DsFormSection :title="ADMIN_COPY.createTitle" icon="storefront" accent="action">
        <DsFormField native for="mp-seller" :label="ADMIN_COPY.seller" required :error="messages.sellerId">
          <DsNativeSelect id="mp-seller" v-model="form.sellerId" :aria-invalid="invalid('sellerId') ? 'true' : undefined" data-testid="mp-seller">
            <option v-for="o in sellers.data.value ?? []" :key="sellerOptionValue(o)" :value="sellerOptionValue(o)">{{ o.label }}</option>
          </DsNativeSelect>
        </DsFormField>

        <DsFormField native for="mp-name" :label="ADMIN_COPY.name" required :error="messages.name">
          <UInput id="mp-name" v-model="form.name" type="text" name="name" size="md" class="w-full" :color="invalid('name')" data-testid="mp-name" />
        </DsFormField>

        <DsFormField native for="mp-category" :label="ADMIN_COPY.category" required :error="messages.categoryId">
          <DsNativeSelect id="mp-category" v-model="form.categoryId" :aria-invalid="invalid('categoryId') ? 'true' : undefined" data-testid="mp-category">
            <option value="">{{ ADMIN_COPY.categoryPlaceholder }}</option>
            <option v-for="c in categories.data.value ?? []" :key="c.id" :value="String(c.id)">{{ c.name }}</option>
          </DsNativeSelect>
        </DsFormField>

        <DsGrid :cols="{ base: 1, md: 2 }" gap="lg">
          <DsFormField native for="mp-price" :label="ADMIN_COPY.price" required :error="messages.price">
            <UInput id="mp-price" v-model="form.price" type="text" inputmode="decimal" name="price" size="md" class="w-full" :color="invalid('price')" data-testid="mp-price" />
          </DsFormField>
          <DsFormField native for="mp-original" :label="ADMIN_COPY.originalPrice" :hint="ADMIN_COPY.originalPriceHint" :error="messages.originalPrice">
            <UInput id="mp-original" v-model="form.originalPrice" type="text" inputmode="decimal" name="originalPrice" size="md" class="w-full" :color="invalid('originalPrice')" data-testid="mp-original-price" />
          </DsFormField>
        </DsGrid>

        <DsFormField native for="mp-description" :label="ADMIN_COPY.description" :error="messages.description">
          <UTextarea id="mp-description" v-model="form.description" name="description" :rows="4" size="md" class="w-full" :color="invalid('description')" data-testid="mp-description" />
        </DsFormField>

        <DsGrid :cols="{ base: 1, md: 2 }" gap="lg">
          <DsFormField native :label="ADMIN_COPY.condition" required :error="messages.condition">
            <URadioGroup v-model="form.condition" :items="[...CONDITION_CHOICES]" variant="card" orientation="horizontal" class="w-full" data-testid="mp-condition" />
          </DsFormField>
          <DsFormField native :label="ADMIN_COPY.stockStatus" required :error="messages.stockStatus">
            <URadioGroup v-model="form.stockStatus" :items="[...STOCK_CHOICES]" variant="card" orientation="horizontal" class="w-full" data-testid="mp-stock" />
          </DsFormField>
        </DsGrid>

        <DsGrid :cols="{ base: 1, md: 2 }" gap="lg">
          <DsFormField native for="mp-shipping" :label="ADMIN_COPY.shippingMethod" required :error="messages.shippingMethod">
            <DsNativeSelect id="mp-shipping" v-model="form.shippingMethod" :aria-invalid="invalid('shippingMethod') ? 'true' : undefined" data-testid="mp-shipping">
              <option value="">Pilih kaedah</option>
              <option v-for="o in SHIPPING_CHOICES" :key="o.value" :value="o.value">{{ o.label }}</option>
            </DsNativeSelect>
          </DsFormField>
          <DsFormField native for="mp-fee" :label="ADMIN_COPY.shippingFee" :error="messages.shippingFee">
            <UInput id="mp-fee" v-model="form.shippingFee" type="text" inputmode="decimal" name="shippingFee" size="md" class="w-full" :color="invalid('shippingFee')" data-testid="mp-fee" />
          </DsFormField>
        </DsGrid>

        <DsFormField native for="mp-location" :label="ADMIN_COPY.location" :error="messages.location">
          <UInput id="mp-location" v-model="form.location" type="text" name="location" size="md" class="w-full" :color="invalid('location')" data-testid="mp-location" />
        </DsFormField>
      </DsFormSection>

      <DsFormSection :title="ADMIN_COPY.images" icon="image" accent="friend">
        <DsStack v-if="editing" gap="sm" data-testid="mp-existing-images">
          <DsText variant="label" tone="highlighted">{{ ADMIN_COPY.existingImages(existing.length) }}</DsText>
          <DsStack as="ul" gap="xs">
            <li v-for="img in existing" :key="img.id" data-testid="mp-existing-image">
              <DsCluster gap="sm" :wrap="false">
                <DsThumb :src="img.url" :alt="`${ADMIN_COPY.images} ${String(img.position)}`" />
                <DsText v-if="img.position === existing[0]?.position" variant="caption" as="span">{{ ADMIN_COPY.mainImage }}</DsText>
                <UButton
                  type="button"
                  color="error"
                  variant="soft"
                  class="ms-auto min-h-11"
                  :label="ADMIN_COPY.delete"
                  :loading="deleting === img.id"
                  :disabled="deleting !== null"
                  :aria-label="`${ADMIN_COPY.delete} ${ADMIN_COPY.images.toLowerCase()} ${String(img.position)}`"
                  data-testid="mp-existing-image-delete"
                  @click="removeExisting(img.id)"
                />
              </DsCluster>
            </li>
          </DsStack>
        </DsStack>

        <DsFormField native for="mp-images" :label="ADMIN_COPY.images" :hint="ADMIN_COPY.imagesHint" :error="imageMessage">
          <DsStack gap="sm">
            <DsFileField
              id="mp-images"
              :model-value="picked"
              accept="image/jpeg,image/png,image/webp"
              multiple
              preview="none"
              variant="button"
              :label="ADMIN_COPY.imagePick"
              :disabled="uploading"
              data-testid="mp-images-input"
              @update:model-value="onPick"
            >
              <template #default="{ open }">
                <UButton type="button" color="neutral" variant="soft" class="min-h-11" icon="i-ph-upload-simple" :label="ADMIN_COPY.imagePick" :disabled="uploading" @click="open()" />
              </template>
            </DsFileField>
            <DsText v-if="uploading" variant="caption" data-testid="mp-images-busy">{{ ADMIN_COPY.imageUploading }}</DsText>
            <DsStack v-if="added.length > 0" as="ul" gap="xs" data-testid="mp-added-images">
              <li v-for="img in added" :key="img.url" data-testid="mp-added-image">
                <DsCluster gap="sm" :wrap="false">
                  <DsThumb :src="img.url" :alt="img.name" />
                  <DsText variant="caption" as="span" truncate>{{ img.name }}</DsText>
                  <UButton type="button" color="neutral" variant="ghost" class="ms-auto min-h-11" :label="ADMIN_COPY.imageDiscard" :aria-label="`${ADMIN_COPY.imageDiscard} ${img.name}`" data-testid="mp-added-image-discard" @click="discard(img.url)" />
                </DsCluster>
              </li>
            </DsStack>
          </DsStack>
        </DsFormField>
      </DsFormSection>

      <DsFormSection v-if="editing" :title="ADMIN_COPY.productStatus" icon="check-circle" accent="win">
        <DsFormField native :label="ADMIN_COPY.productStatus" required :error="messages.status">
          <URadioGroup v-model="form.status" :items="[...PRODUCT_STATUS_CHOICES]" variant="card" orientation="horizontal" class="w-full" data-testid="mp-status" />
        </DsFormField>
      </DsFormSection>

      <DsFormBar :cancel-to="ADMIN_PRODUCTS_PATH" :cancel-label="ADMIN_COPY.cancel" :submit-label="editing ? ADMIN_COPY.save : ADMIN_COPY.submitCreate" :saving="saving" :disabled="uploading" />
    </DsStack>
  </DsPage>
</template>
