import type { RequestHandler } from 'express'
import type { RateLimitRequestHandler } from 'express-rate-limit'
import type notifications from '../../../server/utils/notifications'
import type rateLimiterFactory from '../../../server/utils/rateLimiterFactory'
import profiler from '../../../server/utils/profiler'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export function profileContracts() {
  const nonQuery = profiler.profile((count: number, label: string) => Promise.resolve({ count, label }), false)
  const synchronous = profiler.profile((value: number) => value, false)
  const query = profiler.profile((options: { benchmark?: boolean; logging?: boolean | ((query: string, time?: number) => void); where: { id: number } }) => Promise.resolve(options.where.id))
  const whereOnly = profiler.profile((options: { where: { id: number } }) => options.where.id)
  const dynamic = profiler.profile((options: { where: { id: number } }) => options.where.id, Boolean(process.env.QUERY_PROFILING))
  return { nonQuery, synchronous, query, whereOnly, dynamic }
}

type Profiled = ReturnType<typeof profileContracts>
type Event = typeof notifications.notificationData.events[number]

export type ProfilingAndAuthUtilsContract = [
  Assert<Equal<Parameters<Profiled['nonQuery']>, [count: number, label: string]>>,
  Assert<Equal<ReturnType<Profiled['nonQuery']>, Promise<{ count: number; label: string }>>>,
  Assert<Equal<ReturnType<Profiled['synchronous']>, Promise<number>>>,
  Assert<Equal<Parameters<Profiled['query']>[0]['where'], { id: number }>>,
  Assert<Equal<ReturnType<Profiled['query']>, Promise<number>>>,
  Assert<Equal<Parameters<Profiled['whereOnly']>, [options: { where: { id: number } }]>>,
  Assert<Equal<ReturnType<Profiled['dynamic']>, Promise<number>>>,
  Assert<Equal<keyof typeof profiler, 'profile'>>,
  Assert<Equal<keyof typeof notifications, 'notificationData'>>,
  Assert<Equal<Event['testData'], Record<string, string | number>>>,
  Assert<Equal<Event['libraryMediaType'], string | undefined>>,
  Assert<Equal<ReturnType<typeof rateLimiterFactory.getAuthRateLimiter>, RateLimitRequestHandler | RequestHandler>>,
  Assert<Equal<typeof rateLimiterFactory.authRateLimiter, RateLimitRequestHandler | RequestHandler | null>>
]
