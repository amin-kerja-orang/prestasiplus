import type { NextFunction, Request, Response } from 'express'

/**
 * Default security headers for every API response (BE-33). They are set before the route runs, so a route that
 * sets its own value (the file and audio downloads set a sandbox CSP, nosniff and CORP) simply overwrites it.
 *
 * HSTS is sent when the request arrived over HTTPS (`req.secure`, which follows `TRUST_PROXY_HOPS` and
 * `X-Forwarded-Proto` behind nginx) or when `NODE_ENV=production` (the API is only ever served over TLS there; the
 * env gate also covers a proxy hop count of 0). It is never sent in development or test, where http is normal.
 */
export function securityHeaders(options: { production: boolean }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    res.removeHeader('X-Powered-By')
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site')
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'")
    if (options.production || req.secure) res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains')
    next()
  }
}
