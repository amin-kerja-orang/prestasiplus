/**
 * Live logo (`/images/logo-custom.png`, alt "PRESTASIPLUS"), the owner's brand asset served from
 * `public/images/`. Bound as a runtime URL (`:src`), not written as a literal `src`, so the Vue
 * template compiler does not turn it into a module import (which fails outside the dev server).
 */
export const LOGO_URL = `${import.meta.env.BASE_URL}images/logo-custom.png`
