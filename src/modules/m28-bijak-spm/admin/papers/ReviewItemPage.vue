<script setup lang="ts">
/**
 * Ruang kerja semakan (`/admin/spm/semakan/:key`): the question (or stimulus group) with its shared
 * figure rendered once, the mark scheme, the publish gate and the three decisions. A decision on a
 * group applies to every question in it.
 */
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables/useApi'
import { useFlash } from '@/composables/useFlash'
import { DsDialog, DsLoadError, DsPage, DsPanel, DsStatusBadge } from '@/ds'

import RichText from '../../components/RichText.vue'
import type { DecisionAction } from '../../domain/admin-types'
import { formatDateTime } from '../../lib/use-bijak'
import { bijakServer } from '../../server/client'
import QuestionPreview from './QuestionPreview.vue'
import { ADMIN_ROUTES, CONFIDENCE_LABEL, KIND_LABEL, STATUS_BADGE, ageText } from './ui'

const server = bijakServer()
const route = useRoute()
const router = useRouter()
const flash = useFlash()

const key = computed(() => String(route.params.key))
const { data, error, reload } = useApi(() => server.getReviewItem(key.value), key)

const dialog = ref<DecisionAction | null>(null)
const reason = ref('')
const reasonError = ref('')
const busy = ref(false)
const errors = ref<string[]>([])

const DIALOG_TEXT = {
  tolak: {
    title: 'Tolak soalan?',
    desc: 'Soalan disimpan dengan sebab dan tidak akan menjadi soalan Terbit.',
    confirm: 'Tolak',
  },
  betulkan: {
    title: 'Minta pembetulan',
    desc: 'Soalan dikembalikan kepada penghantar sebagai Draf dengan sebab ini.',
    confirm: 'Minta Pembetulan',
  },
  terbit: { title: '', desc: '', confirm: '' },
} as const

const isOpen = computed({
  get: () => dialog.value !== null,
  set: (v: boolean) => {
    if (!v) dialog.value = null
  },
})

function ask(action: DecisionAction): void {
  reason.value = ''
  reasonError.value = ''
  dialog.value = action
}

async function decide(action: DecisionAction, why?: string): Promise<void> {
  busy.value = true
  errors.value = []
  try {
    const res = await server.reviewDecision(key.value, { action, ...(why ? { reason: why } : {}) })
    if (!res.ok) {
      errors.value = res.errors
      if (action !== 'terbit') reasonError.value = res.errors[0] ?? ''
      return
    }
    dialog.value = null
    flash.show({
      type: 'success',
      message:
        action === 'terbit'
          ? 'Soalan diluluskan dan diterbitkan.'
          : action === 'tolak'
            ? 'Soalan ditolak.'
            : 'Pembetulan diminta daripada penghantar.',
    })
    await router.push({ name: ADMIN_ROUTES.review })
  } finally {
    busy.value = false
  }
}

function confirmReason(): void {
  if (!dialog.value) return
  if (!reason.value.trim()) {
    reasonError.value = 'Sebab diperlukan.'
    return
  }
  void decide(dialog.value, reason.value)
}

async function resubmit(): Promise<void> {
  busy.value = true
  try {
    await server.resubmit(key.value)
    flash.show({ type: 'success', message: 'Dihantar semula untuk semakan.' })
    await reload()
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <DsPage
    layout="detail"
    width="wide"
    :back-to="{ name: ADMIN_ROUTES.review }"
    back-label="Baris Gilir Semakan"
    data-testid="review-item-page"
  >
    <DsLoadError v-if="error" message="Tidak dapat memuatkan item semakan." @retry="reload()" />

    <template v-else-if="data">
      <DsPanel data-testid="review-meta">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-col gap-1">
            <h2 class="text-heading text-highlighted">
              {{ data.item.subjectName }} · Kertas {{ data.item.kertas }} ·
              {{ KIND_LABEL[data.item.kind] }}
            </h2>
            <p class="text-caption text-muted">
              {{ data.item.topic }} · {{ data.item.marks }} markah · versi {{ data.item.version }} ·
              {{ data.item.source }} · {{ data.item.uploader }} · {{ ageText(data.item.ageDays) }} ·
              {{ CONFIDENCE_LABEL[data.item.confidence] }}
            </p>
          </div>
          <DsStatusBadge :status="STATUS_BADGE[data.item.status]" />
        </div>
        <p
          v-if="data.reason"
          class="mt-3 rounded-lg bg-muted p-3 text-body"
          data-testid="review-reason"
        >
          <span class="font-semibold">Sebab:</span> {{ data.reason }}
        </p>
      </DsPanel>

      <div
        v-if="data.item.isRevision"
        class="grid gap-4 md:grid-cols-2"
        data-testid="revision-diff"
      >
        <DsPanel>
          <h3 class="mb-2 text-subheading text-highlighted">
            Versi {{ data.item.version - 1 }} (sedang melayani pelajar)
          </h3>
          <p class="text-body"><RichText :text="data.liveStem ?? ''" /></p>
        </DsPanel>
        <DsPanel>
          <h3 class="mb-2 text-subheading text-highlighted">
            Versi {{ data.item.version }} (cadangan)
          </h3>
          <p class="text-body">
            <RichText :text="data.questions[0]?.stem ?? ''" />
          </p>
          <p v-if="data.revisionNote" class="mt-2 text-caption text-muted">
            Nota: {{ data.revisionNote }}
          </p>
        </DsPanel>
      </div>

      <UAlert
        v-if="data.fullEdit"
        color="info"
        variant="subtle"
        icon="i-ph-info"
        title="Sunting penuh"
        description="Soalan, pilihan, skema dan tag DSKP di bawah ialah versi cadangan. Versi semasa terus melayani pelajar sehingga ini diluluskan."
        data-testid="revision-full-note"
      />

      <p v-if="data.item.groupId" class="text-body text-muted" data-testid="group-note">
        Keputusan ini terpakai untuk semua {{ data.questions.length }} soalan dalam kumpulan
        rangsangan.
      </p>

      <QuestionPreview
        :questions="data.questions"
        :stimulus="data.stimulus"
        :option-bank="data.optionBank"
      />

      <DsPanel v-if="data.item.status === 'semakan'" data-testid="review-gate">
        <h3 class="mb-2 text-subheading text-highlighted">Pintu terbit</h3>
        <p v-if="!data.gate.length && !errors.length" class="text-body text-success">
          Semua syarat dipenuhi: skema lengkap dan markah sepadan.
        </p>
        <ul v-else class="flex list-disc flex-col gap-1 ps-5 text-body text-error">
          <li v-for="e in [...new Set([...data.gate, ...errors])]" :key="e">{{ e }}</li>
        </ul>
      </DsPanel>

      <DsPanel>
        <h3 class="mb-2 text-subheading text-highlighted">Sejarah</h3>
        <ol class="flex flex-col gap-1 text-caption text-default" data-testid="review-history">
          <li v-for="(h, i) in data.history" :key="i">
            {{ formatDateTime(h.at) }} · {{ h.by }} · v{{ h.version }} ·
            <span class="font-semibold">{{ h.action }}</span>
            <template v-if="h.note"> · {{ h.note }}</template>
          </li>
        </ol>
      </DsPanel>

      <!-- Sticky decision bar: a raised layer with its own shadow (never loose buttons over the
           content). On a phone Tolak and Minta Pembetulan share a row and Lulus & Terbit takes the
           full width below, so the bar stays two rows high instead of wrapping unevenly. -->
      <DsPanel behavior="bar" padding="sm" data-testid="review-actions">
        <div class="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <template v-if="data.item.status === 'semakan'">
            <UButton
              color="error"
              variant="soft"
              icon="i-ph-x-circle"
              label="Tolak"
              class="min-h-11 justify-center px-2 sm:px-4"
              :disabled="busy"
              data-testid="action-reject"
              @click="ask('tolak')"
            />
            <UButton
              color="warning"
              variant="soft"
              icon="i-ph-arrow-u-up-left"
              label="Minta Pembetulan"
              class="min-h-11 justify-center px-2 sm:px-4"
              :ui="{ label: 'overflow-visible whitespace-normal text-center leading-tight' }"
              :disabled="busy"
              data-testid="action-correct"
              @click="ask('betulkan')"
            />
            <UButton
              icon="i-ph-seal-check"
              label="Lulus & Terbit"
              class="col-span-2 min-h-11 justify-center sm:col-span-1"
              :loading="busy"
              :disabled="data.gate.length > 0"
              data-testid="action-publish"
              @click="decide('terbit')"
            />
          </template>
          <UButton
            v-else-if="data.item.status !== 'terbit'"
            icon="i-ph-arrow-counter-clockwise"
            label="Hantar semula untuk semakan"
            class="col-span-2 min-h-11 justify-center sm:col-span-1"
            :loading="busy"
            data-testid="action-resubmit"
            @click="resubmit"
          />
        </div>
      </DsPanel>

      <DsDialog
        v-model:open="isOpen"
        :title="dialog ? DIALOG_TEXT[dialog].title : ''"
        :description="dialog ? DIALOG_TEXT[dialog].desc : ''"
        :loading="busy"
      >
        <UFormField label="Sebab" :error="reasonError" required>
          <UTextarea
            v-model="reason"
            :rows="3"
            class="w-full"
            placeholder="Terangkan sebab"
            data-testid="decision-reason"
          />
        </UFormField>
        <template #footer>
          <UButton
            color="neutral"
            variant="ghost"
            label="Batal"
            class="min-h-11"
            @click="dialog = null"
          />
          <UButton
            :color="dialog === 'tolak' ? 'error' : 'warning'"
            :label="dialog ? DIALOG_TEXT[dialog].confirm : ''"
            class="min-h-11"
            :loading="busy"
            data-testid="decision-confirm"
            @click="confirmReason"
          />
        </template>
      </DsDialog>
    </template>
  </DsPage>
</template>
