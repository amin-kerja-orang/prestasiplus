import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../../../common/config/env.schema'
import { HTML_SANITIZER } from './html-sanitizer'
import { originsOf, SanitizeHtmlSanitizer } from './sanitize-html.sanitizer'

/**
 * Shared content helpers (BE-24). Provides the `HTML_SANITIZER` token, bound to the `sanitize-html` adapter with
 * the strict config (images only as stored files, on the relative path or a `PUBLIC_ORIGINS` origin). The
 * hand-written `AllowListHtmlSanitizer` stays in the code base as the documented fallback: to use it, bind it here.
 * No consumer imports an implementation.
 */
@Module({
  providers: [
    {
      provide: HTML_SANITIZER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => new SanitizeHtmlSanitizer(originsOf(config.get('PUBLIC_ORIGINS', { infer: true }))),
    },
  ],
  exports: [HTML_SANITIZER],
})
export class ContentSharedModule {}
