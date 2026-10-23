import type Ffmpeg from '../../../server/libs/fluentFfmpeg'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

// The sibling declaration must still describe the directory's CommonJS entry point.
export type FluentFfmpegContract = [
  Assert<Equal<ReturnType<typeof Ffmpeg>, Ffmpeg.FfmpegCommand>>,
  Assert<Equal<ReturnType<Ffmpeg.FfmpegCommand['run']>, void>>,
  Assert<Equal<Parameters<typeof Ffmpeg.setFfmpegPath>, [path: string]>>
]
