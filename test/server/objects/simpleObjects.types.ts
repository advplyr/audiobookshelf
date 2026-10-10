import type Task from '../../../server/objects/Task'
import type TrackProgressMonitor from '../../../server/objects/TrackProgressMonitor'
import type DailyLog from '../../../server/objects/DailyLog'
import type DeviceInfo from '../../../server/objects/DeviceInfo'
import type Notification from '../../../server/objects/Notification'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T

export type SimpleObjectsContract = [
  Assert<Equal<Task['failedAt'], number | undefined>>,
  Assert<Equal<ReturnType<Task['toJSON']>['startedAt'], number | null>>,
  Assert<Equal<ReturnType<Task['toJSON']>['data'], Record<string, unknown>>>,
  Assert<Equal<Parameters<TrackProgressMonitor['progressCallback']>, [trackIndex: number, progressInTrack: number, totalProgress: number]>>,
  Assert<Equal<ReturnType<DailyLog['appendBufferedLogs']>, Promise<void>>>,
  Assert<Equal<DailyLog['logs'], unknown[]>>,
  Assert<Equal<ReturnType<DeviceInfo['toJSON']>['userId'], string | null | undefined>>,
  Assert<Equal<NonNullable<Parameters<DeviceInfo['setData']>[2]>['sdkVersion'], string | number | null | undefined>>,
  Assert<Equal<ReturnType<Notification['toJSON']>['createdAt'], number | null | undefined>>,
  Assert<Equal<Parameters<Notification['update']>[0]['type'], string | null | undefined>>,
  Assert<Equal<Parameters<Notification['parseTitleTemplate']>[0][string], string | number | boolean | null | undefined>>
]
