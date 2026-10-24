import { onBeforeUnmount, onMounted } from 'vue'

const POLICY = 'no-referrer'

/**
 * While the calling page is mounted the document sends no Referer (`<meta name="referrer"
 * content="no-referrer">`). The reset pages must send `Referrer-Policy: no-referrer` (contract
 * `/auth/password/email`, SW8-07b), but an SPA that arrives by client-side navigation keeps the
 * policy of its first document load, so the policy is also set from the page itself. The path
 * route `/password/reset/:token` holds the token in the URL; without this, the page URL would be
 * the Referer of the same-origin API call. An existing referrer meta is restored on unmount.
 */
export function useNoReferrer(): void {
  let created: HTMLMetaElement | null = null
  let existing: HTMLMetaElement | null = null
  let previous = ''

  onMounted(() => {
    if (typeof document === 'undefined') return
    existing = document.head.querySelector<HTMLMetaElement>('meta[name="referrer"]')
    if (existing) {
      previous = existing.content
      existing.content = POLICY
      return
    }
    created = document.createElement('meta')
    created.name = 'referrer'
    created.content = POLICY
    document.head.appendChild(created)
  })

  onBeforeUnmount(() => {
    if (created) created.remove()
    else if (existing) existing.content = previous
    created = null
    existing = null
  })
}
