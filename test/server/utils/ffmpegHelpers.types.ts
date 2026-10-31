import type helpers from '../../../server/utils/ffmpegHelpers'
import type { DownloadResult } from '../../../server/types/ffmpegHelpers'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type FfmpegHelpersContract = [
  Assert<Equal<ReturnType<typeof helpers.writeConcatFile>, Promise<number | null>>>,
  Assert<Equal<ReturnType<typeof helpers.extractCoverArt>, Promise<string | false>>>,
  Assert<Equal<ReturnType<typeof helpers.resizeImage>, Promise<string | false>>>,
  Assert<Equal<ReturnType<typeof helpers.downloadPodcastEpisode>, Promise<DownloadResult>>>,
  Assert<Equal<ReturnType<typeof helpers.generateFFMetadata>, string>>,
  Assert<Equal<ReturnType<typeof helpers.writeFFMetadataFile>, Promise<boolean>>>,
  Assert<Equal<ReturnType<typeof helpers.addCoverAndMetadataToFile>, Promise<void>>>,
  Assert<Equal<ReturnType<typeof helpers.mergeAudioFiles>, Promise<void>>>
]
