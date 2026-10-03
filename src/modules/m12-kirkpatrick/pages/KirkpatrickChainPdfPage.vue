<script setup lang="ts">
/**
 * `{prefix}/export-pdf` (FR-M12-61; SRS §7 #7; PROPOSED content, provisional): the target of S6 "Muat Turun Laporan".
 * It is opened in a new tab; the page fetches the PDF from the mock API and replaces its own location with the
 * object URL, so the tab shows the document (a download where the browser has no inline viewer).
 */
import { onMounted, ref } from 'vue'

import { fetchKirkpatrickChainPdf } from '../api'

const failed = ref(false)

onMounted(async () => {
  try {
    const { blob } = await fetchKirkpatrickChainPdf()
    // The object URL is intentionally not revoked: the document replaces this page.
    window.location.replace(URL.createObjectURL(blob))
  } catch {
    failed.value = true
  }
})
</script>

<template>
  <main class="p-6 text-sm text-slate-500" data-testid="kirk-pdf">
    <p v-if="failed" class="text-red-700">Gagal memuatkan data. Sila cuba lagi.</p>
    <p v-else>Memuatkan...</p>
  </main>
</template>
