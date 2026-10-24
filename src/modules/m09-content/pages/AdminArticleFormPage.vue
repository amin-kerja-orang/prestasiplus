<script setup lang="ts">
/**
 * S2 `/admin/articles/create` "Tambah Artikel - Admin PRESTASIPLUS" and S3 `/admin/articles/:id/edit`
 * "Edit Artikel - Admin PRESTASIPLUS" (FR-M09-11..18), v2 staff theme. One form for both: `mode="create"` posts
 * a new article ("Simpan Artikel"), `mode="edit"` loads it and pre-fills the fields ("Kemaskini Artikel").
 *
 * - Native HTML validation only (`required`, no `novalidate`): the browser blocks the submit. Fields are
 *   grouped in cards; Batal / Simpan sit in a sticky action bar.
 * - "Kandungan" is a plain textarea where the admin types HTML (DV-M09-02 rejected, SEC-M09-01).
 * - The category select has the "Pilih kategori" placeholder on create only (FR-M09-16).
 * - 422: the field messages show under the fields and the input is kept. Success queues the flash
 *   (PROPOSED COPY) and returns to S1. An unknown id (also a non-numeric one such as `categories`)
 *   returns to S1 with the one-time flash "Artikel tidak dijumpai." (FR-M09-10).
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi, useFlash } from '@/composables'
import {
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsLoadError,
  DsNativeSelect,
  DsPage,
  DsPanel,
} from '@/ds'

import {
  createAdminArticle,
  fetchAdminArticle,
  updateAdminArticle,
  type ArticleInputBody,
} from '../api/admin-articles-notes'
import type { ArticleCategory, GradeLevel } from '../api/types'
import {
  ARTICLES_LIST_PATH,
  CATEGORY_OPTIONS,
  COPY,
  GRADE_OPTIONS,
  errorLines,
  fieldErrors,
  isNotFoundError,
} from '../lib/admin-articles-notes'

const props = withDefaults(defineProps<{ mode: 'create' | 'edit'; id?: string }>(), { id: '' })

const router = useRouter()
const flash = useFlash()

const editing = computed(() => props.mode === 'edit')
const numericId = computed(() => (/^\d+$/.test(props.id) ? Number(props.id) : null))

interface ArticleForm {
  title: string
  excerpt: string
  content: string
  featuredImage: string
  category: ArticleCategory | ''
  gradeLevel: GradeLevel
  isPublished: boolean
  isFeatured: boolean
}

const form = reactive<ArticleForm>({
  title: '',
  excerpt: '',
  content: '',
  featuredImage: '',
  category: '',
  gradeLevel: 'SEMUA',
  isPublished: false,
  isFeatured: false,
})

// S3: GET /api/admin/articles/:id pre-fills the form (never fetched for a non-numeric id).
const {
  data: loaded,
  error: loadError,
  reload,
} = useApi(
  (signal) => fetchAdminArticle(numericId.value ?? 0, { signal }),
  () => props.id,
  { immediate: props.mode === 'edit' && numericId.value !== null },
)

watch(
  loaded,
  (article) => {
    if (!article) return
    form.title = article.title
    form.excerpt = article.excerpt ?? ''
    form.content = article.content
    form.featuredImage = article.featuredImage ?? ''
    form.category = article.category
    form.gradeLevel = article.gradeLevel
    form.isPublished = article.isPublished
    form.isFeatured = article.isFeatured
  },
  { immediate: true },
)

/** FR-M09-10: an unknown article returns to S1 with the one-time error flash. */
function backWithNotFound(): void {
  flash.error(COPY.articleNotFound)
  void router.replace(ARTICLES_LIST_PATH)
}

if (props.mode === 'edit' && numericId.value === null) backWithNotFound()

watch(loadError, (err) => {
  if (err && isNotFoundError(err)) backWithNotFound()
})

const failed = computed(() => loadError.value !== null && !isNotFoundError(loadError.value))
const ready = computed(() => !editing.value || loaded.value !== null)

const saving = ref(false)
const topErrors = ref<string[]>([])
const fieldMessages = ref<Record<string, string>>({})

/** Server message of one field, under either of its names. */
function messageOf(...names: string[]): string | undefined {
  for (const name of names) {
    const text = fieldMessages.value[name]
    if (text) return text
  }
  return undefined
}

function invalid(...names: string[]): boolean {
  return messageOf(...names) !== undefined
}

const KNOWN_FIELDS = [
  'title',
  'excerpt',
  'content',
  'featuredImage',
  'featured_image',
  'category',
  'gradeLevel',
  'grade_level',
]

async function submit(): Promise<void> {
  if (saving.value) return
  saving.value = true
  topErrors.value = []
  fieldMessages.value = {}
  const trimmed = (value: string): string | null => (value.trim() === '' ? null : value.trim())
  const body: ArticleInputBody = {
    title: form.title,
    excerpt: trimmed(form.excerpt),
    content: form.content,
    featuredImage: trimmed(form.featuredImage),
    category: form.category as ArticleCategory,
    gradeLevel: form.gradeLevel,
    isPublished: form.isPublished,
    isFeatured: form.isFeatured,
  }
  try {
    const result =
      editing.value && numericId.value !== null
        ? await updateAdminArticle(numericId.value, body)
        : await createAdminArticle(body)
    flash.success(result.status)
    await router.push(ARTICLES_LIST_PATH)
  } catch (err) {
    const fields = fieldErrors(err)
    fieldMessages.value = fields
    const unmatched = Object.entries(fields)
      .filter(([name]) => !KNOWN_FIELDS.includes(name))
      .map(([, text]) => text)
    topErrors.value = Object.keys(fields).length === 0 ? errorLines(err) : unmatched
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage
    :back-to="ARTICLES_LIST_PATH"
    back-label="Kembali ke Senarai"
    data-testid="admin-article-form-page"
  >
    <DsLoadError
      v-if="failed"
      :message="COPY.loadFailed"
      testid="admin-article-load-error"
      @retry="reload()"
    />

    <DsPanel v-else-if="!ready" data-testid="admin-article-form-skeleton">
      <div class="flex flex-col gap-6">
        <USkeleton v-for="n in 4" :key="n" class="h-11 w-full" />
      </div>
    </DsPanel>

    <form
      v-else
      method="post"
      class="flex min-w-0 flex-col gap-6"
      data-testid="admin-article-form"
      @submit.prevent="submit"
    >
      <UAlert
        v-if="topErrors.length > 0"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        data-testid="admin-article-form-alert"
      >
        <template #description>
          <p v-for="m in topErrors" :key="m">{{ m }}</p>
        </template>
      </UAlert>

      <DsFormSection title="Kandungan Artikel" icon="i-ph-article" accent="action">
        <DsFormField
          native
          for="article-title"
          label="Tajuk Artikel"
          required
          :error="messageOf('title')"
        >
          <UInput
            id="article-title"
            v-model="form.title"
            type="text"
            name="title"
            required
            placeholder="cth: 10 Petua Belajar Matematik"
            size="md"
            class="w-full"
            :color="invalid('title') ? 'error' : undefined"
            data-testid="article-title"
          />
        </DsFormField>

        <DsFormField native for="article-excerpt" label="Ringkasan" :error="messageOf('excerpt')">
          <UTextarea
            id="article-excerpt"
            v-model="form.excerpt"
            name="excerpt"
            :rows="3"
            placeholder="Ringkasan artikel"
            size="md"
            class="w-full"
            :color="invalid('excerpt') ? 'error' : undefined"
            data-testid="article-excerpt"
          />
        </DsFormField>

        <DsFormField
          native
          for="article-content"
          label="Kandungan"
          required
          :error="messageOf('content')"
        >
          <UTextarea
            id="article-content"
            v-model="form.content"
            name="content"
            :rows="15"
            required
            placeholder="Tulis kandungan artikel di sini..."
            size="md"
            class="w-full"
            :color="invalid('content') ? 'error' : undefined"
            data-testid="article-content"
          />
        </DsFormField>
      </DsFormSection>

      <DsFormSection title="Klasifikasi & Media" icon="i-ph-tag" accent="friend">
        <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DsFormField
            native
            for="article-category"
            label="Kategori"
            required
            :error="messageOf('category')"
          >
            <DsNativeSelect
              id="article-category"
              v-model="form.category"
              name="category"
              required
              :aria-invalid="invalid('category') ? 'true' : undefined"
              data-testid="article-category"
            >
              <option v-if="!editing" value="">Pilih kategori</option>
              <option v-for="o in CATEGORY_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <DsFormField
            native
            for="article-grade"
            label="Tahap Pendidikan"
            :error="messageOf('gradeLevel', 'grade_level')"
          >
            <DsNativeSelect
              id="article-grade"
              v-model="form.gradeLevel"
              name="grade_level"
              data-testid="article-grade"
            >
              <option v-for="o in GRADE_OPTIONS" :key="o.value" :value="o.value">
                {{ o.label }}
              </option>
            </DsNativeSelect>
          </DsFormField>

          <div class="md:col-span-2">
            <DsFormField
              native
              for="article-image"
              label="URL Gambar Utama"
              :error="messageOf('featuredImage', 'featured_image')"
            >
              <UInput
                id="article-image"
                v-model="form.featuredImage"
                type="url"
                name="featured_image"
                placeholder="https://example.com/image.jpg"
                size="md"
                class="w-full"
                :color="invalid('featuredImage', 'featured_image') ? 'error' : undefined"
                data-testid="article-image"
              />
            </DsFormField>
          </div>
        </div>
      </DsFormSection>

      <DsFormSection title="Penerbitan" icon="rocket-launch" accent="win">
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
          <USwitch
            v-model="form.isPublished"
            name="is_published"
            label="Terbitkan Sekarang"
            class="min-h-11"
            data-testid="article-published"
          />
          <USwitch
            v-model="form.isFeatured"
            name="is_featured"
            label="Artikel Pilihan"
            class="min-h-11"
            data-testid="article-featured"
          />
        </div>
      </DsFormSection>

      <DsFormBar
        :cancel-to="ARTICLES_LIST_PATH"
        :submit-label="editing ? 'Kemaskini Artikel' : 'Simpan Artikel'"
        :saving="saving"
      />
    </form>
  </DsPage>
</template>
