<script setup lang="ts">
/**
 * Muat Naik Kertas (v2-question-bank 4.2): declaration + PDF. The paper is read in the browser
 * (text layer or OCR, with progress per page), then the configured extractor turns the text into
 * question drafts and an intake batch (Draf) is created. Nothing is published from here.
 */
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'

import { DsFileField, DsFormSection, DsPage, DsPanel } from '@/ds'

import { bijakServer } from '../../../server/client'
import { useBijakUser } from '../../../lib/use-bijak'
import { createExtractor } from '../ai'
import IntakeMetaFields, { type IntakeForm } from '../components/IntakeMetaFields.vue'
import { INTAKE_LIST_PATH, intakeReviewPath } from '../lib/intake-routes'
import { checkFile, readPaper, type OcrProgress } from '../lib/ocr'
import { setPageImages } from '../lib/page-images'
import { SAMPLE_PAGES } from '../lib/sample-paper'
import { PAPER_TYPES, type PageImage, type PageText } from '../types'

const router = useRouter()
const server = bijakServer()
const user = useBijakUser()
const extractor = createExtractor()

const form = reactive<IntakeForm>({
  subject: 'MAT',
  kertas: '2',
  year: String(new Date().getFullYear() - 1),
  paperType: PAPER_TYPES[0],
  source: '',
  copyright: '',
  notes: '',
  tingkatan: '',
})
const file = ref<File | null>(null)
const fileError = ref('')
const busy = ref(false)
const phase = ref<'idle' | 'baca' | 'ekstrak' | 'simpan'>('idle')
const progress = ref<OcrProgress | null>(null)
const donePages = ref<{ page: number; source: string }[]>([])
const failure = ref('')


function onFile(v: File | File[] | null): void {
  const f = Array.isArray(v) ? (v[0] ?? null) : v
  fileError.value = f ? (checkFile(f) ?? '') : ''
  file.value = fileError.value ? null : f
}

const overall = computed(() => {
  if (phase.value === 'baca' && progress.value) {
    const p = progress.value
    return Math.round(((p.page - 1 + (p.phase === 'ocr' ? p.percent / 100 : 0.4)) / p.total) * 80)
  }
  if (phase.value === 'ekstrak') return 90
  if (phase.value === 'simpan') return 98
  return 0
})

const phaseText = computed(() => {
  if (phase.value === 'baca' && progress.value) {
    const p = progress.value
    const what =
      p.phase === 'ocr' ? 'Mengimbas teks (OCR)' : p.phase === 'imej' ? 'Menyediakan imej' : 'Membaca'
    return `${what} halaman ${p.page} / ${p.total}`
  }
  if (phase.value === 'ekstrak') return `Mengekstrak soalan (${extractor.label})`
  if (phase.value === 'simpan') return 'Menyimpan draf'
  return ''
})

const canSubmit = computed(
  () => !busy.value && form.source.trim().length > 0 && form.copyright !== '' && file.value !== null,
)

async function run(pages: PageText[], images: PageImage[], fileName: string, hash: string): Promise<void> {
  phase.value = 'ekstrak'
  const kertas = Number(form.kertas) === 1 ? 1 : 2
  const extracted = await extractor.extract({
    pages,
    images,
    subject: form.subject,
    kertas,
    ...(form.tingkatan ? { tingkatan: form.tingkatan } : {}),
  })
  phase.value = 'simpan'
  const batch = await server.createIntakeBatch(
    user.value,
    {
      subject: form.subject,
      kertas,
      year: Number(form.year) || new Date().getFullYear(),
      paperType: form.paperType,
      source: form.source.trim(),
      copyright: form.copyright,
      notes: form.notes.trim(),
      fileName,
      fileHash: hash,
      pageCount: pages.length,
    },
    extracted,
    pages,
  )
  setPageImages(batch.id, images)
  await router.push(intakeReviewPath(batch.id))
}

async function submit(): Promise<void> {
  if (!canSubmit.value || !file.value) return
  busy.value = true
  failure.value = ''
  donePages.value = []
  try {
    phase.value = 'baca'
    const read = await readPaper(file.value, (p) => {
      progress.value = p
      if (p.phase === 'ocr' && p.percent === 100) {
        donePages.value = [...donePages.value.filter((d) => d.page !== p.page), { page: p.page, source: '' }]
      }
    })
    donePages.value = read.pages.map((p) => ({
      page: p.page,
      source: p.source === 'ocr' ? 'OCR' : 'Lapisan teks',
    }))
    await run(read.pages, read.images, file.value.name, read.fileHash)
  } catch (e) {
    failure.value = e instanceof Error ? e.message : 'Pengekstrakan gagal.'
    phase.value = 'idle'
  } finally {
    busy.value = false
  }
}

async function useSample(): Promise<void> {
  if (busy.value || !form.source.trim() || !form.copyright) return
  busy.value = true
  failure.value = ''
  try {
    phase.value = 'baca'
    progress.value = { page: 1, total: SAMPLE_PAGES.length, phase: 'baca', percent: 100 }
    donePages.value = SAMPLE_PAGES.map((p) => ({ page: p.page, source: 'Lapisan teks' }))
    await run(SAMPLE_PAGES, [], 'kertas-contoh-mat-k2.pdf', `sample-${Date.now()}`)
  } catch (e) {
    failure.value = e instanceof Error ? e.message : 'Pengekstrakan gagal.'
    phase.value = 'idle'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsPage
    layout="form"
    title="Muat Naik Kertas"
    subtitle="Pilih PDF kertas SPM. Soalan dan skema diekstrak untuk anda semak."
    back-label="Kembali ke Senarai Ekstrak"
    :back-to="INTAKE_LIST_PATH"
    data-testid="intake-upload-page"
  >
    <form class="flex w-full min-w-0 flex-col gap-6" @submit.prevent="submit">
      <IntakeMetaFields v-model="form" ask-tingkatan />

      <DsFormSection
        title="Fail kertas"
        description="PDF, PNG atau JPG, maksimum 20 MB. Halaman imbasan dibaca dengan OCR."
        icon="upload-simple"
      >
        <DsFileField
          :model-value="file"
          accept="application/pdf,image/png,image/jpeg"
          :max-size-mb="20"
          label="Pilih atau seret fail"
          :disabled="busy"
          data-testid="intake-file"
          @update:model-value="onFile"
          @reject="fileError = 'Fail melebihi had 20 MB.'"
        />
        <p v-if="fileError" class="text-sm text-error" role="alert" data-testid="intake-file-error">
          {{ fileError }}
        </p>
      </DsFormSection>

      <DsPanel v-if="busy || donePages.length > 0" data-testid="intake-progress" aria-live="polite">
        <div class="flex flex-col gap-3">
          <p class="font-medium">{{ phaseText || 'Selesai membaca' }}</p>
          <UProgress :model-value="overall" aria-label="Kemajuan pengekstrakan" />
          <ul v-if="donePages.length > 0" class="flex flex-wrap gap-2 text-sm">
            <li v-for="p in donePages" :key="p.page">
              <UBadge color="success" variant="subtle">
                Halaman {{ p.page }}{{ p.source ? `: ${p.source}` : '' }}
              </UBadge>
            </li>
          </ul>
        </div>
      </DsPanel>

      <UAlert
        v-if="failure"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        title="Pengekstrakan gagal"
        :description="failure"
        data-testid="intake-failure"
      />

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          type="submit"
          size="lg"
          icon="i-ph-magic-wand"
          :loading="busy"
          :disabled="!canSubmit"
          data-testid="intake-submit"
        >
          Muat naik dan ekstrak
        </UButton>
        <UButton
          type="button"
          size="lg"
          variant="outline"
          color="neutral"
          icon="i-ph-flask"
          :disabled="busy || !form.source.trim() || !form.copyright"
          data-testid="intake-sample"
          @click="useSample"
        >
          Cuba dengan kertas contoh
        </UButton>
      </div>
    </form>
  </DsPage>
</template>
