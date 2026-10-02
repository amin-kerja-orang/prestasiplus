<script setup lang="ts">
/**
 * Dev-only shell preview body (see `ShellPreviewPicker.vue`). Renders inside the real `UserShell`
 * (route meta `layout: 'user'`), so the sidebar, header, drawer and bottom nav are the built
 * components reading the real session and `USER_NAV` — only this body is a placeholder, because no
 * module page exists yet.
 */
import { computed } from 'vue'

import { navFor } from '@/shells/nav/user-nav'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const role = computed(() => session.role)
const sidebarLabels = computed(() =>
  navFor(role.value, 'sidebar')
    .filter((e) => e.kind === 'item' || e.kind === 'group')
    .map((e) => e.label),
)
</script>

<template>
  <div class="rounded-2xl bg-white p-6 shadow" data-testid="dev-shell-preview">
    <h2 class="text-xl font-bold">Pratonton bingkai — {{ session.user?.name }}</h2>
    <p class="mt-1 text-slate-600">
      Peranan: <strong>{{ role }}</strong> · E-mel: {{ session.user?.email }}
    </p>
    <p class="mt-4 max-w-2xl text-slate-600">
      Ini bukan skrin sebenar. Sidebar, header, laci mudah alih dan navigasi bawah di sekeliling
      kotak ini ialah komponen bingkai sebenar (F-19), diuji dalam E2E. Kandungan halaman untuk
      setiap modul akan dibina mengikut gelombang build 1.0.
    </p>
    <h3 class="mt-6 font-semibold">Menu sidebar peranan ini ({{ sidebarLabels.length }} item):</h3>
    <ul class="mt-2 list-inside list-disc text-sm text-slate-700">
      <li v-for="label in sidebarLabels" :key="label">{{ label }}</li>
    </ul>
    <RouterLink to="/__dev/shell" class="mt-6 inline-block font-semibold text-indigo-600"
      >← Kembali ke pratonton</RouterLink
    >
  </div>
</template>
