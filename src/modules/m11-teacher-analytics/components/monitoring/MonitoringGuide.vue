<script setup lang="ts">
/**
 * S2 guide card (FN-M11-3.1.1..3.1.4; FR-M11-26..29). Visibility is read from
 * `localStorage.hideMonitoringGuide` (`'true'` = hidden); ✕ hides and stores it; "Tunjuk panduan
 * penggunaan" shows it again and removes the key. A storage failure falls back to "shown".
 * Tile titles are in-page anchors that scroll smoothly.
 */
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
</script>

<template>
  <div data-testid="mon-guide-area">
    <UCard v-if="!hidden" data-testid="mon-guide">
      <div class="flex flex-col gap-4">
        <div class="flex items-start justify-between gap-2">
          <h2 class="flex items-center gap-2 text-label text-highlighted">
            <UIcon name="i-ph-book-open" class="size-5 text-primary" />Panduan Monitoring
            Penglibatan
          </h2>
          <UButton
            color="neutral"
            variant="ghost"
            size="lg"
            icon="i-ph-x"
            aria-label="Tutup panduan"
            data-testid="mon-guide-close"
            @click="hide"
          />
        </div>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            class="flex flex-col gap-1 bg-soft p-3 text-body text-muted"
            data-testid="mon-guide-tile"
          >
            <ULink
              href="#section-ringkasan"
              class="flex items-center gap-2 text-label text-primary"
              @click="scrollTo($event, 'section-ringkasan')"
            >
              <UIcon name="i-ph-squares-four" class="size-4" />Kad Ringkasan
            </ULink>
            <p>
              Gambaran keseluruhan — berapa sekolah, pelajar, yang aktif, dan soalan dijawab.
              <strong class="text-highlighted">% Penglibatan</strong> = berapa ramai pelajar yang
              pernah jawab sekurang-kurangnya 1 soalan.
            </p>
          </div>
          <div
            class="flex flex-col gap-1 bg-soft p-3 text-body text-muted"
            data-testid="mon-guide-tile"
          >
            <ULink
              href="#section-pelajar"
              class="flex items-center gap-2 text-label text-primary"
              @click="scrollTo($event, 'section-pelajar')"
            >
              <UIcon name="i-ph-chart-bar" class="size-4" />Table Pelajar
            </ULink>
            <p>
              Setiap sekolah mengikut <strong class="text-highlighted">% pelajar aktif</strong>.
              Klik nama sekolah untuk drill-down.
            </p>
            <p data-testid="mon-guide-legend">
              <strong class="text-success">Cemerlang</strong> &gt;60% |
              <strong class="text-warning">Sederhana</strong> 20-60% |
              <strong class="text-error">Rendah</strong> 5-20% |
              <strong class="text-error">Kritikal</strong> &lt;5% |
              <strong class="text-muted">Tiada</strong> 0%
            </p>
          </div>
          <div
            class="flex flex-col gap-1 bg-soft p-3 text-body text-muted"
            data-testid="mon-guide-tile"
          >
            <ULink
              href="#section-guru"
              class="flex items-center gap-2 text-label text-primary"
              @click="scrollTo($event, 'section-guru')"
            >
              <UIcon name="i-ph-chalkboard-teacher" class="size-4" />Table Guru
            </ULink>
            <p>
              Berapa guru yang <strong class="text-highlighted">pernah login</strong> ke platform
              mengikut sekolah.
            </p>
          </div>
          <div
            class="flex flex-col gap-1 bg-soft p-3 text-body text-muted"
            data-testid="mon-guide-tile"
          >
            <ULink
              href="#section-mingguan"
              class="flex items-center gap-2 text-label text-primary"
              @click="scrollTo($event, 'section-mingguan')"
            >
              <UIcon name="i-ph-calendar-dots" class="size-4" />Tracking Mingguan
            </ULink>
            <p>
              Soalan dijawab setiap minggu. <strong class="text-success">Hijau</strong> = naik.
              <strong class="text-error">Merah</strong> = turun.
              <strong class="text-highlighted">Best</strong> = minggu paling aktif.
            </p>
          </div>
          <div
            class="flex flex-col gap-1 bg-soft p-3 text-body text-muted"
            data-testid="mon-guide-tile"
          >
            <ULink
              href="#section-perhatian"
              class="flex items-center gap-2 text-label text-primary"
              @click="scrollTo($event, 'section-perhatian')"
            >
              <UIcon name="i-ph-warning" class="size-4" />Perhatian &amp; Cadangan
            </ULink>
            <p>
              Sekolah yang <strong class="text-highlighted">perlu tindakan</strong> — pelajar daftar
              tapi tak guna, guru login tapi murid tak aktif. Ada cadangan susulan.
            </p>
          </div>
          <div
            class="flex flex-col gap-1 bg-soft p-3 text-body text-muted"
            data-testid="mon-guide-tile"
          >
            <ULink
              href="#section-pelajar"
              class="flex items-center gap-2 text-label text-primary"
              @click="scrollTo($event, 'section-pelajar')"
            >
              <UIcon name="i-ph-cursor-click" class="size-4" />Drill-Down
            </ULink>
            <p>
              Klik <strong class="text-highlighted">nama sekolah</strong> → senarai pelajar &amp;
              guru. Klik <strong class="text-highlighted">nama pelajar aktif</strong> → detail
              soalan, jawapan salah, subjek kuat/lemah.
            </p>
          </div>
        </div>
        <p class="flex items-start gap-2 text-body text-muted" data-testid="mon-guide-tip">
          <UIcon name="i-ph-lightbulb" class="mt-1 size-4 shrink-0 text-primary" />
          <span
            ><strong class="text-highlighted">Tip:</strong> Guna Filter untuk tapis
            negeri/tempoh/tahap. Export PDF/CSV untuk pembentangan.</span
          >
        </p>
      </div>
    </UCard>
    <UButton
      v-else
      type="button"
      color="primary"
      variant="link"
      size="lg"
      icon="i-ph-question"
      label="Tunjuk panduan penggunaan"
      data-testid="mon-guide-show"
      @click="show"
    />
  </div>
</template>
