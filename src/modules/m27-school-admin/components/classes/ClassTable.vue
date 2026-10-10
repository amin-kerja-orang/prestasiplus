<script setup lang="ts">
/**
 * S8 table (FR-M27-112, 113, 115; PROPOSED, D23): columns "#", "Kelas" (name, a link to M08 S5
 * `/prestasi/kelas/{id}`; an inactive class carries the badge "Tidak Aktif"), "Subjek" ("Tiada Subjek"),
 * "Tingkatan", "Guru", "Murid", "Kod Kelas". Empty: one full-width row "Tiada kelas dijumpai" and "Sila
 * cipta kelas terlebih dahulu". The table scrolls inside its card (min width 720).
 */
import { RouterLink } from 'vue-router'

import { DataTableCard, TABLE_CLASSES as T } from '@/components/data'
import { formatCount } from '@/lib/number'

import type { SchoolClassRow } from '../../api/school-admin'

defineProps<{ rows: SchoolClassRow[]; from: number }>()
</script>

<template>
  <DataTableCard :min-width="720">
    <table :class="T.table" data-testid="kl-table">
      <thead>
        <tr>
          <th :class="T.th">#</th>
          <th :class="T.th">Kelas</th>
          <th :class="T.th">Subjek</th>
          <th :class="T.th">Tingkatan</th>
          <th :class="T.th">Guru</th>
          <th :class="[T.th, 'text-right']">Murid</th>
          <th :class="T.th">Kod Kelas</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="rows.length === 0" :class="T.row" data-testid="kl-empty">
          <td colspan="7" class="px-4 py-10 text-center">
            <span class="block text-sm font-semibold text-slate-700">Tiada kelas dijumpai</span>
            <span class="block text-sm text-slate-500">Sila cipta kelas terlebih dahulu</span>
          </td>
        </tr>
        <tr v-for="(c, i) in rows" :key="c.key" :class="T.row" data-testid="kl-row">
          <td :class="T.td" data-testid="kl-no">{{ from + i }}</td>
          <td :class="T.td">
            <RouterLink
              :to="c.link"
              class="inline-flex min-h-11 items-center font-semibold text-blue-700 hover:underline"
              data-testid="kl-name"
              >{{ c.name }}</RouterLink
            >
            <span
              v-if="!c.isActive"
              class="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700"
              data-testid="kl-inactive"
              >Tidak Aktif</span
            >
          </td>
          <td :class="T.td" data-testid="kl-subject">{{ c.subject?.name ?? 'Tiada Subjek' }}</td>
          <td :class="[T.td, 'whitespace-nowrap']" data-testid="kl-level-cell">
            {{ c.levelLabel }}
          </td>
          <td :class="T.td" data-testid="kl-teacher">{{ c.teacherName ?? '-' }}</td>
          <td :class="[T.td, 'text-right']" data-testid="kl-members">
            {{ formatCount(c.members) }}
          </td>
          <td :class="[T.td, 'font-mono whitespace-nowrap']" data-testid="kl-code">
            {{ c.joinCode ?? '-' }}
          </td>
        </tr>
      </tbody>
    </table>
  </DataTableCard>
</template>
