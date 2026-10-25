<script setup lang="ts">
/**
 * Tulis Soalan Manual (v2-question-bank 4.2, manual path): the same declaration as Muat Naik
 * Kertas, but no file. It creates a Draf batch with source kind "manual" and one empty question,
 * then opens the normal review / editor page. Nothing is published from here; the questions go
 * through the same quality gate and review queue as an extracted paper.
 */
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { DsCluster, DsPage, DsStack } from '@/ds'

import { dskpSubjects } from '../../../lib/dskp-source'
import { useBijakUser } from '../../../lib/use-bijak'
import { bijakServer } from '../../../server/client'
import IntakeMetaFields, { type IntakeForm } from '../components/IntakeMetaFields.vue'
import { INTAKE_LIST_PATH, intakeReviewPath } from '../lib/intake-routes'
import { PAPER_TYPES } from '../types'

const router = useRouter()
const route = useRoute()
const server = bijakServer()
const user = useBijakUser()

/** Coming from the paper builder: subject, kertas and the paper are pre-filled. */
const q = route.query
const one = (v: unknown): string => (typeof v === 'string' ? v : '')
const knownSubject = dskpSubjects().some((s) => s.code === one(q.subject))
/** Only a paper that exists is linked back to; anything else in the URL is ignored. */
const forPaperId = ref('')
onMounted(async () => {
  const wanted = one(q.paper)
  if (!wanted) return
  try {
    const papers = await server.listAdminPapers()
    if (papers.some((p) => p.id === wanted)) forPaperId.value = wanted
  } catch {
    forPaperId.value = ''
  }
})

const form = reactive<IntakeForm>({
  subject: knownSubject ? one(q.subject) : 'MAT',
  kertas: one(q.kertas) === '1' ? '1' : '2',
  year: String(new Date().getFullYear()),
  paperType: PAPER_TYPES[0],
  source: '',
  copyright: '',
  notes: '',
})
const busy = ref(false)
const failure = ref('')

const canSubmit = computed(
  () => !busy.value && form.source.trim().length > 0 && form.copyright !== '',
)

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  busy.value = true
  failure.value = ''
  try {
    const batch = await server.createManualBatch(user.value, {
      subject: form.subject,
      kertas: Number(form.kertas) === 1 ? 1 : 2,
      year: Number(form.year) || new Date().getFullYear(),
      paperType: form.paperType,
      source: form.source.trim(),
      copyright: form.copyright,
      notes: form.notes.trim(),
      ...(forPaperId.value ? { forPaperId: forPaperId.value } : {}),
    })
    await router.push(intakeReviewPath(batch.id))
  } catch (e) {
    failure.value = e instanceof Error ? e.message : 'Tidak dapat memulakan soalan manual.'
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsPage
    layout="form"
    title="Tulis Soalan Manual"
    subtitle="Taip soalan, pilihan dan skema sendiri tanpa PDF. Soalan dihantar untuk semakan seperti kertas yang diekstrak."
    back-label="Kembali ke Senarai Ekstrak"
    :back-to="INTAKE_LIST_PATH"
    data-testid="intake-manual-page"
  >
    <UAlert
      v-if="forPaperId"
      color="info"
      variant="subtle"
      icon="i-ph-info"
      title="Soalan untuk kertas yang sedang dibina"
      description="Subjek dan kertas diisi daripada kertas anda. Soalan baharu perlu lulus semakan dan diterbitkan sebelum boleh ditambah ke kertas."
      data-testid="manual-paper-note"
    />
    <DsStack as="form" gap="lg" @submit.prevent="submit">
      <IntakeMetaFields v-model="form" />

      <UAlert
        v-if="failure"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle"
        role="alert"
        title="Tidak dapat memulakan"
        :description="failure"
        data-testid="manual-failure"
      />

      <DsCluster>
        <UButton
          type="submit"
          size="lg"
          icon="i-ph-pencil-simple-line"
          :loading="busy"
          :disabled="!canSubmit"
          data-testid="manual-start"
        >
          Mula menulis soalan
        </UButton>
        <UButton
          :to="INTAKE_LIST_PATH"
          size="lg"
          variant="outline"
          color="neutral"
          data-testid="manual-cancel"
        >
          Batal
        </UButton>
      </DsCluster>
    </DsStack>
  </DsPage>
</template>
