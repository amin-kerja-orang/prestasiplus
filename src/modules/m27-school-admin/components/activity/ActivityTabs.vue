<script setup lang="ts">
/**
 * S3 tabs (FR-M27-67): "Overview", "Guru ({n})", "Murid ({n})" with the chart-pie, chalkboard-teacher and
 * user-graduate icons. They switch client-side with no request; the "Sekolah" tab does not exist in the school
 * scope (DV-M27-13).
 */
import { ChartPie, GraduationCap, Presentation } from '@lucide/vue'
import { computed, type Component } from 'vue'

export type ActivityTab = 'overview' | 'guru' | 'murid'

const props = defineProps<{ active: ActivityTab; teachers: number; pupils: number }>()
const emit = defineEmits<{ select: [tab: ActivityTab] }>()

const tabs = computed<{ key: ActivityTab; label: string; icon: Component }[]>(() => [
  { key: 'overview', label: 'Overview', icon: ChartPie },
  { key: 'guru', label: `Guru (${props.teachers.toLocaleString('en-US')})`, icon: Presentation },
  { key: 'murid', label: `Murid (${props.pupils.toLocaleString('en-US')})`, icon: GraduationCap },
])
</script>

<template>
  <div
    class="flex min-w-0 gap-1 overflow-x-auto border-b border-slate-200"
    data-testid="la-tabs"
  >
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      :class="[
        'inline-flex min-h-11 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-semibold whitespace-nowrap transition-colors',
        t.key === active
          ? 'border-indigo-600 text-indigo-700'
          : 'border-transparent text-slate-500 hover:text-slate-700',
      ]"
      :data-testid="`la-tab-${t.key}`"
      :data-active="t.key === active ? 'true' : 'false'"
      @click="emit('select', t.key)"
    >
      <component :is="t.icon" class="h-4 w-4" aria-hidden="true" />{{ t.label }}
    </button>
  </div>
</template>
