<script setup lang="ts">
/**
 * S26 `/panduan` and S27 `/pusat-tuisyen/panduan` (FR-M09-112 to FR-M09-118): the same standalone
 * user guide. Five role tabs (initial role = the URL hash without "#", or `pelajar`; an unknown
 * hash leaves no tab active and no panel, as live), the help box fed by `GET /api/config/support`
 * (#43) and, for a guest, the "Daftar Percuma Sekarang" button.
 *
 * v2 restyle (B04): standalone page on the theme tokens (own top bar, no shell), role cards as
 * buttons, panels as `UCard`s.
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useSession } from '@/composables/useSession'
import { DsArt3D, DsIconChip } from '@/ds'
import { useThemeMode } from '@/theme/color-mode'

import { fetchSupportConfig } from '../api/content'
import WhatsAppIcon from '../components/icons/WhatsAppIcon.vue'
import PanduanRolePanel from '../components/panduan/PanduanRolePanel.vue'
import PanduanTopBar from '../components/panduan/PanduanTopBar.vue'
import { GUIDE_ROLES, roleFromHash, type RoleId } from '../lib/panduan-content'

/** Live defaults, used until `GET /api/config/support` answers (or if it fails). */
const DEFAULT_SUPPORT = { email: 'support@prestasiplus.my', whatsappNumber: '60123456789' }
const LOGO_URL = `${import.meta.env.BASE_URL}images/prestasiplus-logo.svg`

const ROLE_ICONS: Record<RoleId, string> = {
  pelajar: 'i-ph-student-duotone',
  guru: 'i-ph-chalkboard-teacher-duotone',
  ibubapa: 'i-ph-users-duotone',
  admin: 'i-ph-gear-six-duotone',
  ppd: 'i-ph-buildings-duotone',
}

const route = useRoute()
const { isLoggedIn, role: sessionRole } = useSession()
// Standalone page: follow the stored theme (dark by default for a student, calm staff otherwise).
useThemeMode(computed(() => (sessionRole?.value === 'student' ? 'learner' : 'staff')))

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
    class="min-h-screen overflow-x-hidden bg-default"
    data-testid="panduan-page"
  >
    <PanduanTopBar :logged-in="isLoggedIn" />

    <main class="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6 sm:px-6 md:gap-6">
      <header class="flex flex-col items-center gap-2 py-4 text-center">
        <DsArt3D name="books" size="xl" float />
        <h1 class="text-title text-highlighted">Panduan Pengguna PRESTASIPLUS</h1>
        <p class="max-w-prose text-body text-muted">
          Pilih peranan anda untuk mula. Semua maklumat di hujung jari!
        </p>
      </header>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5" data-testid="panduan-tabs">
        <UButton
          v-for="role in GUIDE_ROLES"
          :key="role.id"
          :color="activeRole === role.id ? 'primary' : 'neutral'"
          :variant="activeRole === role.id ? 'solid' : 'soft'"
          block
          class="h-auto min-h-11 flex-col gap-1 p-3 text-center"
          :data-testid="`panduan-tab-${role.id}`"
          :data-active="activeRole === role.id"
          @click="setRole(role.id)"
        >
          <UIcon :name="ROLE_ICONS[role.id]" class="size-7" aria-hidden="true" />
          <span class="text-label">{{ role.label }}</span>
          <span class="text-caption">{{ role.sub }}</span>
        </UButton>
      </div>

      <PanduanRolePanel v-if="activePanel" :key="activePanel.id" :role="activePanel" />

      <UCard data-testid="panduan-help">
        <div class="flex flex-col items-center gap-3 text-center">
          <DsIconChip icon="i-ph-chats-circle-duotone" size="lg" />
          <h2 class="text-heading text-highlighted">Perlukan Bantuan Lanjut?</h2>
          <p class="text-label text-muted">
            Hubungi pasukan sokongan kami untuk sebarang pertanyaan.
          </p>
          <div class="flex flex-wrap items-center justify-center gap-3">
            <UButton
              :to="`mailto:${config.email}`"
              icon="i-ph-envelope-simple-duotone"
              data-testid="panduan-email"
              >Emel Kami</UButton
            >
            <UButton
              :to="`https://wa.me/${config.whatsappNumber}`"
              target="_blank"
              rel="noopener noreferrer"
              color="neutral"
              variant="soft"
              data-testid="panduan-whatsapp"
            >
              <WhatsAppIcon class="size-4" />WhatsApp
            </UButton>
          </div>
          <UButton
            v-if="!isLoggedIn"
            to="/register"
            size="lg"
            icon="i-ph-rocket-launch-duotone"
            data-testid="panduan-register"
            >Daftar Percuma Sekarang</UButton
          >
        </div>
      </UCard>
    </main>

    <footer class="bg-elevated px-4 py-8 text-center text-label text-muted">
      <p>© 2026 🇲🇾</p>
      <div class="mx-auto my-3 w-32">
        <DsArt3D variant="plain" :src="LOGO_URL" alt="PRESTASIPLUS" />
      </div>
      <p class="text-caption">Platform Latih Tubi Nasional</p>
    </footer>
  </div>
</template>
