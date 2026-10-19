<script setup lang="ts">
/** S6 `/admin-sekolah/pelajar` "Senarai Pelajar" (SRS M27 Part B FR-M27-88 to 93, 119; roles-matrix row L56). */
import SchoolUserList from '../components/users/SchoolUserList.vue'
</script>

<template>
  <SchoolUserList role="student" />
</template>
