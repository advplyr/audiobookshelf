import type { probe, rawProbe } from '../../../server/utils/prober'
import type { ProbedMedia, ProbeFailure } from '../../../server/types/prober'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type ProberContract = [
  Assert<Equal<Parameters<typeof probe>, [filepath: string, verbose?: boolean]>>,
  Assert<Equal<ReturnType<typeof probe>, Promise<ProbedMedia | ProbeFailure>>>,
  Assert<Equal<ReturnType<typeof rawProbe>, Promise<unknown>>>,
  Assert<Equal<ProbeFailure['error'], unknown>>,
  Assert<Equal<ProbedMedia['duration'], number | null>>,
  Assert<Equal<ProbedMedia['audioStream']['bit_rate'], number | null>>
]
