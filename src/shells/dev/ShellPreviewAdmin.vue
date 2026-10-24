<script setup lang="ts">
/**
 * Dev-only admin shell preview body (see `ShellPreviewPicker.vue`). Renders inside the real
 * `AdminShell` (route meta `layout: 'admin'`); for a teacher the shell shows the teacher variant.
 * Only this body is a placeholder: no admin module page exists yet. Not part of any task's
 * acceptance; registered only when `import.meta.env.DEV`.
 */
import { computed } from 'vue'

import { adminMenuFor, flatItems } from '@/shells/nav/admin-nav'
import { useSessionStore } from '@/stores/session'

const session = useSessionStore()
const role = computed(() => session.role)
const labels = computed(() => flatItems(adminMenuFor(role.value)).map((i) => i.label))
</script>

<template>
  <div class="rounded-2xl bg-white p-6 shadow" data-testid="dev-shell-admin-preview">
    <h2 class="text-xl font-bold">Pratonton bingkai admin — {{ session.user?.name }}</h2>
    <p class="mt-1 text-slate-600">
      Peranan: <strong>{{ role }}</strong> · Emel: {{ session.user?.email }}
    </p>
    <p class="mt-4 max-w-2xl text-slate-600">
      Ini bukan skrin sebenar. Sidebar, header, navigasi bawah dan menu "Lagi" di sekeliling kotak
      ini ialah komponen bingkai admin sebenar (F-18). Untuk guru, bingkai memaparkan varian guru.
    </p>
    <h3 class="mt-6 font-semibold">Item menu peranan ini ({{ labels.length }}):</h3>
    <ul class="mt-2 list-inside list-disc text-sm text-slate-700">
      <li v-for="label in labels" :key="label">{{ label }}</li>
    </ul>
    <RouterLink to="/__dev/shell" class="mt-6 inline-block font-semibold text-indigo-600"
      >← Kembali ke pratonton</RouterLink
    >
  </div>
</template>
