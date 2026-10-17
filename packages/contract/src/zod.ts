import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

// zod-to-openapi must patch zod before any schema is created, so every contract file imports `z`
// from here instead of from 'zod'.
extendZodWithOpenApi(z)

export { z }
