<script setup lang="ts">
/**
 * S3 Murid tab (FR-M27-72): heading "Senarai Murid ({n}) — Top 200", pills "Semua", "Aktif", "Login Sahaja",
 * "Belum Login" (each lists its own pupils, up to 200), the search "Cari murid...", the tiles "Jumlah Murid",
 * "Pernah Latihan", "Jumlah Sesi", "Purata Ketepatan" and the table "#", "Nama", "Kelas", "Sesi", "Ketepatan",
 * "Masa", "Syiling", "Login Terakhir". No "Sekolah" column and no school select. The table scrolls inside its
 * card; a search with no match shows no rows.
 */
import { computed, ref } from 'vue'

import type { SchoolActivityReport } from '../../api/school-admin'
import { accuracy, count, duration, lastLogin, matches, NO_DATA } from './activity-format'

const props = defineProps<{ report: SchoolActivityReport }>()

type Filter = 'semua' | 'aktif' | 'loginSahaja' | 'belumLogin'
const filter = ref<Filter>('semua')
const query = ref('')

const PILLS: { key: Filter; label: string; testid: string }[] = [
  { key: 'semua', label: 'Semua', testid: 'semua' },
  { key: 'aktif', label: 'Aktif', testid: 'aktif' },
  { key: 'loginSahaja', label: 'Login Sahaja', testid: 'login-sahaja' },
  { key: 'belumLogin', label: 'Belum Login', testid: 'belum-login' },
]

const t = computed(() => props.report.tiles.pupils)

const rows = computed(() =>
  props.report.pupils[filter.value].filter((r) => matches(query.value, r.name, r.className)),
)

const tiles = computed(() => [
  { key: 'total', label: 'Jumlah Murid', value: count(t.value.total) },
  { key: 'practised', label: 'Pernah Latihan', value: count(t.value.practised) },
  { key: 'sessions', label: 'Jumlah Sesi', value: count(t.value.sessions) },
  // "no attempts" is not "averaging zero" (S1 rule): the dash without a session (INFERRED)
  {
    key: 'accuracy',
    label: 'Purata Ketepatan',
    value: t.value.sessions > 0 ? accuracy(t.value.accuracy) : NO_DATA,
  },
])
</script>

<template>
  <section class="min-w-0 space-y-4" data-testid="la-murid">
    <h2 class="text-lg font-bold text-slate-800" data-testid="la-murid-title">
      Senarai Murid ({{ count(t.total) }}) — Top 200
    </h2>

    <div class="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4" data-testid="la-murid-tiles">
      <div
        v-for="x in tiles"
        :key="x.key"
        class="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4"
        :data-testid="`la-murid-tile-${x.key}`"
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
      <div class="flex min-w-0 flex-wrap gap-2" data-testid="la-murid-pills">
        <button
          v-for="p in PILLS"
          :key="p.key"
          type="button"
          :class="[
            'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
            p.key === filter
              ? 'border-indigo-600 bg-indigo-600 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
          ]"
          :data-testid="`la-murid-pill-${p.testid}`"
          :data-active="p.key === filter ? 'true' : 'false'"
          @click="filter = p.key"
        >
          {{ p.label }}
        </button>
      </div>
      <input
        v-model="query"
        type="search"
        placeholder="Cari murid..."
        class="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 px-3 text-sm sm:w-64"
        data-testid="la-murid-search"
      />
    </div>

    <div class="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div class="overflow-x-auto" data-testid="la-murid-scroll">
        <table class="w-full min-w-[44rem] text-left text-sm" data-testid="la-murid-table">
          <thead>
            <tr class="border-b border-slate-200 text-xs font-bold text-slate-500 uppercase">
              <th scope="col" class="px-3 py-3">#</th>
              <th scope="col" class="px-3 py-3">Nama</th>
              <th scope="col" class="px-3 py-3">Kelas</th>
              <th scope="col" class="px-3 py-3 text-right">Sesi</th>
              <th scope="col" class="px-3 py-3 text-right">Ketepatan</th>
              <th scope="col" class="px-3 py-3 text-right">Masa</th>
              <th scope="col" class="px-3 py-3 text-right">Syiling</th>
              <th scope="col" class="px-3 py-3">Login Terakhir</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(r, i) in rows"
              :key="r.userId"
              class="border-b border-slate-100 last:border-0"
              data-testid="la-murid-row"
            >
              <td class="px-3 py-2.5 text-slate-500">{{ i + 1 }}</td>
              <td class="px-3 py-2.5 font-semibold text-slate-700" data-testid="la-murid-name">
                {{ r.name }}
              </td>
              <td class="px-3 py-2.5 text-slate-600" data-testid="la-murid-kelas">
                {{ r.className ?? '-' }}
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums" data-testid="la-murid-sesi">
                {{ count(r.sessions) }}
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums" data-testid="la-murid-ketepatan">
                {{ accuracy(r.accuracy) }}
              </td>
              <td class="px-3 py-2.5 text-right whitespace-nowrap tabular-nums" data-testid="la-murid-masa">
                {{ duration(r.seconds) }}
              </td>
              <td class="px-3 py-2.5 text-right tabular-nums" data-testid="la-murid-syiling">
                {{ count(r.coins) }}
              </td>
              <td class="px-3 py-2.5 whitespace-nowrap text-slate-600" data-testid="la-murid-last">
                {{ lastLogin(r.lastLoginAt) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>
