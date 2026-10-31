import parseFullName from '../../../../server/utils/parsers/parseFullName'
import type { EBookFileScanData, parse as parseEbook } from '../../../../server/utils/parsers/parseEbookMetadata'
import type { ComicInfoMetadata } from '../../../../server/utils/parsers/parseComicInfoMetadata'
import type { OpfMetadataResult } from '../../../../server/utils/parsers/parseOpfMetadata'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

type FullName = {
  title: string
  first: string
  middle: string
  last: string
  nick: string
  suffix: string
  error: string[]
}

// Compiled but not executed: exercise overload inference for literal, union, and dynamic selectors.
export function nameResultContracts(name: unknown, dynamicPart: string, unknownPart: unknown, unionPart: 'first' | 'all', fieldPart: 'first' | 'error', uppercasePart: Uppercase<string>, patternPart: `fi${string}`) {
  return {
    full: parseFullName(name),
    first: parseFullName(name, 'first'),
    errors: parseFullName(name, 'error'),
    mixedCaseErrors: parseFullName(name, 'ErRoR'),
    nullPart: parseFullName(name, null),
    falsyPart: parseFullName(name, false),
    zeroPart: parseFullName(name, 0),
    emptyPart: parseFullName(name, ''),
    undefinedPart: parseFullName(name, undefined, true, false, true),
    unrecognizedPart: parseFullName(name, 'all'),
    dynamic: parseFullName(name, dynamicPart),
    unknown: parseFullName(name, unknownPart),
    union: parseFullName(name, unionPart),
    fields: parseFullName(name, fieldPart),
    uppercase: parseFullName(name, uppercasePart),
    pattern: parseFullName(name, patternPart)
  }
}

type NameResults = ReturnType<typeof nameResultContracts>

export type ParserResultsContract = [
  Assert<Equal<NameResults['full'], FullName>>,
  Assert<Equal<NameResults['first'], string>>,
  Assert<Equal<NameResults['errors'], string[]>>,
  Assert<Equal<NameResults['mixedCaseErrors'], string[]>>,
  Assert<Equal<NameResults['nullPart'], FullName>>,
  Assert<Equal<NameResults['falsyPart'], FullName>>,
  Assert<Equal<NameResults['zeroPart'], FullName>>,
  Assert<Equal<NameResults['emptyPart'], FullName>>,
  Assert<Equal<NameResults['undefinedPart'], FullName>>,
  Assert<Equal<NameResults['unrecognizedPart'], FullName>>,
  Assert<Equal<NameResults['dynamic'], FullName | string | string[]>>,
  Assert<Equal<NameResults['unknown'], FullName | string | string[]>>,
  Assert<Equal<NameResults['union'], FullName | string>>,
  Assert<Equal<NameResults['fields'], string | string[]>>,
  Assert<Equal<NameResults['uppercase'], FullName | string | string[]>>,
  Assert<Equal<NameResults['pattern'], FullName | string>>,
  Assert<Equal<EBookFileScanData['metadata'], OpfMetadataResult | ComicInfoMetadata | null>>,
  Assert<Equal<NonNullable<EBookFileScanData['metadata']>['title'], string | null>>,
  Assert<Equal<NonNullable<EBookFileScanData['metadata']>['series'][number]['name'], string>>,
  Assert<Equal<NonNullable<EBookFileScanData['metadata']>['series'][number]['sequence'], string | null>>,
  Assert<Equal<NonNullable<EBookFileScanData['metadata']>['description'], string | null>>,
  Assert<Equal<ReturnType<typeof parseEbook>, Promise<EBookFileScanData | null>>>
]
