/**
 * Native `window.confirm` / `window.alert` wrappers (overview §9). The single implementation lives
 * in `@/components/overlay` (F-15); this is a re-export so composable users have one import path.
 */

export { alertNative, confirmNative } from '@/components/overlay/native-dialogs'
