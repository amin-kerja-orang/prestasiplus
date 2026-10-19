<script setup lang="ts">
/**
 * S15 `/admin/school-subscriptions/:id/renewal-invoice` "Invoice Pembaharuan - {school name}" (M02-T9;
 * FR-M02-97, BR-30). Standalone (`bare` layout, no shell): a white A4-like page. The buttons "Cetak
 * Invoice" (`window.print()`) and "Kembali" (-> S14) are hidden when printing. The page fits the
 * viewport below 640 px (DV-M02-06: live overflows at 375): header blocks stack and the student table
 * scrolls inside its own container. Payment is offline (D14); nothing is collected here.
 */
import { computed, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { AlertBox } from '@/components/feedback'
import { useApi, usePageMeta } from '@/composables'
import { formatNumber } from '@/lib/number'
import { formatDate, formatDateCompact } from '@/lib/time'

import { fetchRenewalInvoice } from '../api/subscriptions'
import { errorLines } from '../lib/school-errors'
import { isNotFound, money, SUBSCRIPTION_ROUTES } from '../lib/subscription-options'

const props = defineProps<{ id: number }>()
const pageMeta = usePageMeta()

const {
  data: invoice,
  error,
  reload,
} = useApi(
  (signal) => fetchRenewalInvoice(props.id, { signal }),
  () => props.id,
)

watch(
  () => isNotFound(error.value),
  (is404) => {
    if (is404) setRouteOutcome(404)
  },
  { immediate: true },
)

watch(
  invoice,
  (inv) => {
    if (inv) pageMeta.setTitle(`Invoice Pembaharuan - ${inv.school.name}`)
  },
  { immediate: true },
)

const school = computed(() => invoice.value?.school ?? null)
const place = computed(() =>
  school.value
    ? [school.value.state, school.value.district].filter((v) => v !== null && v !== '').join(' · ')
    : '',
)

function print(): void {
  window.print()
}

const TH = 'px-3 py-2 text-left text-xs font-semibold text-slate-600'
const TD = 'px-3 py-2 text-sm text-slate-700'
</script>

<template>
  <div class="min-h-screen bg-white text-slate-800" data-testid="invoice-page">
    <div
      class="flex flex-wrap items-center justify-center gap-4 bg-slate-100 px-4 py-3 print:hidden"
      data-testid="invoice-toolbar"
    >
      <button
        type="button"
        class="min-h-11 rounded-lg bg-amber-500 px-6 py-2 text-sm font-bold text-white transition hover:bg-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        data-testid="invoice-print"
        @click="print"
      >
        Cetak Invoice
      </button>
      <RouterLink
        :to="{ name: SUBSCRIPTION_ROUTES.detail, params: { id } }"
        class="inline-flex min-h-11 items-center text-sm text-slate-600 underline"
        data-testid="invoice-back"
      >
        Kembali
      </RouterLink>
    </div>

    <main class="mx-auto w-full max-w-[794px] px-4 py-8 sm:px-6" data-testid="invoice-sheet">
      <div v-if="error && !isNotFound(error)" class="space-y-3" data-testid="invoice-error">
        <AlertBox :messages="errorLines(error)" />
        <button
          type="button"
          class="inline-flex min-h-11 items-center rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-bold text-white"
          @click="reload()"
        >
          Cuba Lagi
        </button>
      </div>

      <div v-else-if="!invoice || !school" class="space-y-4" data-testid="invoice-skeleton">
        <div class="h-16 animate-pulse rounded-xl bg-slate-100"></div>
        <div class="h-32 animate-pulse rounded-xl bg-slate-100"></div>
        <div class="h-64 animate-pulse rounded-xl bg-slate-100"></div>
      </div>

      <template v-else>
        <header
          class="flex flex-col gap-4 border-b-4 border-amber-500 pb-4 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <h1 class="font-heading text-2xl font-extrabold tracking-wide text-amber-500">
              PRESTASIPLUS
            </h1>
            <p class="mt-1 text-xs text-slate-500">Platform Pembelajaran Interaktif</p>
            <p class="mt-1 text-xs text-slate-500">https://prestasiplus.my</p>
          </div>
          <div class="sm:text-right">
            <h2 class="font-heading text-xl font-bold tracking-widest text-slate-600 uppercase">
              Invoice Pembaharuan
            </h2>
            <p class="mt-1 text-xs text-slate-400" data-testid="invoice-date">
              Tarikh: {{ formatDate(invoice.date) }}
            </p>
            <p class="mt-1 text-xs text-slate-400" data-testid="invoice-ref">
              Ref: INV-{{ id }}-{{ formatDateCompact(invoice.date) }}
            </p>
          </div>
        </header>

        <section class="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-5">
          <h3 class="font-heading text-sm font-bold text-slate-600">Maklumat Sekolah</h3>
          <p
            class="mt-2 font-heading text-lg font-bold break-words text-slate-900"
            data-testid="invoice-school"
          >
            {{ school.name }}
          </p>
          <p class="mt-1 text-xs break-words text-slate-500" data-testid="invoice-school-meta">
            Kod: {{ school.code }} · {{ place }}
          </p>
        </section>

        <section class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
            <p class="text-[11px] tracking-wider text-amber-800 uppercase">Pakej</p>
            <p
              class="mt-1 font-heading text-sm font-bold text-amber-950"
              data-testid="invoice-package"
            >
              {{ invoice.packageName }}
            </p>
          </div>
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
            <p class="text-[11px] tracking-wider text-amber-800 uppercase">Tempoh Semasa</p>
            <p
              class="mt-1 font-heading text-sm font-bold text-amber-950"
              data-testid="invoice-current"
            >
              {{ formatDate(invoice.currentPeriod.start) }} -
              {{ formatDate(invoice.currentPeriod.end) }}
            </p>
          </div>
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
            <p class="text-[11px] tracking-wider text-amber-800 uppercase">Pembaharuan</p>
            <p
              class="mt-1 font-heading text-sm font-bold text-amber-950"
              data-testid="invoice-renewal"
            >
              {{ formatDate(invoice.renewalPeriod.start) }} -
              {{ formatDate(invoice.renewalPeriod.end) }}
            </p>
          </div>
        </section>

        <section class="mt-6">
          <h3
            class="font-heading text-sm font-bold text-slate-600"
            data-testid="invoice-list-title"
          >
            Senarai Pelajar ({{ invoice.studentCount }} orang)
          </h3>
          <div class="mt-2 max-w-full overflow-x-auto rounded-lg border border-slate-100">
            <table class="w-full min-w-[420px] text-left" data-testid="invoice-table">
              <thead class="bg-slate-100">
                <tr>
                  <th scope="col" :class="TH">No.</th>
                  <th scope="col" :class="TH">Nama Pelajar</th>
                  <th scope="col" :class="TH">ID Delima</th>
                  <th scope="col" :class="TH">Tingkatan</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="student in invoice.students"
                  :key="student.no"
                  class="border-t border-slate-100"
                  data-testid="invoice-row"
                >
                  <td :class="[TD, 'text-slate-400']">{{ student.no }}</td>
                  <td :class="TD">{{ student.name }}</td>
                  <td :class="[TD, 'font-mono text-xs']">{{ student.idDelima }}</td>
                  <td :class="TD">{{ student.classLevel }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section
          class="mt-6 ml-auto w-full max-w-sm space-y-1 text-sm"
          data-testid="invoice-totals"
        >
          <div class="flex justify-between gap-4">
            <span class="text-slate-500">Bilangan pelajar</span>
            <span data-testid="invoice-count">{{ formatNumber(invoice.studentCount) }} orang</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-slate-500">Harga per pelajar / tahun</span>
            <span data-testid="invoice-price">{{ money(invoice.pricePerStudent) }}</span>
          </div>
          <div class="flex justify-between gap-4 border-t-2 border-amber-500 pt-2 font-bold">
            <span>JUMLAH</span>
            <span data-testid="invoice-total">{{ money(invoice.total) }}</span>
          </div>
        </section>

        <section class="mt-8 rounded-xl border border-slate-200 p-4 text-xs text-slate-600">
          <h4 class="font-heading text-sm font-bold text-slate-700">Maklumat Pembayaran</h4>
          <p class="mt-2">
            Sila buat pembayaran melalui pemindahan bank atau tunai kepada pihak pentadbir.
          </p>
          <p class="mt-1">
            Selepas pembayaran dibuat, sila maklumkan rujukan pembayaran kepada pentadbir untuk
            pengesahan.
          </p>
        </section>

        <footer class="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          <p>Dokumen ini dijana secara automatik oleh sistem PRESTASIPLUS.</p>
          <p class="mt-1">Untuk sebarang pertanyaan, hubungi pentadbir sistem.</p>
        </footer>
      </template>
    </main>
  </div>
</template>
