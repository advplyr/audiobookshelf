import { z } from 'zod'

// Preserve legacy validation: whitespace and additional feed options remain valid.
export const openRSSFeedSchema = z.looseObject({
  serverAddress: z.string().min(1),
  slug: z.string().min(1)
})
