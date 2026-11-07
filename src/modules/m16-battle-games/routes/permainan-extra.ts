import type { RouteRecordRaw } from 'vue-router'

/**
 * M16 route fragment, empty in R1: `/permainan/pertandingan`, `/permainan/uji-minda` and `/permainan/sambung-kata`
 * have no route record, so the catch-all 404 shows (FR-GM-00.1, FR-MUR-21-1, AC-MUR-21-1).
 */
const routes: RouteRecordRaw[] = []

export default routes
