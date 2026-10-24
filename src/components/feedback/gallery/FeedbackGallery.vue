<script setup lang="ts">
/**
 * Dev-only gallery of the F-15 components (build-plan F-15 acceptance: "a demo route in dev
 * mode shows each"). Registered as a dev-mode route by the router task (F-13), like
 * TokenGallery; never part of the demo build. Sample copy is live BM copy from the SRSs.
 */
import { ref } from 'vue'

import { AppBadge, CountBadge } from '@/components/badge'
import { alertNative, BaseModal, confirmNative, type ModalVariant } from '@/components/overlay'

import AlertBox from '../AlertBox.vue'
import FlashOutlet from '../FlashOutlet.vue'
import LoadingSpinner from '../LoadingSpinner.vue'
import ToastMessage from '../ToastMessage.vue'
import type { FlashMessage, ToastTransition } from '../types'

const modalOpen = ref(false)
const modalVariant = ref<ModalVariant>('margin')
const lastClose = ref('')
const toastOpen = ref(false)
const toastText = ref('')
const toastTransition = ref<ToastTransition>('fade')
const toastDuration = ref(2000)
const confirmResult = ref('')

const flash: FlashMessage = { type: 'success', message: 'Profil berjaya dikemaskini.' }

function openModal(variant: ModalVariant) {
  modalVariant.value = variant
  modalOpen.value = true
}

function showToast(text: string, transition: ToastTransition, duration: number) {
  toastText.value = text
  toastTransition.value = transition
  toastDuration.value = duration
  toastOpen.value = true
}

function tryConfirm() {
  confirmResult.value = confirmNative('Pasti untuk menukar status pengguna ini?') ? 'OK' : 'Batal'
}

const btn =
  'min-h-11 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
</script>

<template>
  <div class="min-h-screen bg-slate-50 p-4 sm:p-8" data-testid="dev-feedback-gallery">
    <h1 class="text-2xl font-bold">Feedback, overlay and badge components (F-15)</h1>

    <section class="mt-8 space-y-3">
      <h2 class="text-lg font-bold">AlertBox</h2>
      <AlertBox variant="error" messages="Emel atau kata laluan tidak sah." />
      <AlertBox
        variant="error"
        :messages="['The email field is required.', 'The password field is required.']"
      />
      <AlertBox variant="success" messages="Profil berjaya dikemaskini." />
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-lg font-bold">FlashOutlet</h2>
      <FlashOutlet :flash="flash" />
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-lg font-bold">LoadingSpinner</h2>
      <p class="flex items-center gap-2 text-slate-700"><LoadingSpinner /> Sedang Memasuki...</p>
      <LoadingSpinner class="h-8 w-8 text-indigo-500" />
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-lg font-bold">BaseModal</h2>
      <div class="flex flex-wrap gap-3">
        <button type="button" :class="btn" @click="openModal('margin')">Margin modal</button>
        <button type="button" :class="btn" @click="openModal('sheet')">Sheet modal</button>
      </div>
      <p v-if="lastClose" class="text-sm text-slate-500">Last close: {{ lastClose }}</p>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-lg font-bold">ToastMessage</h2>
      <div class="flex flex-wrap gap-3">
        <button type="button" :class="btn" @click="showToast('Disalin!', 'fade', 2000)">
          Fade, 2 s
        </button>
        <button
          type="button"
          :class="btn"
          @click="showToast('Ralat rangkaian. Sila cuba lagi.', 'slide', 4000)"
        >
          Slide, 4 s
        </button>
      </div>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-lg font-bold">Native dialogs</h2>
      <div class="flex flex-wrap gap-3">
        <button type="button" :class="btn" @click="tryConfirm">confirmNative</button>
        <button
          type="button"
          :class="btn"
          @click="alertNative('Sila pilih tindakan terlebih dahulu')"
        >
          alertNative
        </button>
      </div>
      <p v-if="confirmResult" class="text-sm text-slate-500">Result: {{ confirmResult }}</p>
    </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-lg font-bold">AppBadge / CountBadge</h2>
      <div class="flex flex-wrap items-center gap-3">
        <AppBadge
          badge-class="text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse"
          label="LIVE"
        />
        <AppBadge
          badge-class="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full"
          label="SPM"
        />
        <span
          class="relative inline-flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50"
        >
          🔔
          <CountBadge
            :count="166"
            :cap="99"
            badge-class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1"
          />
        </span>
        <CountBadge
          :count="6144"
          badge-class="ml-auto px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full"
        />
      </div>
    </section>

    <BaseModal
      v-model:open="modalOpen"
      :variant="modalVariant"
      @close="(reason) => (lastClose = reason)"
    >
      <template #default="{ close }">
        <div class="mb-5 flex items-center justify-between">
          <h3 class="text-lg font-bold text-slate-800">Lapor Soalan</h3>
          <button
            type="button"
            class="text-slate-400 transition-colors hover:text-slate-600"
            @click="close"
          >
            ✕
          </button>
        </div>
        <p class="text-sm text-slate-500" :class="modalVariant === 'sheet' ? 'p-5' : ''">
          Soalan ini akan dinyahaktifkan sementara
        </p>
        <button type="button" :class="btn" class="mt-4" @click="close">Batal</button>
      </template>
    </BaseModal>

    <ToastMessage
      v-model:show="toastOpen"
      :message="toastText"
      :transition="toastTransition"
      :duration="toastDuration"
    />
  </div>
</template>
