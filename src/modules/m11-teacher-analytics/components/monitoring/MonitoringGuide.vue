<script setup lang="ts">
/**
 * S2 guide card (FN-M11-3.1.1..3.1.4; FR-M11-26..29). Visibility is read from
 * `localStorage.hideMonitoringGuide` (`'true'` = hidden); ✕ hides and stores it; "Tunjuk panduan
 * penggunaan" shows it again and removes the key. A storage failure falls back to "shown".
 * Tile titles are in-page anchors that scroll smoothly (sections carry `scroll-mt-20`, 80 px).
 */
import {
  BookOpen,
  ChartBar,
  CalendarRange,
  CircleQuestionMark,
  LayoutGrid,
  Lightbulb,
  MousePointer,
  Presentation,
  TriangleAlert,
  X,
} from '@lucide/vue'
import { ref } from 'vue'

const KEY = 'hideMonitoringGuide'

function readHidden(): boolean {
  try {
    return window.localStorage.getItem(KEY) === 'true'
  } catch {
    return false
  }
}

const hidden = ref(readHidden())

function hide() {
  hidden.value = true
  try {
    window.localStorage.setItem(KEY, 'true')
  } catch {
    /* storage unavailable: the card still hides for this page view */
  }
}

function show() {
  hidden.value = false
  try {
    window.localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

function scrollTo(event: MouseEvent, id: string) {
  const target = document.getElementById(id)
  if (!target) return
  event.preventDefault()
  target.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const TILE = 'rounded-xl bg-white/80 p-3 text-sm text-slate-600 shadow-sm'
const TITLE =
  'mb-1 flex items-center gap-2 font-semibold text-indigo-700 underline decoration-dotted underline-offset-4'
</script>

<template>
  <div data-testid="mon-guide-area">
    <section
      v-if="!hidden"
      class="relative rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-blue-50 p-4 sm:p-5"
      data-testid="mon-guide"
    >
      <button
        type="button"
        class="absolute top-1 right-1 flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-slate-600"
        data-testid="mon-guide-close"
        @click="hide"
      >
        <X class="h-5 w-5" />
      </button>
      <h3
        class="mb-3 flex items-center gap-2 pr-10 font-heading text-base font-bold text-slate-800"
      >
        <BookOpen class="h-5 w-5 text-indigo-600" />Panduan Monitoring Penglibatan
      </h3>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div :class="TILE" data-testid="mon-guide-tile">
          <a
            href="#section-ringkasan"
            :class="TITLE"
            @click="scrollTo($event, 'section-ringkasan')"
          >
            <LayoutGrid class="h-4 w-4" />Kad Ringkasan
          </a>
          <p>
            Gambaran keseluruhan — berapa sekolah, pelajar, yang aktif, dan soalan dijawab.
            <strong>% Penglibatan</strong> = berapa ramai pelajar yang pernah jawab
            sekurang-kurangnya 1 soalan.
          </p>
        </div>
        <div :class="TILE" data-testid="mon-guide-tile">
          <a href="#section-pelajar" :class="TITLE" @click="scrollTo($event, 'section-pelajar')">
            <ChartBar class="h-4 w-4" />Table Pelajar
          </a>
          <p>
            Setiap sekolah mengikut <strong>% pelajar aktif</strong>. Klik nama sekolah untuk
            drill-down.
          </p>
          <p class="mt-1" data-testid="mon-guide-legend">
            <strong class="text-green-600">Cemerlang</strong> &gt;60% |
            <strong class="text-orange-600">Sederhana</strong> 20-60% |
            <strong class="text-red-600">Rendah</strong> 5-20% |
            <strong class="text-red-800">Kritikal</strong> &lt;5% |
            <strong class="text-slate-500">Tiada</strong> 0%
          </p>
        </div>
        <div :class="TILE" data-testid="mon-guide-tile">
          <a href="#section-guru" :class="TITLE" @click="scrollTo($event, 'section-guru')">
            <Presentation class="h-4 w-4" />Table Guru
          </a>
          <p>Berapa guru yang <strong>pernah login</strong> ke platform mengikut sekolah.</p>
        </div>
        <div :class="TILE" data-testid="mon-guide-tile">
          <a href="#section-mingguan" :class="TITLE" @click="scrollTo($event, 'section-mingguan')">
            <CalendarRange class="h-4 w-4" />Tracking Mingguan
          </a>
          <p>
            Soalan dijawab setiap minggu. <strong class="text-green-600">Hijau</strong> = naik.
            <strong class="text-red-600">Merah</strong> = turun. <strong>Best</strong> = minggu
            paling aktif.
          </p>
        </div>
        <div :class="TILE" data-testid="mon-guide-tile">
          <a
            href="#section-perhatian"
            :class="TITLE"
            @click="scrollTo($event, 'section-perhatian')"
          >
            <TriangleAlert class="h-4 w-4" />Perhatian &amp; Cadangan
          </a>
          <p>
            Sekolah yang <strong>perlu tindakan</strong> — pelajar daftar tapi tak guna, guru login
            tapi murid tak aktif. Ada cadangan susulan.
          </p>
        </div>
        <div :class="TILE" data-testid="mon-guide-tile">
          <a href="#section-pelajar" :class="TITLE" @click="scrollTo($event, 'section-pelajar')">
            <MousePointer class="h-4 w-4" />Drill-Down
          </a>
          <p>
            Klik <strong>nama sekolah</strong> → senarai pelajar &amp; guru. Klik
            <strong>nama pelajar aktif</strong> → detail soalan, jawapan salah, subjek kuat/lemah.
          </p>
        </div>
      </div>
      <p
        class="mt-3 flex items-start gap-2 rounded-xl bg-white/70 px-3 py-2 text-sm text-slate-600"
        data-testid="mon-guide-tip"
      >
        <Lightbulb class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <span
          ><strong>Tip:</strong> Guna Filter untuk tapis negeri/tempoh/tahap. Export PDF/CSV untuk
          pembentangan.</span
        >
      </p>
    </section>
    <button
      v-else
      type="button"
      class="flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
      data-testid="mon-guide-show"
      @click="show"
    >
      <CircleQuestionMark class="h-4 w-4" />Tunjuk panduan penggunaan
    </button>
  </div>
</template>
