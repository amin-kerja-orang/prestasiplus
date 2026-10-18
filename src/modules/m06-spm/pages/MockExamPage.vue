<script setup lang="ts">
/**
 * S11 `/spm-mock` "SPM Mock Exam" (M06-T4; FR-M06-67…71, BR-M06-29, DV-M06-06/08).
 *
 * Hero, Duta block, warning box, the "Jana Mock SPM" form (native `required` on both selects: an empty
 * subject never sends a request) and the "Mock Sebelum Ini" list, newest first. Generating calls
 * `POST /api/spm-mocks` and goes to Q4 `/spm-mock/{id}`. Below 640 px the fields stack and the chip and
 * link of each row sit on their own line (DV-M06-08).
 */
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useApi } from '@/composables'
import { DsFormField, DsNativeSelect, DsPage, DsPanel, DsLoadError } from '@/ds'
import { diffForHumans } from '@/lib/time'

import { createMock, fetchMocks } from '../api'
import DutaBlock from '../components/DutaBlock.vue'
import { GRADE_COLOR, MOCK_SUBJECT_OPTIONS, scoreLabel } from '../components/mock-lib'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'

const router = useRouter()
const { data, error, loading, reload } = useApi((signal) => fetchMocks({ signal }))
const mocks = computed(() => data.value ?? [])

const subject = ref('')
const paper = ref<'1' | '2'>('1')
const busy = ref(false)
const formError = ref<string | null>(null)

async function generate(): Promise<void> {
  if (busy.value) return
  busy.value = true
  formError.value = null
  try {
    const res = await createMock({
      subject: subject.value,
      paperNumber: paper.value === '2' ? 2 : 1,
    })
    await router.push(`/spm-mock/${String(res.id)}`)
  } catch (err) {
    formError.value = isApiError(err) && err.fields?.subject ? err.fields.subject : LOAD_ERROR
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsPage
    title="📝 SPM Mock Exam"
    subtitle="Mock SPM penuh dengan timer + auto-grade + weakness analysis. Boleh attempt setiap bulan."
    :show-title="true"
    title-testid="mock-title"
    data-testid="mock-page"
  >
    <DutaBlock
      title="⭐ Maestro SPM Untuk Anda"
      text="Cikgu pakar yg dah bantu pelajar score A+ — tonton video mereka sebelum mula mock."
    />

    <UAlert
      color="warning"
      variant="soft"
      icon="i-ph-warning-duotone"
      data-testid="mock-warning"
    >
      <template #description>
        <b>Persediaan sebelum mula:</b> Pastikan masa anda cukup. Setelah klik "Mula", timer akan
        jalan dan tak boleh stop. Kalau pause, score akan jejas.
      </template>
    </UAlert>

    <DsPanel title="Jana Mock SPM" icon="i-ph-exam-duotone" accent="heat">
      <form class="flex flex-col gap-4" data-testid="mock-form" @submit.prevent="generate">
        <UAlert
          v-if="formError"
          color="error"
          variant="soft"
          icon="i-ph-warning-circle-duotone"
          :title="formError"
          data-testid="mock-form-error"
        />
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <DsFormField label="Subjek" native>
            <template #default="{ id }">
              <DsNativeSelect
                :id="id"
                v-model="subject"
                name="subject"
                required
                placeholder="Pilih subjek"
                data-testid="mock-subject"
              >
                <option v-for="s in MOCK_SUBJECT_OPTIONS" :key="s" :value="s">{{ s }}</option>
              </DsNativeSelect>
            </template>
          </DsFormField>
          <DsFormField label="Paper" native>
            <template #default="{ id }">
              <DsNativeSelect
                :id="id"
                v-model="paper"
                name="paper_number"
                required
                data-testid="mock-paper"
              >
                <option value="1">Paper 1 (Objektif)</option>
                <option value="2">Paper 2 (Esei/Struktur)</option>
              </DsNativeSelect>
            </template>
          </DsFormField>
        </div>
        <UButton
          type="submit"
          size="lg"
          :loading="busy"
          :disabled="busy"
          class="min-h-11 self-start max-sm:w-full max-sm:justify-center"
          data-testid="mock-generate"
          >🎯 Jana Mock SPM</UButton
        >
      </form>
    </DsPanel>

    <DsPanel title="📚 Mock Sebelum Ini" data-testid="mock-history">
      <div v-if="loading && !data" class="flex flex-col gap-2" data-testid="mock-skeleton">
        <USkeleton v-for="n in 3" :key="n" class="h-16" />
      </div>
      <DsLoadError
        v-else-if="error"
        :message="LOAD_ERROR"
        testid="mock-error"
        retry-testid="mock-retry"
        @retry="reload()"
      />
      <ul v-else class="flex flex-col gap-2" data-testid="mock-list">
        <li v-for="m in mocks" :key="m.id" :data-testid="`mock-row-${String(m.id)}`">
          <UCard variant="subtle" :ui="{ body: 'p-3' }">
            <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
              <div class="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                <p class="text-label break-words text-highlighted" data-testid="mock-row-title">
                  {{ m.subject }} · Paper {{ m.paperNumber }}
                </p>
                <p class="text-caption text-muted" data-testid="mock-row-meta">
                  {{ diffForHumans(m.createdAt) }} ·
                  <span v-if="m.status === 'in_progress'" class="text-error">Belum submit</span>
                  <template v-else>{{
                    scoreLabel(m.score ?? 0, m.maxScore, m.percent ?? 0)
                  }}</template>
                </p>
              </div>
              <UBadge
                :color="GRADE_COLOR[m.status === 'in_progress' ? 'pending' : (m.grade ?? 'G')]"
                variant="soft"
                size="lg"
                data-testid="mock-row-grade"
                >{{ m.status === 'in_progress' ? 'Belum' : m.grade }}</UBadge
              >
              <RouterLink
                :to="
                  m.status === 'in_progress'
                    ? `/spm-mock/${String(m.id)}`
                    : `/spm-mock/${String(m.id)}/result`
                "
                class="inline-flex min-h-11 items-center px-2 text-label text-primary"
                data-testid="mock-row-link"
                >{{ m.status === 'in_progress' ? 'Sambung →' : 'Lihat →' }}</RouterLink
              >
            </div>
          </UCard>
        </li>
      </ul>
    </DsPanel>
  </DsPage>
</template>
