import uaParserJs from '../../libs/uaParser'

type UaResult = {
  browser?: { name?: string; version?: string }
  os?: { name?: string; version?: string }
  device?: { type?: string; model?: string; vendor?: string }
}

type DeviceInfo = {
  browserName?: string
  browserVersion?: string
  osName?: string
  osVersion?: string
  deviceType?: string
  model?: string
  vendor?: string
}

/**
 * Parse a user-agent string into display fields.
 * Returns null when the header is empty or nothing could be identified.
 */
function parseUserAgent(userAgent: string | null | undefined): DeviceInfo | null {
  if (!userAgent) return null

  const ua = uaParserJs(userAgent) as UaResult
  const deviceInfo: DeviceInfo = {
    browserName: ua?.browser?.name || undefined,
    browserVersion: ua?.browser?.version || undefined,
    osName: ua?.os?.name || undefined,
    osVersion: ua?.os?.version || undefined,
    deviceType: ua?.device?.type || undefined,
    model: ua?.device?.model || undefined,
    vendor: ua?.device?.vendor || undefined
  }

  for (const key in deviceInfo) {
    if (deviceInfo[key as keyof DeviceInfo] === undefined) delete deviceInfo[key as keyof DeviceInfo]
  }

  return Object.keys(deviceInfo).length ? deviceInfo : null
}

export = parseUserAgent
