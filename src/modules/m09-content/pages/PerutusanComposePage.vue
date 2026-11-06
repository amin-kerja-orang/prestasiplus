<script setup lang="ts">
/**
 * S24 `/perutusan/tulis` "Tulis Perutusan" (card S5-T09; R1-AS-2, FR-AS-2-6). Tajuk (max 150) and
 * Kandungan (max 2000) are validated on submit, so the over-limit messages can show (no `maxlength`).
 * The scope is read-only: "Sekolah" for a school admin, the context label (national) for Admin Pusat.
 * Posts `{title, body, status: 'published'}` only; success sets the flash "Perutusan dihantar." and
 * goes to `/perutusan/saya`; 422 field messages show under the fields. A caller that cannot write
 * (`canWrite = false`) gets the 403 page.
 */
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { useApi, useFlash } from '@/composables'
import { DsFormField, DsLoadError, DsPage, DsPanel, DsStack } from '@/ds'

import { createPerutusan, fetchComposeContext } from '../api'
import { errorLines, fieldErrors } from '../lib/admin-articles-notes'

const TITLE_MAX = 150
const BODY_MAX = 2000
const SCHOOL_SCOPE = 'Sekolah'
const SENT = 'Perutusan dihantar.'
const MINE_PATH = '/perutusan/saya'
const LOAD_FAILED = 'Borang tidak dapat dimuatkan. Sila cuba lagi.'
const MSG = {
  titleRequired: 'Sila isi tajuk perutusan.',
  titleMax: 'Tajuk perutusan tidak boleh melebihi 150 aksara.',
  bodyRequired: 'Sila isi kandungan perutusan.',
  bodyMax: 'Kandungan perutusan tidak boleh melebihi 2000 aksara.',
} as const

const router = useRouter()
const flash = useFlash()

const { data: context, error: contextError, reload } = useApi((signal) =>
  fetchComposeContext({ signal }),
)
watch(
  context,
  (value) => {
    if (value && !value.canWrite) setRouteOutcome(403)
  },
  { immediate: true },
)

const scopeText = computed(() => {
  if (!context.value) return ''
  return context.value.scope === 'school' ? SCHOOL_SCOPE : context.value.scopeLabel
})

const form = reactive({ title: '', body: '' })
const messages = ref<Record<string, string>>({})
const topErrors = ref<string[]>([])
const saving = ref(false)

function validate(): Record<string, string> {
  const found: Record<string, string> = {}
  const title = form.title.trim()
  if (title === '') found.title = MSG.titleRequired
  else if (title.length > TITLE_MAX) found.title = MSG.titleMax
  const body = form.body.trim()
  if (body === '') found.body = MSG.bodyRequired
  else if (body.length > BODY_MAX) found.body = MSG.bodyMax
  return found
}

async function submit(): Promise<void> {
  if (saving.value) return
  topErrors.value = []
  messages.value = validate()
  if (Object.keys(messages.value).length > 0) return
  saving.value = true
  try {
    await createPerutusan({ title: form.title.trim(), body: form.body.trim(), status: 'published' })
    flash.success(SENT)
    await router.push(MINE_PATH)
  } catch (err) {
    const fields = fieldErrors(err)
    messages.value = fields
    const unmatched = Object.entries(fields)
      .filter(([name]) => name !== 'title' && name !== 'body')
      .map(([, text]) => text)
    topErrors.value = Object.keys(fields).length === 0 ? errorLines(err) : unmatched
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage layout="form" data-testid="perutusan-compose-page">
    <DsLoadError v-if="contextError" :message="LOAD_FAILED" @retry="reload()" />
    <DsPanel v-else-if="!context" data-testid="perutusan-compose-skeleton">
      <DsStack gap="lg">
        <USkeleton v-for="n in 3" :key="n" class="h-11 w-full" />
      </DsStack>
    </DsPanel>
    <form
      v-else-if="context.canWrite"
      method="post"
      novalidate
      class="min-w-0"
      data-testid="perutusan-compose-form"
      @submit.prevent="submit"
    >
      <DsPanel>
        <DsStack gap="lg">
          <UAlert
            v-if="topErrors.length > 0"
            color="error"
            variant="subtle"
            icon="i-ph-warning-circle"
            role="alert"
            data-testid="perutusan-compose-alert"
          >
            <template #description>
              <p v-for="line in topErrors" :key="line">{{ line }}</p>
            </template>
          </UAlert>

          <DsFormField native for="perutusan-title" label="Tajuk" required :error="messages.title">
            <UInput
              id="perutusan-title"
              v-model="form.title"
              name="title"
              size="md"
              class="w-full"
              :color="messages.title ? 'error' : undefined"
              :aria-invalid="messages.title ? 'true' : undefined"
              data-testid="perutusan-title-input"
            />
          </DsFormField>

          <DsFormField
            native
            for="perutusan-body"
            label="Kandungan"
            required
            :error="messages.body"
          >
            <UTextarea
              id="perutusan-body"
              v-model="form.body"
              name="body"
              :rows="8"
              size="md"
              class="w-full"
              :color="messages.body ? 'error' : undefined"
              :aria-invalid="messages.body ? 'true' : undefined"
              data-testid="perutusan-body-input"
            />
          </DsFormField>

          <DsFormField native for="perutusan-scope" label="Skop" readonly>
            <UInput
              id="perutusan-scope"
              :model-value="scopeText"
              readonly
              size="md"
              class="w-full"
              data-testid="perutusan-scope-input"
            />
          </DsFormField>

          <div>
            <UButton
              type="submit"
              :loading="saving"
              :disabled="saving"
              class="min-h-11"
              data-testid="perutusan-submit"
              >{{ saving ? 'Menyimpan...' : 'Hantar Perutusan' }}</UButton
            >
          </div>
        </DsStack>
      </DsPanel>
    </form>
  </DsPage>
</template>
