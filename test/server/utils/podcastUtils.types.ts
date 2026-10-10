import type { parsePodcastRssFeedXml, getPodcastFeed, findMatchingEpisodes, findMatchingEpisodesInFeed, RssPodcast, RssPodcastEpisode } from '../../../server/utils/podcastUtils'
import type { EpisodeMatch, ParsedPodcastFeed } from '../../../server/types/podcastUtils'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type PodcastUtilsContract = [
  Assert<Equal<ReturnType<typeof parsePodcastRssFeedXml>, Promise<ParsedPodcastFeed | null>>>,
  Assert<Equal<ReturnType<typeof getPodcastFeed>, Promise<RssPodcast | null>>>,
  Assert<Equal<ReturnType<typeof findMatchingEpisodes>, Promise<EpisodeMatch[] | null>>>,
  Assert<Equal<ReturnType<typeof findMatchingEpisodesInFeed>, EpisodeMatch[] | null>>,
  Assert<Equal<RssPodcastEpisode['publishedAt'], number | null>>,
  Assert<Equal<RssPodcastEpisode['guid'], string | null>>,
  Assert<Equal<RssPodcastEpisode['durationSeconds'], number | null>>
]
