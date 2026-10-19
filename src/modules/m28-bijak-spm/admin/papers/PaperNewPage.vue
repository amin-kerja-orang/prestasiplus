<script setup lang="ts">
/** Kertas Baharu (`/admin/spm/kertas/baharu`): pick subject and kertas, the blueprint loads. */
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { DsFormBar, DsFormSection, DsLoadError, DsNativeSelect, DsPage } from '@/ds'

import { bijakServer } from '../../server/client'
import { ADMIN_ROUTES, detailMessage } from './ui'

const server = bijakServer()
const router = useRouter()
const { data: blueprints, error, reload } = useApi(() => server.listBlueprints())

const subject = ref('')
const kertas = ref('')
const title = ref('')
const saving = ref(false)
const failure = ref('')

const subjectItems = computed(() => {
  const seen = new Map<string, string>()
  for (const b of blueprints.value ?? []) seen.set(b.subject, b.subjectName)
  return [...seen.entries()].map(([code, name]) => ({ code, name }))
})
const kertasItems = computed(() =>
  (blueprints.value ?? []).filter((b) => b.subject === subject.value).map((b) => b.kertas),
)
const blueprint = computed(() =>
  (blueprints.value ?? []).find(
    (b) => b.subject === subject.value && String(b.kertas) === kertas.value,
  ),
)

watch(subject, () => {
  kertas.value = kertasItems.value.length === 1 ? String(kertasItems.value[0]) : ''
})

async function submit(): Promise<void> {
  if (!blueprint.value) {
    failure.value = 'Pilih subjek dan kertas dahulu.'
    return
  }
  saving.value = true
  failure.value = ''
  try {
    const id = await server.createPaper({
      subject: blueprint.value.subject,
      kertas: blueprint.value.kertas,
      title: title.value,
    })
    await router.push({ name: ADMIN_ROUTES.paperEdit, params: { id } })
  } catch (e) {
    failure.value = detailMessage(e)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <DsPage
    layout="form"
    title="Kertas Baharu"
    subtitle="Pilih subjek dan kertas. Struktur bahagian, bajet markah dan tempoh datang daripada blueprint."
    :back-to="{ name: ADMIN_ROUTES.papers }"
    back-label="Pembina Kertas"
    data-testid="paper-new-page"
  >
    <DsLoadError v-if="error" message="Tidak dapat memuatkan blueprint." @retry="reload()" />
    <form v-else class="flex flex-col gap-6" @submit.prevent="submit">
      <DsFormSection title="Subjek dan kertas" icon="scroll" :columns="2">
        <UFormField label="Subjek" required>
          <DsNativeSelect v-model="subject" aria-label="Subjek" data-testid="new-subject">
            <option value="">Pilih subjek</option>
            <option v-for="s in subjectItems" :key="s.code" :value="s.code">{{ s.name }}</option>
          </DsNativeSelect>
        </UFormField>
        <UFormField label="Kertas" required>
          <DsNativeSelect v-model="kertas" aria-label="Kertas" data-testid="new-kertas">
            <option value="">Pilih kertas</option>
            <option v-for="k in kertasItems" :key="k" :value="String(k)">Kertas {{ k }}</option>
          </DsNativeSelect>
        </UFormField>
        <UFormField label="Tajuk kertas (pilihan)" class="md:col-span-2">
          <UInput
            v-model="title"
            class="w-full"
            placeholder="Contoh: Percubaan SPM Matematik Kertas 2 Set C"
            data-testid="new-title"
          />
        </UFormField>
      </DsFormSection>

      <DsFormSection v-if="blueprint" title="Blueprint" icon="list-checks">
        <p class="text-body text-muted" data-testid="blueprint-summary">
          {{ blueprint.code }} · {{ blueprint.durationMin }} minit ·
          {{ blueprint.totalMarks }} markah · sumber {{ blueprint.source }}
        </p>
        <ul class="flex flex-col gap-2" data-testid="blueprint-sections">
          <li
            v-for="s in blueprint.sections"
            :key="s.label"
            class="flex flex-wrap items-baseline justify-between gap-2 rounded-lg bg-muted p-3"
          >
            <span class="font-semibold text-highlighted">{{ s.label }}</span>
            <span class="text-caption text-muted"
              >{{ s.questionCount }} soalan · {{ s.markBudget }} markah · {{ s.instruction }}</span
            >
          </li>
        </ul>
      </DsFormSection>

      <p v-if="failure" class="text-body text-error" role="alert">{{ failure }}</p>

      <DsFormBar
        submit-label="Cipta Kertas"
        submit-icon="plus"
        :cancel-to="{ name: ADMIN_ROUTES.papers }"
        :saving="saving"
        :disabled="!blueprint"
      />
    </form>
  </DsPage>
</template>
