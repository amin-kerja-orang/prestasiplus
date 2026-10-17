<script setup lang="ts">
/**
 * Every composite of `@/ds` with its interactive states, rendered in whatever personality and
 * colour scheme the surrounding `DsThemeScope` sets. Dev / demo only (page-level strict file:
 * layout utilities and token colours only). Sample copy is BM; names are fictitious.
 */
import { computed, ref } from 'vue'

import type { TableColumn } from '@nuxt/ui'
import { useToast } from '@nuxt/ui/composables'

import {
  DsArt3D,
  DsCarousel,
  DsCharacterCard,
  DsDrillTable,
  DsEmptyState,
  DsFeedbackSheet,
  DsFloatScore,
  DsFriendAvatar,
  DsFriendPicker,
  DsHeroCard,
  DsIcon,
  DsIconChip,
  DsLiveBadge,
  DsLiveTiles,
  DsQuizHeader,
  DsQuizOption,
  DsRewardChip,
  DsScoreRing,
  DsSpeechBubble,
  DsStatTile,
  DsSubjectStrip,
  DsSticker,
  DsWinHero,
  DsWinScreen,
  art3dNames,
  type FriendId,
  type FriendMood,
  type FriendOption,
  type QuizOptionState,
} from '@/ds'

import DsGalleryWave0 from './DsGalleryWave0.vue'

const toast = useToast()

const friends: FriendOption[] = [
  { value: 'aiman', name: 'Aiman', trait: 'Tenang & suka cabaran' },
  { value: 'aisyah', name: 'Aisyah', trait: 'Ceria & sentiasa beri semangat' },
]
const friend = ref<FriendId>('aiman')
const friendName = computed(() => friends.find((f) => f.value === friend.value)?.name ?? '')
const pickerOpen = ref(false)
function onPicked(chosen: FriendId): void {
  const name = friends.find((f) => f.value === chosen)?.name ?? ''
  toast.add({ title: `Rakan belajar: ${name}`, color: 'success' })
}

const moods: FriendMood[] = ['neutral', 'happy', 'encouraging', 'celebrating']
const typing = ref(false)
const allStates: QuizOptionState[] = ['idle', 'selected', 'correct', 'wrong', 'dimmed']
const fbTone = ref<'good' | 'bad'>('good')
const subjects = [
  { id: 'mat', label: 'Matematik', icon: 'i-ph-calculator-duotone' },
  { id: 'bm', label: 'B. Melayu', icon: 'i-ph-book-open-text-duotone' },
  { id: 'bi', label: 'B. Inggeris', icon: 'i-ph-translate-duotone' },
  { id: 'sej', label: 'Sejarah', icon: 'i-ph-scroll-duotone' },
  { id: 'sci', label: 'Sains', icon: 'i-ph-flask-duotone' },
  { id: 'topik', label: 'Topik', icon: 'i-ph-books-duotone' },
]
const iconBases = ['house', 'fire', 'coins', 'lightning', 'graduation-cap', 'game-controller']
const rewards = [
  { id: 'p', value: '+50', unit: 'Mata', art: 'bolt' as const },
  { id: 'k', value: '+12', unit: 'Koin', art: 'coin' as const },
]
const stickers = [
  { id: 's1', text: 'Streak 5 hari!', art: 'fire' as const },
  { id: 's2', text: 'Tahap naik!' },
]
const heroPct = ref(60)

// Quiz: pick an option, then "Semak" locks it (correct = 42).
const options = ['36', '42', '48', '54']
const letters = ['A', 'B', 'C', 'D']
const correctIndex = 1
const chosen = ref<number | null>(null)
const checked = ref(false)
function optionState(index: number): QuizOptionState {
  if (!checked.value) return chosen.value === index ? 'selected' : 'idle'
  if (index === correctIndex) return 'correct'
  if (index === chosen.value) return 'wrong'
  return 'dimmed'
}
function resetQuiz(): void {
  chosen.value = null
  checked.value = false
}

const slides = [
  { id: 1, title: 'Kenali Rakan Belajar', text: 'Rakan awak sentiasa ada untuk beri semangat.' },
  {
    id: 2,
    title: 'Latihan Lima Soalan',
    text: 'Lima soalan sehari sudah cukup untuk jaga streak.',
  },
  { id: 3, title: 'Kumpul Ganjaran', text: 'Mata dan koin menunggu di hujung latihan.' },
]

const tiles = [
  { id: 'a', value: 128, unit: 'murid aktif', icon: 'i-ph-users' },
  { id: 'b', value: 342, unit: 'latihan hari ini', icon: 'i-ph-pencil-simple-line' },
  { id: 'c', value: '78%', unit: 'purata skor', icon: 'i-ph-chart-line-up' },
  { id: 'd', value: 6, unit: 'kelas dalam talian', icon: 'i-ph-chalkboard-teacher' },
]

type SchoolRow = { nama: string; murid: number; purata: string }
const rows: SchoolRow[] = [
  { nama: 'Sekolah Contoh A', murid: 842, purata: '74%' },
  { nama: 'Sekolah Contoh B', murid: 615, purata: '69%' },
  { nama: 'Sekolah Contoh C', murid: 1103, purata: '81%' },
]
const columns: TableColumn<SchoolRow>[] = [
  { accessorKey: 'nama', header: 'Sekolah' },
  { accessorKey: 'murid', header: 'Murid' },
  { accessorKey: 'purata', header: 'Purata' },
]
const drilled = ref('')
</script>

<template>
  <div class="flex min-w-0 flex-col gap-8" data-testid="ds-showcase">
    <section class="flex flex-col gap-3" aria-labelledby="g-chip">
      <h3 id="g-chip" class="text-subheading">DsIconChip dan DsArt3D</h3>
      <div class="flex flex-wrap items-center gap-3">
        <DsIconChip icon="i-ph-lightning-duotone" accent="action" />
        <DsIconChip icon="i-ph-trophy-duotone" accent="win" />
        <DsIconChip icon="i-ph-fire-duotone" accent="heat" />
        <DsIconChip icon="i-ph-sparkle-duotone" accent="friend" />
        <DsIconChip icon="i-ph-star-duotone" accent="trial" />
        <DsIconChip icon="i-ph-fire-duotone" accent="heat" size="xs" />
        <DsIconChip icon="i-ph-fire-duotone" accent="heat" size="lg" />
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <DsArt3D v-for="name in art3dNames" :key="name" :name="name" size="lg" />
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="g-stat">
      <h3 id="g-stat" class="text-subheading">DsStatTile</h3>
      <div class="grid grid-cols-3 gap-3">
        <DsStatTile value="12" unit="hari" icon="i-ph-fire-duotone" accent="heat" />
        <DsStatTile value="1,240" unit="mata" icon="i-ph-lightning-duotone" accent="action" />
        <DsStatTile value="86" unit="koin" icon="i-ph-coins-duotone" accent="win" />
      </div>
      <div class="grid grid-cols-3 gap-3">
        <DsStatTile value="12" unit="hari" art="fire" />
        <DsStatTile value="1,240" unit="mata" art="bolt" />
        <DsStatTile value="86" unit="koin" art="coin" />
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="g-hero">
      <h3 id="g-hero" class="text-subheading">DsHeroCard, DsRewardChip, DsSubjectStrip, DsIcon</h3>
      <DsHeroCard
        overline="Sambung latihan"
        title="Matematik · Fungsi Kuadratik"
        :subtitle="`12 daripada 20 soalan`"
        :progress="heroPct"
        ring-label="Kemajuan Fungsi Kuadratik"
        art="rocket"
        cta-label="Mula"
      />
      <div class="flex flex-wrap gap-3">
        <UButton color="neutral" variant="soft" @click="heroPct = Math.max(0, heroPct - 20)">
          Kurang
        </UButton>
        <UButton color="neutral" variant="soft" @click="heroPct = Math.min(100, heroPct + 20)">
          Tambah
        </UButton>
      </div>
      <div class="flex flex-wrap items-center gap-3">
        <DsRewardChip art="fire" value="12" label="hari" />
        <DsRewardChip art="coin" value="86" label="koin" />
        <DsRewardChip icon="fire" value="12" label="hari" />
        <DsRewardChip icon="lightning" value="1,240" label="mata" />
      </div>
      <DsSubjectStrip :items="subjects" label="Mata pelajaran" />
      <div class="flex flex-wrap items-center gap-3" aria-label="Berat ikon ikut personaliti">
        <DsIcon v-for="name in iconBases" :key="name" :name="name" class="size-6" />
        <DsIcon name="check" weight="bold" class="size-4" />
      </div>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="g-card">
      <h3 id="g-card" class="text-subheading">DsCharacterCard</h3>
      <DsCharacterCard
        variant="trial"
        title="Percubaan Percuma"
        description="Cuba semua ciri selama 7 hari."
        icon="i-ph-gift-duotone"
        cta-label="Mulakan percubaan"
      />
      <DsCharacterCard
        variant="warning"
        title="Streak hampir putus"
        description="Satu latihan sahaja untuk jaga streak hari ini."
        art="fire"
        cta-label="Jom berlatih"
      />
      <DsCharacterCard
        variant="info"
        title="Tahukah awak?"
        description="Ulang kaji sedikit setiap hari lebih berkesan."
        icon="i-ph-lightbulb-duotone"
        cta-label="Baca lagi"
      />
      <DsCharacterCard
        variant="win"
        title="Pencapaian baharu"
        description="Awak sudah siapkan 10 latihan."
        art="trophy"
        cta-label="Lihat pencapaian"
      />
      <DsCharacterCard
        variant="action"
        title="Teruskan latihan"
        description="Bab 3 menunggu awak."
        icon="i-ph-rocket-launch-duotone"
        cta-label="Teruskan"
      />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="g-friend">
      <h3 id="g-friend" class="text-subheading">DsFriendAvatar, DsSpeechBubble, DsFriendPicker</h3>
      <div class="flex flex-wrap items-end gap-3">
        <DsFriendAvatar friend="aiman" size="sm" />
        <DsFriendAvatar friend="aisyah" size="md" />
        <DsFriendAvatar friend="aiman" size="lg" />
        <DsFriendAvatar friend="aisyah" size="xl" />
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <DsFriendAvatar v-for="mood in moods" :key="mood" :friend="friend" :mood="mood" size="lg" />
      </div>
      <div class="flex items-end gap-3">
        <DsFriendAvatar
          :friend="friend"
          mood="happy"
          interactive
          :label="`Tukar rakan belajar. Rakan sekarang: ${friendName}`"
          @press="pickerOpen = true"
        />
        <DsSpeechBubble :name="friendName" :typing="typing" typing-label="Sedang menaip">
          Lima soalan pun dah cukup untuk jaga streak. Jom?
        </DsSpeechBubble>
      </div>
      <div class="flex flex-wrap gap-3">
        <UButton color="neutral" variant="soft" @click="typing = !typing">
          {{ typing ? 'Berhenti menaip' : 'Tunjuk menaip' }}
        </UButton>
        <UButton color="neutral" variant="soft" @click="pickerOpen = true">Pilih rakan</UButton>
      </div>
      <DsFriendPicker
        v-model:open="pickerOpen"
        v-model:selected="friend"
        :friends="friends"
        title="Pilih rakan belajar awak"
        description="Dia akan temankan awak sepanjang latihan. Boleh tukar bila-bila masa."
        group-label="Rakan belajar"
        selected-label="Dipilih"
        confirm-label="Pilih"
        cancel-label="Batal"
        @confirm="onPicked"
      />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="g-quiz">
      <h3 id="g-quiz" class="text-subheading">DsQuizOption, DsFeedbackSheet, DsFloatScore</h3>
      <DsQuizHeader
        close-label="Tutup latihan"
        :progress="chosen === null ? 20 : 60"
        progress-label="Kemajuan latihan"
        :combo="checked && chosen === correctIndex ? 3 : 0"
        combo-label="Kombo"
      />
      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Semua keadaan pilihan">
        <DsQuizOption v-for="s in allStates" :key="s" letter="A" :state="s">
          {{ s }}
        </DsQuizOption>
      </div>
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Nada maklum balas">
        <UButton
          :variant="fbTone === 'good' ? 'solid' : 'soft'"
          :color="fbTone === 'good' ? 'primary' : 'neutral'"
          :aria-pressed="fbTone === 'good'"
          @click="fbTone = 'good'"
        >
          Betul
        </UButton>
        <UButton
          :variant="fbTone === 'bad' ? 'solid' : 'soft'"
          :color="fbTone === 'bad' ? 'primary' : 'neutral'"
          :aria-pressed="fbTone === 'bad'"
          @click="fbTone = 'bad'"
        >
          Salah
        </UButton>
      </div>
      <DsFeedbackSheet
        :tone="fbTone"
        :title="fbTone === 'good' ? 'Betul!' : 'Hampir!'"
        :body="fbTone === 'good' ? '6 × 7 = 42.' : 'Cuba lihat semula jadual darab tujuh.'"
        :combo="fbTone === 'good' ? '+10' : undefined"
        continue-label="Teruskan"
      />
      <p class="text-heading">Berapakah 6 × 7?</p>
      <div class="flex flex-col gap-2" role="group" aria-label="Pilihan jawapan">
        <DsQuizOption
          v-for="(text, index) in options"
          :key="text"
          :letter="letters[index] ?? ''"
          :state="optionState(index)"
          @select="chosen = index"
        >
          {{ text }}
        </DsQuizOption>
      </div>
      <div class="flex flex-wrap gap-3">
        <UButton :disabled="chosen === null || checked" @click="checked = true">Semak</UButton>
        <UButton color="neutral" variant="soft" @click="resetQuiz">Cuba semula</UButton>
        <DsFloatScore v-if="checked && chosen === correctIndex" text="+10" />
      </div>
      <DsFeedbackSheet
        v-if="checked && chosen === correctIndex"
        tone="good"
        title="Betul!"
        body="6 × 7 = 42."
        ai-label="AI"
        ai-line="Cara awak betul. Teruskan rentak ini."
        combo="+10"
        continue-label="Teruskan"
        @continue="resetQuiz"
      />
      <DsFeedbackSheet
        v-else-if="checked"
        tone="bad"
        title="Hampir!"
        body="Cuba lihat semula jadual darab tujuh."
        ai-label="AI"
        ai-line="Tak apa, kita cuba lagi."
        continue-label="Teruskan"
        @continue="resetQuiz"
      />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="g-win">
      <h3 id="g-win" class="text-subheading">DsWinHero, DsScoreRing, DsSticker</h3>
      <DsWinHero art="party" title="Sempurna, Murid Contoh!" subtitle="Awak dapat 5/5. Hebat!" />
      <div class="flex flex-wrap items-center justify-center gap-6">
        <DsScoreRing
          :value="5"
          :max="5"
          size="lg"
          tone="win"
          label="Skor 5 daripada 5"
          unit="daripada 5"
        />
        <DsScoreRing
          :value="2"
          :max="5"
          size="md"
          tone="action"
          label="Skor 2 daripada 5"
          unit="daripada 5"
        />
        <DsScoreRing
          :value="64"
          size="sm"
          tone="action"
          display="64%"
          label="Kemajuan 64 peratus"
        />
      </div>
      <div class="flex flex-wrap justify-center gap-3">
        <DsSticker art="fire">Streak 5 hari!</DsSticker>
        <DsSticker>Tahap naik!</DsSticker>
      </div>
      <DsWinHero art="books" tone="keep" title="Teruskan, Murid Contoh!" />
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="g-winscreen">
      <h3 id="g-winscreen" class="text-subheading">DsWinScreen</h3>
      <DsWinScreen
        art="trophy"
        title="Hebat, Murid Contoh!"
        subtitle="Awak dapat 4/5."
        :score="4"
        :max="5"
        ring-label="Skor 4 daripada 5"
        ring-unit="daripada 5"
        :rewards="rewards"
        :stickers="stickers"
      >
        <template #friend>
          <DsFriendAvatar friend="aiman" mood="celebrating" size="md" />
          <DsSpeechBubble live>Tahniah, Murid Contoh! Awak dapat 4/5. Hebat!</DsSpeechBubble>
        </template>
        <template #actions>
          <UButton color="neutral" variant="soft" size="lg" block>Kongsi</UButton>
          <UButton size="lg" block>Kembali ke Home</UButton>
        </template>
      </DsWinScreen>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="g-carousel">
      <h3 id="g-carousel" class="text-subheading">DsCarousel</h3>
      <DsCarousel :items="slides" label="Petua pembelajaran">
        <template #item="{ item }">
          <DsCharacterCard
            variant="info"
            :title="item.title"
            :description="item.text"
            icon="i-ph-lightbulb-duotone"
          />
        </template>
      </DsCarousel>
    </section>

    <section class="flex flex-col gap-3" aria-labelledby="g-staff">
      <h3 id="g-staff" class="text-subheading">
        Staf: DsLiveBadge, DsLiveTiles, DsDrillTable, DsEmptyState
      </h3>
      <DsLiveBadge label="LANGSUNG" />
      <DsLiveTiles :tiles="tiles" label="Aktiviti langsung" live-label="LANGSUNG" />
      <p v-if="drilled" class="text-label text-muted" role="status">Dipilih: {{ drilled }}</p>
      <DsDrillTable
        :data="rows"
        :columns="columns"
        caption="Sekolah mengikut purata"
        empty-label="Tiada data"
        @drill="drilled = $event.nama"
      >
        <template #nama-cell="{ row }">
          <UButton variant="link" color="primary" @click="drilled = row.original.nama">{{
            row.original.nama
          }}</UButton>
        </template>
      </DsDrillTable>
      <DsEmptyState title="Tiada rekod" description="Cuba ubah penapis anda." icon="i-ph-tray" />
      <DsEmptyState
        title="Belum ada latihan"
        description="Mulakan latihan pertama awak."
        friend="aisyah"
      >
        <template #actions>
          <UButton>Mulakan</UButton>
        </template>
      </DsEmptyState>
    </section>
    <DsGalleryWave0 />
  </div>
</template>
