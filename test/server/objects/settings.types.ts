import type EmailSettings from '../../../server/objects/settings/EmailSettings'
import type NotificationSettings from '../../../server/objects/settings/NotificationSettings'
import type ServerSettings from '../../../server/objects/settings/ServerSettings'
import type Setting from '../../../server/models/Setting'

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Assert<T extends true> = T
type PrivateSettingKey = 'tokenSecret' | 'authOpenIDClientID' | 'authOpenIDClientSecret' | 'authOpenIDMobileRedirectURIs' | 'authOpenIDGroupClaim' | 'authOpenIDAdvancedPermsClaim'

export type SettingsContract = [
  Assert<Equal<ReturnType<EmailSettings['toJSON']>['host'], string | null | undefined>>,
  Assert<Equal<ReturnType<EmailSettings['getEReaderDevice']>, EmailSettings['ereaderDevices'][number] | undefined>>,
  Assert<Equal<ReturnType<NotificationSettings['getNotification']>, NotificationSettings['notifications'][number] | undefined>>,
  Assert<Equal<ReturnType<ServerSettings['toJSON']>['homeBookshelfView'], number | undefined>>,
  Assert<Equal<Extract<keyof ReturnType<ServerSettings['toJSONForBrowser']>, PrivateSettingKey>, never>>,
  Assert<Equal<ReturnType<ServerSettings['toJSONForBrowser']>['timeZone'], string>>,
  Assert<Equal<Awaited<ReturnType<typeof Setting.getOldSettings>>['emailSettings'], EmailSettings>>,
  Assert<Equal<Awaited<ReturnType<typeof Setting.getOldSettings>>['serverSettings'], ServerSettings>>,
  Assert<Equal<Awaited<ReturnType<typeof Setting.getOldSettings>>['notificationSettings'], NotificationSettings>>
]
