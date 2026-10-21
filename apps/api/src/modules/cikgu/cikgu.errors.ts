import { CIKGU_AI_UNAVAILABLE_CODE, CIKGU_AI_UNAVAILABLE_MESSAGE } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

/** 503 `AI_UNAVAILABLE` in the standard error envelope (`POST /cikgu/rph`). The chat route answers the raw form (see the chat filter). */
export const aiUnavailable = (): ApiError =>
  new ApiError({ code: CIKGU_AI_UNAVAILABLE_CODE, status: 503, message: CIKGU_AI_UNAVAILABLE_MESSAGE })
