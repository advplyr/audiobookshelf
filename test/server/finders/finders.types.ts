import authorFinder from '../../../server/finders/AuthorFinder'
import podcastFinder from '../../../server/finders/PodcastFinder'
import bookFinder from '../../../server/finders/BookFinder'

export async function finderContracts() {
  const author = await authorFinder.findAuthorByName('Writer', '', { maxLevenshtein: '2' })
  const name: string | undefined = author?.name
  const authorWithoutRegion = await authorFinder.findAuthorByName('Writer')
  const podcasts = await podcastFinder.search('Title', { country: 'NZ' })
  const podcastId: number | undefined = podcasts?.[0]?.id
  const covers: string[] | null = await podcastFinder.findCovers('Title')
  const books = await bookFinder.search({ media: { duration: 60 } }, 'audible', 'Title', null, '', '', { maxFuzzySearches: 0 })
  const genres: string[] | null | undefined = books[0]?.genres
  const confidence: number | undefined = books[0]?.matchConfidence
  const image = await authorFinder.saveAuthorImage('id', 'https://example.test/cover.png')
  const resultPath: string | undefined = 'path' in image ? image.path : undefined
  return { name, authorWithoutRegion, podcastId, covers, genres, confidence, resultPath }
}
