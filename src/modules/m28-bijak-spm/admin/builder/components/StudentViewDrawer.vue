<script setup lang="ts">
/** Student-view preview (`GET /admin/papers/:id/student-view`): numbered questions, a stimulus shown once per group, no key, no scheme. */
import type { BijakBuilderStudentView } from '@pp/contract'

import DsPanel from '@/ds/DsPanel.vue'

import RichText from '../../../components/RichText.vue'
import StimulusView from '../../../components/StimulusView.vue'
import type { StimulusDef } from '../../../domain/types'
import { builderCopy as t } from '../domain/copy'

defineProps<{ view: BijakBuilderStudentView | null; error?: boolean }>()
const open = defineModel<boolean>('open', { default: false })
</script>

<template>
  <USlideover v-model:open="open" :title="t.studentView" :description="t.studentViewDesc" :ui="{ content: 'max-w-2xl' }">
    <template #body>
      <p v-if="error" class="text-body text-error" role="alert">{{ t.studentViewError }}</p>
      <div v-else-if="view" class="flex flex-col gap-6" data-testid="student-view">
        <header>
          <h3 class="text-heading text-highlighted">{{ view.title }}</h3>
          <p class="text-caption text-muted">
            {{ view.subjectName }} · Kertas {{ view.kertas }} · {{ view.code }} · {{ view.durationMin }} minit ·
            {{ view.marks }} markah
          </p>
          <ol v-if="view.instructions.length" class="mt-2 list-decimal ps-6 text-body">
            <li v-for="i in view.instructions" :key="i">{{ i }}</li>
          </ol>
        </header>
        <section v-for="s in view.sections" :key="s.label" class="flex flex-col gap-3">
          <header>
            <h4 class="text-subheading text-highlighted">{{ s.label }}</h4>
            <p class="text-caption text-muted">{{ s.instruction }}</p>
          </header>
          <template v-for="(u, ui) in s.units" :key="ui">
            <DsPanel v-if="u.stimulus" data-testid="student-stimulus">
              <StimulusView :stimulus="u.stimulus as unknown as StimulusDef" />
            </DsPanel>
            <DsPanel v-for="q in u.questions" :key="q.id" :data-testid="`student-q-${q.id}`">
              <div class="flex items-baseline justify-between gap-3">
                <h5 class="text-label text-highlighted">Soalan {{ q.number }}</h5>
                <span class="tabular text-caption text-muted">[{{ q.marks }} markah]</span>
              </div>
              <p class="mt-1 text-body"><RichText :text="q.preview" /></p>
            </DsPanel>
          </template>
        </section>
      </div>
    </template>
  </USlideover>
</template>
