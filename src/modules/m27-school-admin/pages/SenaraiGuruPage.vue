<script setup lang="ts">
/** S7 `/admin-sekolah/guru` "Senarai Guru" (SRS M27 Part B FR-M27-99 to 103, 119; roles-matrix row L57). */
import SchoolUserList from '../components/users/SchoolUserList.vue'
</script>

<template>
  <SchoolUserList role="teacher" />
</template>
