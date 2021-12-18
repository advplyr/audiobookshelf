import Vue from 'vue'
import vClickOutside from 'v-click-outside'
import { formatDistance, format, addDays, isDate } from 'date-fns'

Vue.directive('click-outside', vClickOutside.directive)

Vue.prototype.$eventBus = new Vue()

Vue.prototype.$dateDistanceFromNow = (unixms) => {
  if (!unixms) return ''
  return formatDistance(unixms, Date.now(), { addSuffix: true })
}
Vue.prototype.$formatDate = (unixms, fnsFormat = 'MM/dd/yyyy HH:mm') => {
  if (!unixms) return ''
  return format(unixms, fnsFormat)
}
Vue.prototype.$formatJsDate = (jsdate, fnsFormat = 'MM/dd/yyyy HH:mm') => {
  if (!jsdate || !isDate(jsdate)) return ''
  return format(jsdate, fnsFormat)
}
Vue.prototype.$addDaysToToday = (daysToAdd) => {
  var date = addDays(new Date(), daysToAdd)
  if (!date || !isDate(date)) return null
  return date
}

Vue.prototype.$bytesPretty = (bytes, decimals = 2) => {
  if (bytes === 0) {
    return '0 Bytes'
  }
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

Vue.prototype.$elapsedPretty = (seconds) => {
  var minutes = Math.floor(seconds / 60)
  if (minutes < 70) {
    return `${minutes} min`
  }
  var hours = Math.floor(minutes / 60)
  minutes -= hours * 60
  if (!minutes) {
    return `${hours} hr`
  }
  return `${hours} hr ${minutes} min`
}

Vue.prototype.$secondsToTimestamp = (seconds) => {
  var _seconds = seconds
  var _minutes = Math.floor(seconds / 60)
  _seconds -= _minutes * 60
  var _hours = Math.floor(_minutes / 60)
  _minutes -= _hours * 60
  _seconds = Math.floor(_seconds)
  if (!_hours) {
    return `${_minutes}:${_seconds.toString().padStart(2, '0')}`
  }
  return `${_hours}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}`
}

Vue.prototype.$elapsedPrettyExtended = (seconds) => {
  var minutes = Math.floor(seconds / 60)
  seconds -= minutes * 60
  var hours = Math.floor(minutes / 60)
  minutes -= hours * 60
  var days = Math.floor(hours / 24)
  hours -= days * 24

  var strs = []
  if (days) strs.push(`${days}d`)
  if (hours) strs.push(`${hours}h`)
  if (minutes) strs.push(`${minutes}m`)
  if (seconds) strs.push(`${seconds}s`)
  return strs.join(' ')
}

Vue.prototype.$calculateTextSize = (text, styles = {}) => {
  const el = document.createElement('p')

  let attr = 'margin:0px;opacity:1;position:absolute;top:100px;left:100px;z-index:99;'
  for (const key in styles) {
    if (styles[key] && String(styles[key]).length > 0) {
      attr += `${key}:${styles[key]};`
    }
  }

  el.setAttribute('style', attr)
  el.innerText = text

  document.body.appendChild(el)
  const boundingBox = el.getBoundingClientRect()
  el.remove()
  return {
    height: boundingBox.height,
    width: boundingBox.width
  }
}

Vue.prototype.$sanitizeFilename = (input, replacement = '') => {
  if (typeof input !== 'string') {
    return false
  }
  var illegalRe = /[\/\?<>\\:\*\|"]/g;
  var controlRe = /[\x00-\x1f\x80-\x9f]/g;
  var reservedRe = /^\.+$/;
  var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i;
  var windowsTrailingRe = /[\. ]+$/;

  var sanitized = input
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(windowsReservedRe, replacement)
    .replace(windowsTrailingRe, replacement);
  return sanitized
}


function xmlToJson(xml) {
  const json = {};
  for (const res of xml.matchAll(/(?:<(\w*)(?:\s[^>]*)*>)((?:(?!<\1).)*)(?:<\/\1>)|<(\w*)(?:\s*)*\/>/gm)) {
    const key = res[1] || res[3];
    const value = res[2] && xmlToJson(res[2]);
    json[key] = ((value && Object.keys(value).length) ? value : res[2]) || null;

  }
  return json;
}
Vue.prototype.$xmlToJson = xmlToJson

const encode = (text) => encodeURIComponent(Buffer.from(text).toString('base64'))
Vue.prototype.$encode = encode
const decode = (text) => Buffer.from(decodeURIComponent(text), 'base64').toString()
Vue.prototype.$decode = decode

export {
  encode,
  decode
}
export default ({ app }, inject) => {
  app.$decode = decode
  app.$encode = encode
  // app.$isDev = process.env.NODE_ENV !== 'production'
  inject('isDev', process.env.NODE_ENV !== 'production')
}