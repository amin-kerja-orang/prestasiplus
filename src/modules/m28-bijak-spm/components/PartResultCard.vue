<script setup lang="ts">
/**
 * Marked result of one leaf part: status, marks, what the student wrote, every marking point with
 * a tick / cross and the reason, the ECF note and the revealed scheme (US-14, US-15). Colour is
 * never the only signal: each point has an icon and screen-reader text.
 */
import { computed } from 'vue'

import type { McqOption, PartResult, PartStatus } from '../domain/types'
import RichText from './RichText.vue'

const props = defineProps<{ result: PartResult; options?: McqOption[]; title?: string }>()

const STATUS: Record<
  PartStatus,
  { text: string; color: 'success' | 'warning' | 'error' | 'neutral' | 'info' }
> = {
  betul: { text: 'Betul', color: 'success' },
  separa: { text: 'Separa', color: 'warning' },
  salah: { text: 'Salah', color: 'error' },
  kosong: { text: 'Tiada jawapan', color: 'neutral' },
  belum_dimarkah: { text: 'Belum dimarkah — perlu semakan', color: 'info' },
}

const status = computed(() => STATUS[props.result.status])
const optionText = (id: string | undefined): string =>
  props.options?.find((o) => o.id === id)?.text ?? ''
const letter = (id: string | undefined): string => {
  const i = props.options?.findIndex((o) => o.id === id) ?? -1
  return i >= 0 ? String.fromCharCode(65 + i) : ''
}
const steps = computed(() => (props.result.answer.steps ?? []).filter((s) => s.trim()))
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-2xl bg-muted p-3"
    :data-testid="`part-result-${result.partId}`"
    :data-status="result.status"
  >
    <header class="flex flex-wrap items-center justify-between gap-2">
      <h4 class="text-label text-highlighted">
        {{ title ?? (result.label ? `Bahagian ${result.label}` : 'Jawapan anda') }}
      </h4>
      <div class="flex items-center gap-2">
        <UBadge :color="status.color" variant="soft" size="md" data-testid="part-status">{{
          status.text
        }}</UBadge>
        <span class="tabular text-label text-highlighted" data-testid="part-marks">
          {{ result.awarded }} / {{ result.marks }}
        </span>
      </div>
    </header>

    <div v-if="options" class="text-body text-default">
      <p>
        Pilihan anda:
        <strong v-if="result.answer.choice">
          {{ letter(result.answer.choice) }} <RichText :text="optionText(result.answer.choice)" />
        </strong>
        <em v-else>tiada</em>
      </p>
      <p>
        Jawapan betul:
        <strong>
          {{ letter(result.scheme.correctOption) }}
          <RichText :text="optionText(result.scheme.correctOption)" />
        </strong>
      </p>
    </div>

    <div v-else class="flex flex-col gap-1 text-body text-default">
      <template v-if="steps.length">
        <p class="text-caption text-muted">Jalan kerja anda</p>
        <ol class="flex flex-col gap-1">
          <li v-for="(s, i) in steps" :key="i">{{ i + 1 }}. <RichText :text="s" math-only /></li>
        </ol>
      </template>
      <p v-if="result.answer.final?.trim()">
        Jawapan akhir:
        <strong><RichText :text="result.answer.final" math-only /></strong>
        <span v-if="result.answer.unit"> {{ result.answer.unit }}</span>
      </p>
      <p v-if="result.answer.choice">
        Pilihan anda: <strong>{{ result.answer.choice }}</strong>
      </p>
      <p v-if="result.answer.text?.trim()">{{ result.answer.text }}</p>
      <p v-if="result.answer.photos?.length" class="text-caption text-muted">
        {{ result.answer.photos.length }} gambar jalan kerja dilampirkan (disimpan pada peranti
        ini).
      </p>
      <p v-if="result.status === 'kosong'" class="text-muted">Tiada jawapan.</p>
    </div>

    <p
      v-if="result.status === 'belum_dimarkah'"
      class="text-body text-info"
      role="status"
      data-testid="needs-review"
    >
      Belum dimarkah — perlu semakan. Markah di bawah ialah sementara; tiada markah sifar diberi
      secara automatik.
    </p>

    <ul
      class="flex flex-col gap-2"
      :aria-label="`Titik pemarkahan ${result.label}`.trim()"
      data-testid="points"
    >
      <li
        v-for="p in result.points"
        :key="p.id"
        class="flex items-start gap-2"
        :data-hit="p.hit"
        :data-testid="`point-${p.id}`"
      >
        <UIcon
          :name="p.hit ? 'i-ph-check-circle-fill' : 'i-ph-x-circle-fill'"
          class="mt-0.5 size-5 shrink-0"
          :class="p.hit ? 'text-success' : 'text-error'"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1 text-body text-default">
          <span class="sr-only">{{ p.hit ? 'Diperoleh: ' : 'Tidak diperoleh: ' }}</span>
          <UBadge color="neutral" variant="subtle" size="sm" class="me-2">{{ p.tag }}</UBadge>
          {{ p.label }}
          <span class="tabular text-muted"> [{{ p.awarded }}/{{ p.marks }}]</span>
          <span class="block text-caption text-muted">{{ p.reason }}</span>
        </span>
      </li>
    </ul>

    <p v-if="result.ecf" class="text-caption text-info" data-testid="ecf-note">{{ result.ecf }}</p>

    <div class="rounded-xl bg-elevated p-3 text-body text-default" data-testid="scheme">
      <p class="text-label text-highlighted">Skema Pemarkahan · {{ result.scheme.marks }} markah</p>
      <p v-if="result.scheme.explanation" class="mt-1">
        <RichText :text="result.scheme.explanation" />
      </p>
      <p v-if="result.scheme.finalDisplay" class="mt-1">
        Jawapan: <strong><RichText :text="result.scheme.finalDisplay" math-only /></strong>
        <span v-if="result.scheme.unit"> ({{ result.scheme.unit }})</span>
      </p>
      <p v-if="result.scheme.model" class="mt-1">{{ result.scheme.model }}</p>
      <p v-if="result.scheme.correctLetter" class="mt-1" data-testid="scheme-letter">
        Huruf betul: <strong>{{ result.scheme.correctLetter }}</strong>
      </p>
      <p v-if="result.scheme.acceptedText" class="mt-1" data-testid="scheme-accepted">
        Jawapan diterima: <strong>{{ result.scheme.acceptedText.join(' / ') }}</strong>
      </p>
      <div v-if="result.scheme.rubric" class="mt-1 flex flex-col gap-1" data-testid="scheme-rubric">
        <p>Kriteria: {{ result.scheme.rubric.criteria.join(', ') }}</p>
        <ul class="flex flex-col gap-1">
          <li v-for="b in result.scheme.rubric.bands" :key="b.name">
            <strong>{{ b.name }}</strong> ({{ b.range[0] }}–{{ b.range[1] }}): {{ b.descriptor }}
          </li>
        </ul>
        <p v-for="n in result.scheme.rubric.notes ?? []" :key="n" class="text-caption text-muted">
          {{ n }}
        </p>
      </div>
    </div>
  </section>
</template>
