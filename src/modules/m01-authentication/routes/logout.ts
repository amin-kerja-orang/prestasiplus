import type { RouteRecordRaw } from 'vue-router'

/**
 * M01 route fragment: S6 `/logout` (M01-T5a). Intentionally empty: `/logout` is a core route owned
 * by the app shell (`src/app/router/core-routes.ts`, F-13), which calls `POST /api/auth/logout`,
 * clears the session whatever the result and replaces the history entry with `/login`
 * (FR-M01-37). Registering it here too would shadow it. The user-shell controls (FR-M01-36) live in
 * `src/shells/user/`.
 */
const routes: RouteRecordRaw[] = []

export default routes
