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

Vue.prototype.$snakeToNormal = (snake) => {
  if (!snake) {
    return ''
  }
  return String(snake)
    .split('_')
    .map((t) => t.slice(0, 1).toUpperCase() + t.slice(1))
    .join(' ')
}

Vue.prototype.$normalToSnake = (normie) => {
  if (!normie) return ''
  return normie
    .trim()
    .split(' ')
    .map((t) => t.toLowerCase())
    .join('_')
}

const availableChars = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~"
const getCharCode = (char) => availableChars.indexOf(char)
const getCharFromCode = (code) => availableChars[Number(code)] || -1
const cleanChar = (char) => getCharCode(char) < 0 ? '?' : char

Vue.prototype.$cleanString = (str) => {
  if (!str) return ''

  // replace accented characters: https://stackoverflow.com/a/49901740/7431543
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, "")

  var cleaned = ''
  for (let i = 0; i < str.length; i++) {
    cleaned += cleanChar(str[i])
  }
  return cleaned
}

Vue.prototype.$stringToCode = (str) => {
  if (!str) return ''
  var numcode = [...str].map(s => {
    return String(getCharCode(s)).padStart(2, '0')
  }).join('')
  return BigInt(numcode).toString(36)
}

Vue.prototype.$codeToString = (code) => {
  if (!code) return ''
  var numcode = ''
  try {
    numcode = [...code].reduce((acc, curr) => {
      return BigInt(parseInt(curr, 36)) + BigInt(36) * acc
    }, 0n)
  } catch (err) {
    console.error('numcode fialed', code, err)
  }
  var numcodestr = String(numcode)

  var remainder = numcodestr.length % 2
  numcodestr = numcodestr.padStart(numcodestr.length - 1 + remainder, '0')

  var finalform = ''
  var numChunks = Math.floor(numcodestr.length / 2)
  var remaining = numcodestr
  for (let i = 0; i < numChunks; i++) {
    var chunk = remaining.slice(0, 2)
    remaining = remaining.slice(2)
    finalform += getCharFromCode(chunk)
  }
  return finalform
}

function cleanString(str, availableChars) {
  var _str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, "")
  var cleaned = ''
  for (let i = 0; i < _str.length; i++) {
    cleaned += availableChars.indexOf(str[i]) < 0 ? '' : str[i]
  }
  return cleaned
}

export const cleanFilterString = (str) => {
  var _str = str.toLowerCase().replace(/ /g, '_')
  _str = cleanString(_str, "0123456789abcdefghijklmnopqrstuvwxyz")
  return _str
}

function loadImageBlob(uri) {
  return new Promise((resolve) => {
    const img = document.createElement('img')
    const c = document.createElement('canvas')
    const ctx = c.getContext('2d')
    img.onload = ({ target }) => {
      c.width = target.naturalWidth
      c.height = target.naturalHeight
      ctx.drawImage(target, 0, 0)
      c.toBlob((b) => resolve(b), 'image/jpeg', 0.75)
    }
    img.crossOrigin = ''
    img.src = uri
  })
}

Vue.prototype.$downloadImage = async (uri, name) => {
  var blob = await loadImageBlob(uri)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.target = '_blank'
  a.download = name || 'fotosho-image'
  a.click()
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
