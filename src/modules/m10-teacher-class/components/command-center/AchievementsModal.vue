<script setup lang="ts">
/**
 * "🏆 Badges" -> "Achievement System — Scan & Award Badges" (FR-M10-25, FN-M10-2.2.13, BR-M10-16; read-only):
 * three cards, "Senarai Lencana" chips (icon, name, "{n} pelajar", rarity), "Top Pengumpul Lencana",
 * "Baru Dianugerahkan Hari Ini!"; a chip opens "Lencana: {nama}" (the holders of the badge).
 */
import { computed, ref } from 'vue'

import { AppIcon } from '@/components/icon'
import { useApi } from '@/composables'

import { fetchCommandCenterAchievements } from '../../api/command-center'
import { useOpenTab } from './composables'
import { rarityOf, studentPath, TBL } from './copy'
import DarkModal from './DarkModal.vue'
import HoldersModal from './HoldersModal.vue'
import StatCards from './StatCards.vue'

defineEmits<{ close: [] }>()

const { data, error } = useApi((signal) => fetchCommandCenterAchievements({ signal }))
const openTab = useOpenTab()
const chosen = ref<{ id: number; name: string } | null>(null)
const cards = computed(() => {
  const d = data.value
  return [
    { label: 'Pelajar', value: String(d?.totalStudents ?? 0), tone: 'text-indigo-300' },
    { label: 'Lencana Baru Dianugerah', value: String(d?.totalNew ?? 0), tone: 'text-amber-300' },
    {
      label: 'Jenis Lencana Aktif',
      value: String(d?.badgeStats.length ?? 0),
      tone: 'text-emerald-300',
    },
  ]
})
const COLLECTOR_HEADERS = ['#', 'Pelajar', 'Jumlah Lencana']
</script>

<template>
  <DarkModal
    title="Achievement System — Scan & Award Badges"
    testid="cc-badges-modal"
    wide
    @close="$emit('close')"
  >
    <p v-if="error" class="text-sm text-rose-400">Ralat: {{ error.message }}</p>
    <p v-else-if="!data" class="text-sm text-slate-300" data-testid="cc-modal-loading">
      Mengimbas pencapaian semua pelajar...
    </p>
    <template v-else>
      <StatCards :cards="cards" cols="grid-cols-3" />

      <h4 class="mt-4 mb-2 text-sm font-bold text-slate-200">Senarai Lencana</h4>
      <ul class="flex flex-wrap gap-2" data-testid="cc-badge-chips">
        <li v-for="b in data.badgeStats" :key="b.id" class="min-w-0">
          <button
            type="button"
            class="inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl border border-slate-600 bg-slate-900/60 px-3 py-2 text-left text-sm hover:bg-slate-700"
            data-testid="cc-badge-chip"
            @click="chosen = b"
          >
            <AppIcon :name="b.icon" class="h-5 w-5 shrink-0 text-amber-300" />
            <span class="min-w-0 break-words text-slate-50">{{ b.name }}</span>
            <span class="text-xs text-slate-400">{{ b.holders }} pelajar</span>
            <span :class="['text-xs font-semibold', rarityOf(b.holders).tone]">{{
              rarityOf(b.holders).label
            }}</span>
          </button>
        </li>
      </ul>

      <template v-if="data.topCollectors.length">
        <h4 class="mt-4 mb-2 text-sm font-bold text-slate-200">Top Pengumpul Lencana</h4>
        <div :class="TBL.wrap">
          <table :class="TBL.table" data-testid="cc-collectors-table">
            <thead>
              <tr>
                <th v-for="h in COLLECTOR_HEADERS" :key="h" :class="TBL.th">{{ h }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(c, i) in data.topCollectors" :key="i" :class="TBL.row">
                <td :class="TBL.td">{{ i + 1 }}</td>
                <td :class="[TBL.td, 'text-slate-50']">{{ c.name }}</td>
                <td :class="[TBL.td, 'font-mono']">{{ c.count }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>

      <template v-if="data.newAwards.length">
        <h4 class="mt-4 mb-2 text-sm font-bold text-amber-300">Baru Dianugerahkan Hari Ini!</h4>
        <ul class="space-y-1" data-testid="cc-new-awards">
          <li
            v-for="(a, i) in data.newAwards"
            :key="i"
            class="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-slate-700/40"
            @click="openTab(studentPath(a.studentId))"
          >
            <AppIcon :name="a.icon" class="h-5 w-5 shrink-0 text-amber-300" />
            <span class="min-w-0 break-words text-slate-50">{{ a.name }}</span>
            <span class="text-slate-400">{{ a.badgeName }}</span>
          </li>
        </ul>
      </template>
    </template>

    <HoldersModal v-if="chosen" :badge="chosen" @close="chosen = null" />
  </DarkModal>
</template>
