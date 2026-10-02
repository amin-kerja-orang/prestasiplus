<script setup lang="ts">
/**
 * Dev-only shell preview picker (not part of any task's acceptance; a Delivery Lead convenience so
 * the user can see the built shell chrome — sidebar, header, drawer, bottom nav — before any module
 * page exists). Registered only when `import.meta.env.DEV` (`devRoutes()`, `core-routes.ts`); never
 * part of the demo or e2e build.
 *
 * Logs in with the `setUser` test hook (overview §6.13), the same one E2E uses, then does a full
 * navigation (not a router push) so the app cold-boots and the session store picks up `pp.auth`
 * exactly as a real login would.
 */
import { ref } from 'vue'

const ROLES = [
  { email: 'pelajar@demo.test', label: 'Murid', name: 'Pelajar Demo' },
  { email: 'guru@demo.test', label: 'Guru', name: 'Guru Demo' },
  { email: 'adminsekolah@demo.test', label: 'Admin Sekolah', name: 'Pentadbir Sekolah Demo' },
] as const

/** F-18 admin shell previews (admin, and the teacher variant of the admin shell). */
const ADMIN_ROLES = [
  { email: 'admin@demo.test', label: 'Admin', text: 'Pratonton sebagai Admin' },
  { email: 'guru@demo.test', label: 'Guru-bingkai-admin', text: 'Pratonton Guru (bingkai admin)' },
] as const

const error = ref<string | null>(null)

async function previewAs(email: string, target = '/__dev/shell/preview'): Promise<void> {
  const mock = window.__mock
  if (!mock) {
    error.value = 'window.__mock tiada. Mesti jalan `npm run dev` (VITE_TEST_HOOKS=true).'
    return
  }
  await mock.setUser(email)
  window.location.href = target
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-6 sm:p-10" data-testid="dev-shell-picker">
    <h1 class="text-2xl font-bold">Pratonton bingkai (shell) — dev sahaja</h1>
    <p class="mt-2 max-w-xl text-slate-600">
      Skrin modul sebenar belum dibina. Ini log masuk sebagai akaun demo (`setUser`, sama seperti
      E2E), supaya anda boleh lihat sidebar, header dan menu setiap peranan sekarang.
    </p>
    <ul class="mt-8 flex flex-wrap gap-4">
      <li v-for="r in ROLES" :key="r.email">
        <button
          type="button"
          class="rounded-xl bg-indigo-600 px-5 py-3 font-semibold text-white shadow hover:bg-indigo-700"
          :data-testid="`dev-preview-${r.label}`"
          @click="previewAs(r.email)"
        >
          Pratonton sebagai {{ r.label }}
        </button>
      </li>
      <li v-for="r in ADMIN_ROLES" :key="r.email">
        <button
          type="button"
          class="rounded-xl bg-slate-700 px-5 py-3 font-semibold text-white shadow hover:bg-slate-800"
          :data-testid="`dev-preview-${r.label}`"
          @click="previewAs(r.email, '/__dev/shell/admin')"
        >
          {{ r.text }}
        </button>
      </li>
    </ul>
    <p v-if="error" class="mt-4 font-semibold text-red-600">{{ error }}</p>
  </div>
</template>
