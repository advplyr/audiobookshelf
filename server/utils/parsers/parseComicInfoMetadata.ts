type TextList = { 0?: { trim(): string } | null } | null | undefined

type ComicInfoDocument = {
  ComicInfo?: {
    Series?: TextList
    Number?: TextList
    Summary?: TextList
  } | null
} | null

type ComicSeries = {
  name: string
  sequence: string | null
}

export type ComicInfoMetadata = {
  title: string | null
  series: ComicSeries[]
  description: string | null
}

/**
 * Parse ComicInfo.json fields into book metadata.
 * @see https://anansi-project.github.io/docs/comicinfo/intro
 */
export function parse(comicInfoJson: ComicInfoDocument): ComicInfoMetadata | null {
  if (!comicInfoJson?.ComicInfo) return null

  const ComicSeries = comicInfoJson.ComicInfo.Series?.[0]?.trim() || null
  const ComicNumber = comicInfoJson.ComicInfo.Number?.[0]?.trim() || null
  const ComicSummary = comicInfoJson.ComicInfo.Summary?.[0]?.trim() || null

  let title: string | null = null
  const series: ComicSeries[] = []
  if (ComicSeries) {
    series.push({
      name: ComicSeries,
      sequence: ComicNumber
    })

    title = ComicSeries
    if (ComicNumber) {
      title += ` ${ComicNumber}`
    }
  }

  return {
    title,
    series,
    description: ComicSummary
  }
}
