import Vue from 'vue'
import Path from 'path'
import vClickOutside from 'v-click-outside'
import { formatDistance, format, addDays, isDate, setDefaultOptions } from 'date-fns'
import * as locale from 'date-fns/locale'

Vue.directive('click-outside', vClickOutside.directive)

Vue.prototype.$setDateFnsLocale = (localeString) => {
  if (!locale[localeString]) return 0
  return setDefaultOptions({ locale: locale[localeString] })
}
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
Vue.prototype.$formatTime = (unixms, fnsFormat = 'HH:mm') => {
  if (!unixms) return ''
  return format(unixms, fnsFormat)
}
Vue.prototype.$formatJsTime = (jsdate, fnsFormat = 'HH:mm') => {
  if (!jsdate || !isDate(jsdate)) return ''
  return format(jsdate, fnsFormat)
}
Vue.prototype.$formatDatetime = (unixms, fnsDateFormart = 'MM/dd/yyyy', fnsTimeFormat = 'HH:mm') => {
  if (!unixms) return ''
  return format(unixms, `${fnsDateFormart} ${fnsTimeFormat}`)
}
Vue.prototype.$formatJsDatetime = (jsdate, fnsDateFormart = 'MM/dd/yyyy', fnsTimeFormat = 'HH:mm') => {
  if (!jsdate || !isDate(jsdate)) return ''
  return format(jsdate, `${fnsDateFormart} ${fnsTimeFormat}`)
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

Vue.prototype.$sanitizeFilename = (filename, colonReplacement = ' - ') => {
  if (typeof filename !== 'string') {
    return false
  }

  // Most file systems use number of bytes for max filename
  //   to support most filesystems we will use max of 255 bytes in utf-16
  //   Ref: https://doc.owncloud.com/server/next/admin_manual/troubleshooting/path_filename_length.html
  //   Issue: https://github.com/advplyr/audiobookshelf/issues/1261
  const MAX_FILENAME_BYTES = 255

  const replacement = ''
  const illegalRe = /[\/\?<>\\:\*\|"]/g
  const controlRe = /[\x00-\x1f\x80-\x9f]/g
  const reservedRe = /^\.+$/
  const windowsReservedRe = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\..*)?$/i
  const windowsTrailingRe = /[\. ]+$/
  const lineBreaks = /[\n\r]/g

  let sanitized = filename
    .replace(':', colonReplacement) // Replace first occurrence of a colon
    .replace(illegalRe, replacement)
    .replace(controlRe, replacement)
    .replace(reservedRe, replacement)
    .replace(lineBreaks, replacement)
    .replace(windowsReservedRe, replacement)
    .replace(windowsTrailingRe, replacement)
    .replace(/\s+/g, ' ') // Replace consecutive spaces with a single space

  // Check if basename is too many bytes
  const ext = Path.extname(sanitized) // separate out file extension
  const basename = Path.basename(sanitized, ext)
  const extByteLength = Buffer.byteLength(ext, 'utf16le')
  const basenameByteLength = Buffer.byteLength(basename, 'utf16le')
  if (basenameByteLength + extByteLength > MAX_FILENAME_BYTES) {
    const MaxBytesForBasename = MAX_FILENAME_BYTES - extByteLength
    let totalBytes = 0
    let trimmedBasename = ''

    // Add chars until max bytes is reached
    for (const char of basename) {
      totalBytes += Buffer.byteLength(char, 'utf16le')
      if (totalBytes > MaxBytesForBasename) break
      else trimmedBasename += char
    }

    trimmedBasename = trimmedBasename.trim()
    sanitized = trimmedBasename + ext
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
  var from = 'àáäâèéëêìíïîòóöôùúüûñçěščřžýúůďťň·/,:;'
  var to = 'aaaaeeeeiiiioooouuuuncescrzyuudtn-----'

  for (var i = 0, l = from.length; i < l; i++) {
    str = str.replace(new RegExp(from.charAt(i), 'g'), to.charAt(i))
  }

  str = str
    .replace('.', '-') // replace a dot by a dash
    .replace(/[^a-z0-9 -_]/g, '') // remove invalid chars
    .replace(/\s+/g, '-') // collapse whitespace and replace by a dash
    .replace(/-+/g, '-') // collapse dashes
    .replace(/\//g, '') // collapse all forward-slashes

  return str
}

Vue.prototype.$copyToClipboard = (str, ctx) => {
  return new Promise((resolve) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(str).then(
        () => {
          if (ctx) ctx.$toast.success('Copied to clipboard')
          resolve(true)
        },
        (err) => {
          console.error('Clipboard copy failed', str, err)
          resolve(false)
        }
      )
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
      resolve(true)
    }
  })
}

function xmlToJson(xml) {
  const json = {}
  for (const res of xml.matchAll(/(?:<(\w*)(?:\s[^>]*)*>)((?:(?!<\1).)*)(?:<\/\1>)|<(\w*)(?:\s*)*\/>/gm)) {
    const key = res[1] || res[3]
    const value = res[2] && xmlToJson(res[2])
    json[key] = (value && Object.keys(value).length ? value : res[2]) || null
  }
  return json
}
Vue.prototype.$xmlToJson = xmlToJson

const encode = (text) => encodeURIComponent(Buffer.from(text).toString('base64'))
Vue.prototype.$encode = encode
const decode = (text) => Buffer.from(decodeURIComponent(text), 'base64').toString()
Vue.prototype.$decode = decode

export { encode, decode }
export default ({ app, store }, inject) => {
  app.$decode = decode
  app.$encode = encode
  inject('eventBus', new Vue())
  inject('isDev', process.env.NODE_ENV !== 'production')

  store.commit('setRouterBasePath', app.$config.routerBasePath)
}
