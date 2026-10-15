import type { Plugin } from 'vue'

/**
 * Unit-test stand-in for `@nuxt/ui/vue-plugin`. The real module is a virtual module that only the
 * Vite plugin can resolve (`virtual:nuxt-ui-plugins`); under Vitest's Node loader it cannot load.
 * The real plugin is exercised by the `/__ds` sandbox in the browser (V2-T02).
 */
const plugin: Plugin = { install() {} }

export default plugin
