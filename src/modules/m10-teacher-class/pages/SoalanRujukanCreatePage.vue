<script setup lang="ts">
/**
 * `/guru/soalan-guru/cipta` "Cipta Soalan & Rujukan" (PRD-20 R1-GUR-44a; AC-GUR-44a-1..3, -7, -8): "Simpan Soalan" posts
 * API-GUR-24 and returns to the list with "Soalan disimpan."; a 422 shows its messages under the fields and keeps the
 * values; "Batal" leaves without saving.
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { isApiError } from '@/api'
import { useFlash } from '@/composables'
import { DsBackLink, DsPage } from '@/ds'

import { createPersonalQuestion } from '../api/personal-questions'
import type { PersonalQuestionRequest } from '../api/personal-questions-types'
import { RUJUKAN_COPY } from '../components/soalan-rujukan/copy'
import RujukanForm from '../components/soalan-rujukan/RujukanForm.vue'
import { COPY } from '../components/soalan/lib'
import { moduleMessage } from '../lib/generic-server-text'

const router = useRouter()
const flash = useFlash()

const saving = ref(false)
const general = ref<string[]>([])
const fields = ref<Record<string, string>>({})

async function save(body: PersonalQuestionRequest): Promise<void> {
  if (saving.value) return
  saving.value = true
  general.value = []
  fields.value = {}
  try {
    await createPersonalQuestion(body)
    flash.success(RUJUKAN_COPY.saved)
    await router.push('/guru/soalan-guru')
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
  <DsPage class="max-w-4xl" data-testid="rujukan-cipta-page">
    <DsBackLink to="/guru/soalan-guru" :label="RUJUKAN_COPY.backToList" data-testid="back-link" />
    <RujukanForm :saving="saving" :general="general" :fields="fields" @submit="save" />
  </DsPage>
</template>
