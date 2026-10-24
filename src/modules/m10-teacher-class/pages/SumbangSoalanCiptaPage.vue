<script setup lang="ts">
/**
 * S22 `/guru/soalan/cipta` "Tambah Soalan Baru" (M10-T6; FR-M10-99..106). "Hantar untuk Semakan" posts
 * #53 (the question is stored `pending_review`, active) and returns to S21 with a flash (UNVERIFIED
 * COPY); a 422 shows its messages and keeps the form values. "Batal" leaves without saving.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useFlash } from '@/composables'
import { DsBackLink, DsPage } from '@/ds'

import { createContributedQuestion } from '../api/guru'
import type { CreateQuestionRequest } from '../api/types'
import { COPY } from '../components/soalan/lib'
import QuestionForm from '../components/soalan/QuestionForm.vue'
import { moduleMessage } from '../lib/generic-server-text'

const router = useRouter()
const flash = useFlash()

const saving = ref(false)
const general = ref<string[]>([])
const fields = ref<Record<string, string>>({})

async function save(
  body: CreateQuestionRequest,
  image: File | null,
  optionImages: (File | null)[],
): Promise<void> {
  if (saving.value) return
  saving.value = true
  general.value = []
  fields.value = {}
  try {
    await createContributedQuestion(body, { questionImage: image, optionImages })
    flash.success(COPY.created)
    await router.push('/guru/soalan')
  } catch (err) {
    if (isApiError(err) && err.fields) {
      fields.value = err.fields
      general.value = Object.values(err.fields)
    } else {
      general.value = [moduleMessage(err) ?? COPY.saveFailed]
    }
    window.scrollTo?.({ top: 0 })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage class="max-w-4xl" data-testid="soalan-cipta-page">
    <DsBackLink to="/guru/soalan" label="Kembali ke Senarai Soalan" data-testid="back-link" />
    <QuestionForm :saving="saving" :general="general" :fields="fields" @submit="save" />
  </DsPage>
</template>
