const uaParserJs = require('../../libs/uaParser')

/**
 * @param {string|null|undefined} userAgent
 * @returns {{ browserName?:string, browserVersion?:string, osName?:string, osVersion?:string, deviceType?:string, model?:string, vendor?:string }|null}
 */
function parseUserAgent(userAgent) {
  if (!userAgent) return null

  const ua = uaParserJs(userAgent)
  const deviceInfo = {
    browserName: ua?.browser?.name || undefined,
    browserVersion: ua?.browser?.version || undefined,
    osName: ua?.os?.name || undefined,
    osVersion: ua?.os?.version || undefined,
    deviceType: ua?.device?.type || undefined,
    model: ua?.device?.model || undefined,
    vendor: ua?.device?.vendor || undefined
  }

  for (const key in deviceInfo) {
    if (deviceInfo[key] === undefined) delete deviceInfo[key]
  }

  return Object.keys(deviceInfo).length ? deviceInfo : null
}

module.exports = parseUserAgent
