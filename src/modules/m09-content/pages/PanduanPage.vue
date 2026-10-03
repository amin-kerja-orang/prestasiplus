<script setup lang="ts">
/**
 * S26 `/panduan` and S27 `/pusat-tuisyen/panduan` (FR-M09-112 to FR-M09-118): the same standalone
 * user guide. Five role tabs (initial role = the URL hash without "#", or `pelajar`; an unknown
 * hash leaves no tab active and no panel, as live), the help box fed by `GET /api/config/support`
 * (#43) and, for a guest, the "Daftar Percuma Sekarang" button.
 */
import { Mail, Rocket } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useSession } from '@/composables/useSession'
import { LOGO_URL } from '@/shells/shared/brand'
import ShellLink from '@/shells/shared/ShellLink.vue'

import { fetchSupportConfig } from '../api/content'
import WhatsAppIcon from '../components/icons/WhatsAppIcon.vue'
import PanduanRolePanel from '../components/panduan/PanduanRolePanel.vue'
import PanduanTopBar from '../components/panduan/PanduanTopBar.vue'
import { GUIDE_ROLES, roleFromHash } from '../lib/panduan-content'

/** Live defaults, used until `GET /api/config/support` answers (or if it fails). */
const DEFAULT_SUPPORT = { email: 'support@prestasiplus.my', whatsappNumber: '60123456789' }

const route = useRoute()
const { isLoggedIn } = useSession()

const activeRole = ref<string>(roleFromHash(route.hash))
const activePanel = computed(() => GUIDE_ROLES.find((r) => r.id === activeRole.value) ?? null)

// `/panduan` and `/pusat-tuisyen/panduan` share this component: re-read the hash on a route switch.
watch(
  () => route.path,
  () => {
    activeRole.value = roleFromHash(route.hash)
  },
)

const support = useApi((signal) => fetchSupportConfig({ signal }))
const config = computed(() => support.data.value ?? DEFAULT_SUPPORT)

function setRole(id: string): void {
  activeRole.value = id
  // As live: `history.replaceState` (keeps the router's own state object), then scroll to the top.
  window.history.replaceState(window.history.state, '', `#${id}`)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div
    :key="route.path"
    class="min-h-screen overflow-x-hidden bg-slate-50 font-body"
    data-testid="panduan-page"
  >
    <PanduanTopBar :logged-in="isLoggedIn" />

    <main class="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <header
        class="rounded-3xl bg-gradient-to-br from-indigo-700 via-purple-600 to-indigo-500 px-4 py-8 text-center text-white sm:py-10"
      >
        <div class="mb-2 text-5xl" aria-hidden="true">📖</div>
        <h1 class="font-heading text-2xl font-extrabold text-white sm:text-4xl">
          Panduan Pengguna PRESTASIPLUS
        </h1>
        <p class="mt-2 text-sm text-indigo-100 sm:text-base">
          Pilih peranan anda untuk mula. Semua maklumat di hujung jari!
        </p>
      </header>

      <div
        class="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5"
        data-testid="panduan-tabs"
      >
        <div
          v-for="role in GUIDE_ROLES"
          :key="role.id"
          class="flex min-h-11 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5"
          :class="
            activeRole === role.id
              ? 'border-indigo-500 shadow-[0_8px_20px] shadow-indigo-500/25'
              : 'border-transparent'
          "
          :data-testid="`panduan-tab-${role.id}`"
          :data-active="activeRole === role.id"
          @click="setRole(role.id)"
        >
          <span class="text-2xl" aria-hidden="true">{{ role.emoji }}</span>
          <span class="font-heading text-sm font-bold text-slate-900">{{ role.label }}</span>
          <span class="text-xs text-slate-400">{{ role.sub }}</span>
        </div>
      </div>

      <div class="mt-6">
        <PanduanRolePanel v-if="activePanel" :key="activePanel.id" :role="activePanel" />
      </div>

      <section
        class="mt-8 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-8 text-center"
        data-testid="panduan-help"
      >
        <div class="text-4xl" aria-hidden="true">💬</div>
        <h2 class="mt-2 font-heading text-xl font-bold text-slate-900">Perlukan Bantuan Lanjut?</h2>
        <p class="mt-1 text-sm text-slate-600">
          Hubungi pasukan sokongan kami untuk sebarang pertanyaan.
        </p>
        <div class="mt-4 flex flex-wrap items-center justify-center gap-3">
          <a
            :href="`mailto:${config.email}`"
            class="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white shadow-md"
            data-testid="panduan-email"
            ><Mail class="h-4 w-4" aria-hidden="true" />E-mel Kami</a
          >
          <a
            :href="`https://wa.me/${config.whatsappNumber}`"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex min-h-11 items-center gap-2 rounded-full bg-emerald-500 px-5 text-sm font-bold text-white shadow-md"
            data-testid="panduan-whatsapp"
            ><WhatsAppIcon class="h-4 w-4" />WhatsApp</a
          >
        </div>
        <ShellLink
          v-if="!isLoggedIn"
          to="/register"
          class="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full px-6 text-sm font-bold text-white shadow-lg bg-cta-gradient"
          data-testid="panduan-register"
        >
          <Rocket class="h-4 w-4" aria-hidden="true" />Daftar Percuma Sekarang
        </ShellLink>
      </section>
    </main>

    <footer class="mt-10 bg-slate-900 px-4 py-8 text-center text-sm text-slate-300">
      <p>© 2026 🇲🇾</p>
      <img :src="LOGO_URL" alt="PRESTASIPLUS" class="mx-auto my-3 h-8 w-auto" />
      <p class="text-xs text-slate-400">Platform Latih Tubi Nasional</p>
    </footer>
  </div>
</template>
