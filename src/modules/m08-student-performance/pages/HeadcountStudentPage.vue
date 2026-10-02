<script setup lang="ts">
/**
 * S15 `/headcount/student/{id}` "Headcount — Prestasi Individu" (M08-T6; FR-M08-92…96, 127). One section
 * per config that holds an entry of the pupil (config id ascending). The back control goes back in the
 * history, as live does (to `/headcount` when there is none). An unknown pupil is the 404 page, a pupil
 * or config the viewer may not open the 403 page (§9).
 */
import { ArrowLeft, GraduationCap } from '@lucide/vue'
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { usePageMeta } from '@/composables/usePageMeta'

import { fetchHeadcountStudent } from '../api/headcount'
import LoadError from '../components/headcount/LoadError.vue'
import StudentSection from '../components/headcount/StudentSection.vue'
import { isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()

const userId = computed(() => Number(route.params.id))
const { data, error, reload } = useRouteData(
  (signal) => fetchHeadcountStudent(userId.value, { signal }),
  [userId],
)

watchEffect(() => {
  const d = data.value
  if (d) pageMeta.setTitle(`Headcount ${d.student.name} - PRESTASIPLUS`)
})

function back() {
  const state = window.history.state as { back?: string | null } | null
  if (state?.back) router.back()
  else void router.push('/headcount')
}
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="headcount-student-page">
    <LoadError v-if="isLoadError(error)" @retry="reload()" />

    <template v-else-if="data">
      <header class="flex items-center gap-3 rounded-2xl bg-white p-4 shadow">
        <button
          type="button"
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition hover:text-slate-800"
          data-testid="back-button"
          @click="back"
        >
          <ArrowLeft class="h-5 w-5" />
        </button>
        <div class="min-w-0">
          <h1
            class="flex items-center gap-2 font-heading text-lg font-bold break-words text-slate-800 sm:text-xl"
            data-testid="student-name"
          >
            <GraduationCap class="h-5 w-5 shrink-0 text-indigo-600" />{{ data.student.name }}
          </h1>
          <p class="text-sm text-slate-500" data-testid="student-subtitle">
            Headcount — Prestasi Individu<template v-if="data.student.school">
              · {{ data.student.school }}</template
            >
          </p>
        </div>
      </header>

      <section
        v-if="data.sections.length === 0"
        class="rounded-2xl bg-white p-8 text-center shadow"
        data-testid="student-empty"
      >
        <p class="text-lg font-bold text-slate-700">Belum ada headcount.</p>
      </section>

      <StudentSection v-for="s in data.sections" :key="s.configId" :section="s" />
    </template>
  </div>
</template>
