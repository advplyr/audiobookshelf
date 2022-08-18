import Vue from 'vue'
import Path from 'path'
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
Vue.prototype.$addDaysToDate = (jsdate, daysToAdd) => {
  var date = addDays(jsdate, daysToAdd)
  if (!date || !isDate(date)) return null
  return date
}

Vue.prototype.$sanitizeFilename = (input, colonReplacement = ' - ') => {
  if (typeof input !== 'string') {
    return false
  }

  // Max is actually 255-260 for windows but this leaves padding incase ext wasnt put on yet
  const MAX_FILENAME_LEN = 240

  var replacement = ''
  var illegalRe = /[\/\?<>\\:\*\|"]/g
  var controlRe = /[\x00-\x1f\x80-\x9f]/g
  var reservedRe = /^\.+$/
  var windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
  var windowsTrailingRe = /[\. ]+$/
  var lineBreaks = /[\n\r]/g

  var sanitized = input
    .replace(':', colonReplacement) // Replace first occurrence of a colon
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(lineBreaks, replacement)
    .replace(windowsReservedRe, replacement)
    .replace(windowsTrailingRe, replacement)


  if (sanitized.length > MAX_FILENAME_LEN) {
    var lenToRemove = sanitized.length - MAX_FILENAME_LEN
    var ext = Path.extname(sanitized)
    var basename = Path.basename(sanitized, ext)
    basename = basename.slice(0, basename.length - lenToRemove)
    sanitized = basename + ext
  }

  return sanitized
}

// SOURCE: https://gist.github.com/spyesx/561b1d65d4afb595f295
//   modified: allowed underscores
Vue.prototype.$sanitizeSlug = (str) => {
  if (!str) return ''

  str = str.replace(/^\s+|\s+$/g, '') // trim
  str = str.toLowerCase()

  // remove accents, swap ñ for n, etc
  var from = "àáäâèéëêìíïîòóöôùúüûñçěščřžýúůďťň·/,:;"
  var to = "aaaaeeeeiiiioooouuuuncescrzyuudtn-----"

  for (var i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i))
  }

  str = str.replace('.', '-') // replace a dot by a dash
    .replace(/[^a-z0-9 -_]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by a dash
    .replace(/-+/g, '-') // collapse dashes
    .replace(/\//g, '') // collapse all forward-slashes

  return str
}

Vue.prototype.$copyToClipboard = (str, ctx) => {
  return new Promise((resolve) => {
    if (!navigator.clipboard) {
      navigator.clipboard.writeText(str).then(() => {
        if (ctx) ctx.$toast.success('Copied to clipboard')
        resolve(true)
      }, (err) => {
        console.error('Clipboard copy failed', str, err)
        resolve(false)
      })
    } else {
      const el = document.createElement('textarea')
      el.value = str
      el.setAttribute('readonly', '')
      el.style.position = 'absolute'
      el.style.left = '-9999px'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)

      if (ctx) ctx.$toast.success('Copied to clipboard')
    }
  })
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

Vue.prototype.$encodeUriPath = (path) => {
  return path.replace(/\\/g, '/').replace(/%/g, '%25').replace(/#/g, '%23')
}

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
  inject('isDev', process.env.NODE_ENV !== 'production')
}