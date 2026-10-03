<script setup lang="ts">
/** S3 static Learning Gain card (FN-M12-4.2.1; FR-M12-36): permanent, there are no pre/post tests. */
import { FlaskConical } from '@lucide/vue'
</script>

<template>
  <section
    class="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-4 text-center sm:p-6"
    data-testid="kirk-gain-card"
  >
    <FlaskConical class="mx-auto h-8 w-8 text-slate-300" />
    <p class="mt-2 text-sm font-medium text-slate-500">Pre-Test / Post-Test belum dimulakan</p>
    <p class="text-xs text-slate-400">
      Apabila ujian diagnostik dimulakan, Hake's Normalized Learning Gain akan dikira secara
      automatik.
    </p>
    <p class="mt-1 text-xs text-slate-400">
      g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g&lt;0.7 · Low: g&lt;0.3
    </p>
  </section>
</template>
