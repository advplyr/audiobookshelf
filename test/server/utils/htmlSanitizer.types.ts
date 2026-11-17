import type htmlEntities from '../../../server/utils/htmlEntities'
import type htmlSanitizer from '../../../server/utils/htmlSanitizer'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type HtmlUtilitiesContract = [
  Assert<Equal<keyof typeof htmlEntities, 'entities'>>,
  Assert<Equal<typeof htmlEntities.entities, Record<string, string>>>,
  Assert<Equal<keyof typeof htmlSanitizer, 'sanitize' | 'stripAllTags'>>,
  Assert<Equal<Parameters<typeof htmlSanitizer.sanitize>, [html: unknown]>>,
  Assert<Equal<ReturnType<typeof htmlSanitizer.sanitize>, string>>,
  Assert<Equal<Parameters<typeof htmlSanitizer.stripAllTags>, [html: unknown, shouldDecodeEntities?: boolean]>>,
  Assert<Equal<ReturnType<typeof htmlSanitizer.stripAllTags>, string>>
]
