import GoogleBooks from '../../../server/providers/GoogleBooks'
import AudiobookCovers from '../../../server/providers/AudiobookCovers'
import iTunes from '../../../server/providers/iTunes'
import Audible from '../../../server/providers/Audible'
import Audnexus from '../../../server/providers/Audnexus'
import OpenLibrary from '../../../server/providers/OpenLibrary'
import FantLab from '../../../server/providers/FantLab'
import MusicBrainz from '../../../server/providers/MusicBrainz'
import CustomProviderAdapter from '../../../server/providers/CustomProviderAdapter'

// Public response contracts: optional fields and legacy synchronous returns stay visible.
export async function providerContracts() {
  const google = await new GoogleBooks().search('Title', null)
  const googleTitle: string | undefined = google[0]?.title
  const covers: { cover: string }[] = await new AudiobookCovers().search('Title')
  const podcasts: iTunes.iTunesPodcastSearchResult[] = await new iTunes().searchPodcasts('Title', { country: 'NZ' })
  const numericId: number | undefined = podcasts[0]?.id
  const asin = new Audible().asinSearch(null, '')
  const author: Audnexus.AuthorSearchObj = await new Audnexus().findAuthorByASIN('B012345678', '')
  const works = await new OpenLibrary().getWorksData('/works/1')
  const errorCode: number | undefined = works.errorCode
  const fantlab = await new FantLab().search('Title', '')
  const year: string | number | undefined = fantlab[0]?.publishedYear
  const music = new MusicBrainz().searchTrack({})
  const custom = await new CustomProviderAdapter().search('Title', '', '', 'custom-1', 'book')
  const duration: number | undefined = custom[0]?.duration
  return { googleTitle, covers, numericId, asin, author, errorCode, year, music, duration }
}
