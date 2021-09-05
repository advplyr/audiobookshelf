import Vue from 'vue'
Vue.prototype.$isDev = process.env.NODE_ENV !== 'production'

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
  _seconds = Math.round(_seconds)
  if (!_hours) {
    return `${_minutes}:${_seconds.toString().padStart(2, '0')}`
  }
  return `${_hours}:${_minutes.toString().padStart(2, '0')}:${_seconds.toString().padStart(2, '0')}`
}

Vue.prototype.$cleanString = (str) => {
  if (!str) return ''

  // No longer necessary to replace accented chars, full utf-8 charset is supported
  // replace accented characters: https://stackoverflow.com/a/49901740/7431543
  // str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, "")
  return str.trim()
}

function isClickedOutsideEl(clickEvent, elToCheckOutside, ignoreSelectors = [], ignoreElems = []) {
  const isDOMElement = (element) => {
    return element instanceof Element || element instanceof HTMLDocument
  }

  const clickedEl = clickEvent.srcElement
  const didClickOnIgnoredEl = ignoreElems.filter((el) => el).some((element) => element.contains(clickedEl) || element.isEqualNode(clickedEl))
  const didClickOnIgnoredSelector = ignoreSelectors.length ? ignoreSelectors.map((selector) => clickedEl.closest(selector)).reduce((curr, accumulator) => curr && accumulator, true) : false

  if (isDOMElement(elToCheckOutside) && !elToCheckOutside.contains(clickedEl) && !didClickOnIgnoredEl && !didClickOnIgnoredSelector) {
    return true
  }

  return false
}

Vue.directive('click-outside', {
  bind: function (el, binding, vnode) {
    let vm = vnode.context;
    let callback = binding.value;
    if (typeof callback !== 'function') {
      console.error('Invalid callback', binding)
      return
    }
    el['__click_outside__'] = (ev) => {
      if (isClickedOutsideEl(ev, el)) {
        callback.call(vm, ev)
      }
    }
    document.addEventListener('click', el['__click_outside__'], false)
  },
  unbind: function (el, binding, vnode) {
    document.removeEventListener('click', el['__click_outside__'], false)
    delete el['__click_outside__']
  }
})

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

const encode = (text) => encodeURIComponent(Buffer.from(text).toString('base64'))
Vue.prototype.$encode = encode
const decode = (text) => Buffer.from(decodeURIComponent(text), 'base64').toString()
Vue.prototype.$decode = decode

export {
  encode,
  decode
}