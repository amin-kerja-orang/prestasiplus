<script setup lang="ts">
/**
 * `/__ds` Nuxt UI sandbox (V2-T02 spike). Dev and demo only. Disposable: V2-T05 replaces it with
 * the real gallery. Every component carries a `data-testid` so the spike can check forwarding.
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import { useToast } from '@nuxt/ui/composables'
import { ms } from '@nuxt/ui/locale'

const toast = useToast()
// `useColorMode` is not auto-imported in app code; mirror the `.dark` class on <html> instead.
const mode = ref(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
const obs = new MutationObserver(() => {
  mode.value = document.documentElement.classList.contains('dark') ? 'dark' : 'light'
})
onMounted(() => {
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
})
onBeforeUnmount(() => obs.disconnect())

const text = ref('')
const picked = ref('a')
const tab = ref('satu')
const modalOpen = ref(false)
const slideOpen = ref(false)
// `content` props are typed without data-* attributes, but they reach the DOM (spike check e).
const modalContent = { 'data-testid': 'ds-modal-content' } as never
const agree = ref(false)
const page = ref(1)
const searchOpen = ref(false)
const sidebarOpen = ref(false)

const selectItems = [
  { label: 'Pilihan A', value: 'a' },
  { label: 'Pilihan B', value: 'b' },
]
const tabItems = [
  { label: 'Satu', value: 'satu', slot: 'satu' },
  { label: 'Dua', value: 'dua', slot: 'dua' },
]
const tableRows = [
  { id: 1, nama: 'Murid Contoh A', markah: 82 },
  { id: 2, nama: 'Murid Contoh B', markah: 67 },
]
const tableColumns = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'nama', header: 'Nama' },
  { accessorKey: 'markah', header: 'Markah' },
]
const navItems = [
  [
    { label: 'Sandbox', icon: 'i-lucide-flask-conical', to: '/__ds' },
    { label: 'Token gallery', icon: 'i-lucide-palette', to: '/__dev/tokens' },
  ],
]
const groups = computed(() => [
  {
    id: 'nav',
    label: 'Navigasi',
    items: [
      { label: 'Sandbox', icon: 'i-lucide-flask-conical', to: '/__ds' },
      { label: 'Token gallery', icon: 'i-lucide-palette', to: '/__dev/tokens' },
    ],
  },
])

function fireToast(): void {
  toast.add({ title: 'Berjaya', description: 'Toast dari useToast', color: 'success' })
}
</script>

<template>
  <UApp :locale="ms">
    <main class="min-h-screen space-y-8 bg-muted p-4 text-default md:p-8" data-testid="ds-root">
      <header class="flex flex-wrap items-center gap-3">
        <h1 class="text-xl font-semibold">Nuxt UI sandbox (/__ds)</h1>
        <UColorModeButton data-testid="ds-colormode" />
        <span class="text-sm text-muted" data-testid="ds-mode">mode: {{ mode }}</span>
        <UIcon name="i-lucide-sparkles" class="size-5" data-testid="ds-icon" />
      </header>

      <section class="space-y-3">
        <h2 class="font-semibold">Button, Input, Select, Badge</h2>
        <div class="flex flex-wrap items-center gap-3">
          <UButton data-testid="ds-btn-solid" variant="solid">Solid</UButton>
          <UButton data-testid="ds-btn-soft" variant="soft">Soft</UButton>
          <UButton data-testid="ds-btn-default">Default (tonal)</UButton>
          <UButton data-testid="ds-btn-link" to="/__dev/tokens" icon="i-lucide-link"
            >Pautan</UButton
          >
          <UBadge data-testid="ds-badge">Lencana</UBadge>
        </div>
        <div class="grid max-w-xl gap-3 sm:grid-cols-2">
          <UInput v-model="text" data-testid="ds-input" placeholder="Taip di sini" class="w-full" />
          <USelect v-model="picked" :items="selectItems" data-testid="ds-select" class="w-full" />
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold">Form and feedback extras (testid forwarding)</h2>
        <div class="grid max-w-xl gap-3">
          <UFormField label="Catatan" data-testid="ds-formfield">
            <UTextarea v-model="text" data-testid="ds-textarea" class="w-full" />
          </UFormField>
          <UCheckbox v-model="agree" label="Setuju" data-testid="ds-checkbox" />
          <USwitch v-model="agree" label="Suis" data-testid="ds-switch" />
          <UAlert title="Makluman" description="Contoh alert" data-testid="ds-alert" />
          <UProgress :model-value="40" data-testid="ds-progress" />
          <UPagination v-model:page="page" :total="50" data-testid="ds-pagination" />
          <UAvatar alt="Murid Contoh" data-testid="ds-avatar" />
          <UDropdownMenu :items="[[{ label: 'Item 1' }]]" data-testid="ds-dropdown">
            <UButton data-testid="ds-dropdown-trigger" color="neutral">Menu</UButton>
          </UDropdownMenu>
          <UButton data-testid="ds-open-slideover" color="neutral" @click="slideOpen = true">
            Slideover
          </UButton>
        </div>
        <USlideover v-model:open="slideOpen" title="Slideover" data-testid="ds-slideover">
          <template #body><p data-testid="ds-slideover-body">Badan slideover</p></template>
        </USlideover>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold">Tabs, Card, Modal, Toast</h2>
        <UTabs v-model="tab" :items="tabItems" data-testid="ds-tabs" class="max-w-md">
          <template #satu><p class="p-2">Kandungan satu</p></template>
          <template #dua><p class="p-2">Kandungan dua</p></template>
        </UTabs>
        <UCard data-testid="ds-card" class="max-w-md">
          <template #header>Kad</template>
          Kandungan kad
        </UCard>
        <div class="flex gap-3">
          <UButton data-testid="ds-open-modal" @click="modalOpen = true">Buka modal</UButton>
          <UButton data-testid="ds-toast-btn" color="neutral" @click="fireToast">Toast</UButton>
          <UButton data-testid="ds-open-search" color="neutral" @click="searchOpen = true">
            Ctrl+K
          </UButton>
        </div>
        <UModal
          v-model:open="modalOpen"
          title="Modal contoh"
          data-testid="ds-modal"
          :content="modalContent"
        >
          <template #body><p>Badan modal</p></template>
          <template #footer>
            <UButton data-testid="ds-modal-close" @click="modalOpen = false">Tutup</UButton>
          </template>
        </UModal>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold">Table</h2>
        <div class="max-w-xl overflow-x-auto">
          <UTable :data="tableRows" :columns="tableColumns" data-testid="ds-table" />
        </div>
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold">NavigationMenu</h2>
        <UNavigationMenu :items="navItems" data-testid="ds-navmenu" class="max-w-md" />
      </section>

      <section class="space-y-3">
        <h2 class="font-semibold">Dashboard (outside Nuxt)</h2>
        <UDashboardGroup
          storage="local"
          storage-key="pp-ds-sandbox"
          class="!relative !inset-auto h-[420px] overflow-hidden rounded-lg"
          data-testid="ds-dash-group"
        >
          <UDashboardSidebar v-model:open="sidebarOpen" collapsible data-testid="ds-dash-sidebar">
            <template #header>Logo</template>
            <UNavigationMenu :items="navItems" orientation="vertical" />
          </UDashboardSidebar>
          <UDashboardSearch
            v-model:open="searchOpen"
            :groups="groups"
            data-testid="ds-dash-search"
          />
          <UDashboardPanel id="ds-panel" data-testid="ds-dash-panel">
            <template #header>
              <UDashboardNavbar title="Papan Pemuka" data-testid="ds-dash-navbar">
                <template #leading><UDashboardSidebarCollapse /></template>
              </UDashboardNavbar>
            </template>
            <template #body><p>Badan panel</p></template>
          </UDashboardPanel>
        </UDashboardGroup>
      </section>
    </main>
  </UApp>
</template>
