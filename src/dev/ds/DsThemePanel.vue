<script setup lang="ts">
/**
 * One cell of the `/__ds` theme matrix (V2-T03): a personality (staff / learner) in one forced
 * colour mode. The panel sets its own `data-personality` and `.dark` / `.light`, so all four cells
 * show side by side whatever the page mode is. Dev and demo only.
 */
import { computed, ref } from 'vue'

import type { Personality } from '@/theme/color-mode'

const props = defineProps<{ personality: Personality; dark: boolean }>()

const aiman = new URL('../../../docs/design/assets/v2/aiman_face.png', import.meta.url).href
const aisyah = new URL('../../../docs/design/assets/v2/aisyah_face.png', import.meta.url).href

const learner = computed(() => props.personality === 'learner')
const tab = ref('semua')
const tabItems = [
  { label: 'Semua', value: 'semua' },
  { label: 'Minggu ini', value: 'minggu' },
  { label: 'Selesai', value: 'selesai' },
]
const name = ref('')
const subject = ref('mat')
const subjects = [
  { label: 'Matematik', value: 'mat' },
  { label: 'Bahasa Melayu', value: 'bm' },
]

/** Literal names so the icon scan bundles them (staff Regular, learner Duotone). */
const icons = {
  bolt: { staff: 'i-ph-lightning', learner: 'i-ph-lightning-duotone' },
  fire: { staff: 'i-ph-fire', learner: 'i-ph-fire-duotone' },
  trophy: { staff: 'i-ph-trophy', learner: 'i-ph-trophy-duotone' },
  coins: { staff: 'i-ph-coins', learner: 'i-ph-coins-duotone' },
  spark: { staff: 'i-ph-sparkle', learner: 'i-ph-sparkle-duotone' },
  books: { staff: 'i-ph-books', learner: 'i-ph-books-duotone' },
  cap: { staff: 'i-ph-graduation-cap', learner: 'i-ph-graduation-cap-duotone' },
  game: { staff: 'i-ph-game-controller', learner: 'i-ph-game-controller-duotone' },
} as const
type IconKey = keyof typeof icons
function ic(key: IconKey): string {
  return icons[key][props.personality]
}

const cards = [
  {
    key: 'trial',
    title: 'Percubaan Percuma',
    text: 'Cuba semua latihan selama 7 hari.',
    cta: 'Mula cuba',
    icon: 'cap',
    tint: 'var(--ds-amber)',
    chip: 'bg-trial text-on-highlight',
    btn: 'bg-trial text-on-highlight',
  },
  {
    key: 'warn',
    title: 'Streak hampir putus',
    text: 'Satu set pendek cukup untuk jaga streak.',
    cta: 'Jom ulang kaji',
    icon: 'fire',
    tint: 'var(--ds-c3)',
    chip: 'bg-heat text-on-highlight',
    btn: 'bg-heat text-on-highlight',
  },
  {
    key: 'info',
    title: 'Tip hari ini',
    text: 'Baca soalan dua kali sebelum menjawab.',
    cta: 'Baca lagi',
    icon: 'spark',
    tint: 'var(--ds-c4)',
    chip: 'bg-friend text-primary-on',
    btn: 'bg-friend text-primary-on',
  },
  {
    key: 'win',
    title: 'Pencapaian baharu',
    text: 'Anda mencapai 5 hari berturut-turut.',
    cta: 'Lihat',
    icon: 'trophy',
    tint: 'var(--ds-c2)',
    chip: 'bg-highlight text-on-highlight',
    btn: 'bg-highlight text-on-highlight',
  },
] as const
</script>

<template>
  <section
    :data-personality="personality"
    :class="dark ? 'dark' : 'light'"
    class="min-w-0 space-y-6 rounded-lg bg-muted p-4 text-default sm:p-6"
    :data-testid="`ds-panel-${personality}-${dark ? 'dark' : 'light'}`"
  >
    <header class="flex flex-wrap items-center gap-3">
      <h3 class="text-heading">
        {{ learner ? 'Murid (Elektrik)' : 'Pentadbiran (B+)' }}
        <span class="text-caption font-medium text-muted">{{ dark ? 'gelap' : 'cerah' }}</span>
      </h3>
    </header>

    <!-- Surface levels: page, raised, elevated (max 3) -->
    <div class="grid grid-cols-3 gap-2 text-center text-caption">
      <div class="rounded-md bg-muted p-3 text-muted shadow-bar">halaman</div>
      <div class="rounded-md bg-default p-3 shadow-lift">timbul</div>
      <div class="rounded-md bg-elevated p-3">tinggi</div>
    </div>

    <!-- Buttons -->
    <div class="space-y-2">
      <p class="text-overline text-muted uppercase">Butang</p>
      <div class="flex flex-wrap items-center gap-2">
        <UButton variant="solid" :icon="ic('bolt')" data-testid="ds-btn-primary"
          >Mula latihan</UButton
        >
        <UButton data-testid="ds-btn-tonal">Tonal</UButton>
        <UButton variant="outline" color="neutral">Sekunder</UButton>
        <UButton variant="ghost" color="neutral">Hantu</UButton>
        <UButton variant="solid" color="secondary">Menang</UButton>
        <UButton variant="solid" color="error">Padam</UButton>
        <UButton variant="solid" disabled>Dimatikan</UButton>
      </div>
    </div>

    <!-- Fields: filled, borderless, 2px focus ring -->
    <div class="grid gap-3 sm:grid-cols-2">
      <UFormField label="Nama penuh" help="Seperti dalam kad pengenalan">
        <UInput v-model="name" placeholder="Contoh: Murid Contoh" class="w-full" />
      </UFormField>
      <UFormField label="Mata pelajaran">
        <USelect v-model="subject" :items="subjects" class="w-full" />
      </UFormField>
      <UFormField label="Kata laluan" error="Sekurang-kurangnya 8 aksara" class="sm:col-span-2">
        <UInput model-value="abc" highlight color="error" type="password" class="w-full" />
      </UFormField>
    </div>

    <!-- Segmented tabs -->
    <div class="space-y-2">
      <p class="text-overline text-muted uppercase">Tab</p>
      <UTabs v-model="tab" :items="tabItems" :content="false" />
    </div>

    <!-- Badges -->
    <div class="space-y-2">
      <p class="text-overline text-muted uppercase">Lencana</p>
      <div class="flex flex-wrap items-center gap-2">
        <UBadge variant="soft">Aktif</UBadge>
        <UBadge variant="soft" color="success" icon="i-ph-check-circle">Siap</UBadge>
        <UBadge variant="soft" color="warning" icon="i-ph-warning">Menunggu</UBadge>
        <UBadge variant="soft" color="error" icon="i-ph-x-circle">Gagal</UBadge>
        <UBadge variant="subtle" color="neutral">Neutral</UBadge>
        <UBadge variant="solid" color="error" data-testid="ds-badge-live">
          <span class="size-2 animate-ds-live-pulse rounded-full bg-current" aria-hidden="true" />
          LIVE
        </UBadge>
        <UBadge variant="solid" size="sm">12</UBadge>
      </div>
    </div>

    <!-- Stat tiles -->
    <div class="grid grid-cols-2 gap-3">
      <UCard
        v-for="s in [
          { k: 'bolt', n: '1,240', u: 'Mata' },
          { k: 'fire', n: '5', u: 'hari streak' },
        ]"
        :key="s.k"
      >
        <div
          :class="
            learner
              ? 'mb-2 flex size-10 items-center justify-center rounded-chip bg-gradient-primary text-primary-on'
              : 'mb-2 flex size-8 items-center justify-center rounded-md bg-primary/12 text-ic-theme'
          "
          data-testid="ds-stat-chip"
        >
          <UIcon :name="ic(s.k as IconKey)" class="size-5" />
        </div>
        <p class="font-display text-title text-highlighted tabular-nums">{{ s.n }}</p>
        <p class="text-caption text-muted">{{ s.u }}</p>
      </UCard>
    </div>

    <!-- Progress -->
    <UProgress :model-value="62" status />

    <!-- Alert -->
    <UAlert
      color="info"
      variant="subtle"
      title="Makluman"
      description="Mod gelap ikut pilihan anda."
      icon="i-ph-info"
    />

    <!-- Learner-only: character cards and friend avatars -->
    <template v-if="learner">
      <div class="space-y-2">
        <p class="text-overline text-muted uppercase">Kad watak</p>
        <div class="grid gap-3 sm:grid-cols-2">
          <article
            v-for="c in cards"
            :key="c.key"
            class="flex items-start gap-3 rounded-sheet p-4 shadow-lift"
            :style="{ backgroundColor: `color-mix(in srgb, ${c.tint} 14%, var(--ui-bg))` }"
            :data-testid="`ds-char-${c.key}`"
          >
            <span
              :class="['flex size-12 shrink-0 items-center justify-center rounded-chip', c.chip]"
            >
              <UIcon :name="ic(c.icon)" class="size-6" />
            </span>
            <div class="min-w-0 flex-1 space-y-2">
              <h4 class="text-subheading text-highlighted">{{ c.title }}</h4>
              <p class="text-label text-muted">{{ c.text }}</p>
              <button
                type="button"
                :class="['min-h-11 rounded-lg px-4 text-label font-bold', c.btn]"
              >
                {{ c.cta }}
              </button>
            </div>
          </article>
        </div>
      </div>

      <div class="space-y-2">
        <p class="text-overline text-muted uppercase">Rakan belajar</p>
        <div class="flex flex-wrap gap-6">
          <figure
            v-for="f in [
              { n: 'Aiman', src: aiman },
              { n: 'Aisyah', src: aisyah },
            ]"
            :key="f.n"
            class="flex items-center gap-3"
          >
            <span
              class="relative inline-flex size-14 animate-ds-bob rounded-full bg-ai/20 p-[6%] ring-[5px] ring-ai/22"
            >
              <img
                :src="f.src"
                :alt="`Rakan belajar ${f.n}`"
                class="size-full rounded-full object-cover"
                width="56"
                height="56"
              />
              <span
                class="absolute -right-1 -bottom-1 flex size-[22px] items-center justify-center rounded-full bg-default text-[12px] shadow-lift"
                aria-hidden="true"
                >😊</span
              >
            </span>
            <figcaption class="rounded-lg bg-default px-3 py-2 text-label shadow-lift">
              <span class="block text-caption text-muted">{{ f.n }}</span>
              Jom mula, awak pasti boleh!
            </figcaption>
          </figure>
        </div>
      </div>
    </template>
  </section>
</template>
