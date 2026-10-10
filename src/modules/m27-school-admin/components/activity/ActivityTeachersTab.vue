<script setup lang="ts">
/**
 * S3 Guru tab (FR-M27-71): heading "Senarai Guru ({n})", pills "Semua", "Pernah Login ({n})", "Belum Login
 * ({n})", the search "Cari guru...", the tiles "Jumlah Guru", "Pernah Login", "Jumlah Soalan", "Jumlah
 * Syiling" and the table "#", "Nama" (with the e-mail line), "Login", "MCQ", "Struktur", "Syiling",
 * "Headcount", "Login Terakhir". No "Sekolah" column and no school select. The table scrolls inside its card;
 * a search with no match shows no rows.
 */
import { Check } from '@lucide/vue'
import { computed, ref } from 'vue'

import type { SchoolActivityReport } from '../../api/school-admin'
import { count, lastLogin, matches } from './activity-format'

const props = defineProps<{ report: SchoolActivityReport }>()

type Filter = 'semua' | 'pernah' | 'belum'
const filter = ref<Filter>('semua')
const query = ref('')

const t = computed(() => props.report.tiles.teachers)

const pills = computed<{ key: Filter; label: string }[]>(() => [
  { key: 'semua', label: 'Semua' },
  { key: 'pernah', label: `Pernah Login (${count(t.value.logged)})` },
  { key: 'belum', label: `Belum Login (${count(t.value.total - t.value.logged)})` },
])

const rows = computed(() =>
  props.report.teachers.filter(
    (r) =>
      (filter.value === 'semua' || (filter.value === 'pernah') === r.loggedIn) &&
      matches(query.value, r.name, r.email),
  ),
)

const tiles = computed(() => [
  { key: 'total', label: 'Jumlah Guru', value: count(t.value.total) },
  { key: 'logged', label: 'Pernah Login', value: count(t.value.logged) },
  { key: 'questions', label: 'Jumlah Soalan', value: count(t.value.questions) },
  { key: 'coins', label: 'Jumlah Syiling', value: count(t.value.coins) },
])
</script>

<template>
  <section class="min-w-0 space-y-4" data-testid="la-guru">
    <h2 class="text-lg font-bold text-slate-800" data-testid="la-guru-title">
      Senarai Guru ({{ count(t.total) }})
    </h2>

    <div class="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4" data-testid="la-guru-tiles">
      <div
        v-for="x in tiles"
        :key="x.key"
        class="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
        :data-testid="`la-guru-tile-${x.key}`"
      >
        <p class="text-xs font-bold tracking-wide text-slate-500 uppercase" data-testid="la-tile-label">
          {{ x.label }}
        </p>
        <p class="mt-1 text-2xl font-bold break-words text-slate-800" data-testid="la-tile-value">
          {{ x.value }}
        </p>
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="flex min-w-0 flex-wrap gap-2" data-testid="la-guru-pills">
        <button
          v-for="p in pills"
          :key="p.key"
          type="button"
          :class="[
            'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
            p.key === filter
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          ]"
          :data-testid="`la-guru-pill-${p.key}`"
          :data-active="p.key === filter ? 'true' : 'false'"
          @click="filter = p.key"
        >
          {{ p.label }}
        </button>
      </div>
      <input
        v-model="query"
        type="search"
        placeholder="Cari guru..."
        class="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-sm sm:w-64"
        data-testid="la-guru-search"
      />
    </div>

    <div class="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="overflow-x-auto" data-testid="la-guru-scroll">
        <table class="w-full min-w-[44rem] text-left text-sm" data-testid="la-guru-table">
          <thead>
            <tr class="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
              <th scope="col" class="px-3 py-3">#</th>
              <th scope="col" class="px-3 py-3">Nama</th>
              <th scope="col" class="px-3 py-3">Login</th>
              <th scope="col" class="px-3 py-3 text-right">MCQ</th>
              <th scope="col" class="px-3 py-3 text-right">Struktur</th>
              <th scope="col" class="px-3 py-3 text-right">Syiling</th>
              <th scope="col" class="px-3 py-3 text-center">Headcount</th>
              <th scope="col" class="px-3 py-3">Login Terakhir</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in rows"
              :key="r.userId"
              class="border-b border-slate-100 last:border-0"
              data-testid="la-guru-row"
            >
              <td class="px-3 py-2.5 text-slate-500">{{ i + 1 }}</td>
              <td class="px-3 py-2.5">
                <p class="font-semibold text-slate-700" data-testid="la-guru-name">{{ r.name }}</p>
                <p class="text-xs text-slate-500" data-testid="la-guru-email">{{ r.email }}</p>
              </td>
              <td class="px-3 py-2.5" data-testid="la-guru-login">
                <span
                  :class="[
                    'rounded-full px-2 py-0.5 text-xs font-bold',
                    r.loggedIn ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600',
                  ]"
                  >{{ r.loggedIn ? 'Ya' : 'Belum' }}</span
                >
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums" data-testid="la-guru-mcq">
                {{ count(r.mcq) }}
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums" data-testid="la-guru-struktur">
                {{ count(r.structured) }}
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums" data-testid="la-guru-syiling">
                {{ count(r.coins) }}
              </td>
              <td class="px-3 py-2.5 text-center" data-testid="la-guru-headcount">
                <Check v-if="r.hasHeadcount" class="mx-auto h-4 w-4 text-emerald-600" />
                <span v-else class="text-slate-400">-</span>
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap text-slate-600" data-testid="la-guru-last">
                {{ lastLogin(r.lastLoginAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
