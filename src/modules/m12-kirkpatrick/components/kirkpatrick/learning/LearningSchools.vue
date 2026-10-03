<script setup lang="ts">
/**
 * S3 "Pembelajaran Mengikut Sekolah" (FN-M12-4.4.1; FR-M12-39, BR-M12-10): # / Sekolah (link to the monitoring
 * school page of the mount) / Pelajar / Soalan / Ketepatan / Skor Purata / Subjek. The table scrolls inside
 * its card (NFR-RESP-05 b).
 */
import { School } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { Learning } from '../../../api/types'
import { accuracyText, CARD, count, pct, plain, type KirkpatrickPaths } from '../common'

defineProps<{ schools: Learning['schools']; paths: KirkpatrickPaths }>()

const TH = 'px-3 py-2 text-left text-xs font-bold uppercase text-slate-500'
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="kirk-schools">
    <h2 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <School class="h-5 w-5 text-green-600" />Pembelajaran Mengikut Sekolah
    </h2>
    <div class="overflow-x-auto" data-testid="kirk-schools-scroller">
      <table class="w-full min-w-[640px] text-sm">
        <thead>
          <tr class="border-b border-slate-100">
            <th :class="TH">#</th>
            <th :class="TH">Sekolah</th>
            <th :class="TH">Pelajar</th>
            <th :class="TH">Soalan</th>
            <th :class="TH">Ketepatan</th>
            <th :class="TH">Skor Purata</th>
            <th :class="TH">Subjek</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(s, i) in schools"
            :key="s.schoolId"
            class="border-b border-slate-50"
            data-testid="kirk-school-row"
          >
            <td class="px-3 py-2 font-mono text-xs text-slate-400">{{ i + 1 }}</td>
            <td class="px-3 py-2">
              <RouterLink
                :to="paths.monitoringSchool(s.schoolId)"
                class="text-indigo-600 hover:underline"
                data-testid="kirk-school-link"
                >{{ s.name }}</RouterLink
              >
            </td>
            <td class="px-3 py-2 text-slate-600">{{ count(s.students) }}</td>
            <td class="px-3 py-2 text-slate-600">{{ count(s.answers) }}</td>
            <td
              :class="['px-3 py-2 font-semibold', accuracyText(s.accuracy)]"
              data-testid="kirk-school-accuracy"
            >
              {{ pct(s.accuracy) }}
            </td>
            <td class="px-3 py-2 text-slate-600">{{ pct(s.avgScore) }}</td>
            <td class="px-3 py-2 text-slate-600">{{ plain(s.subjects) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
