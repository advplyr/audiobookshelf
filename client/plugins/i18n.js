import Vue from "vue"
import enUsStrings from '../strings/en-us.json'
import { supplant } from './utils'

const defaultCode = 'en-us'

const languageCodeMap = {
  'de': 'Deutsch',
  'en-us': 'English',
  // 'es': 'Español',
  'fr': 'Français',
  'hr': 'Hrvatski',
  'it': 'Italiano',
  'pl': 'Polski',
  'zh-cn': '简体中文 (Simplified Chinese)'
}
Vue.prototype.$languageCodeOptions = Object.keys(languageCodeMap).map(code => {
  return {
    text: languageCodeMap[code],
    value: code
  }
})

Vue.prototype.$languageCodes = {
  default: defaultCode,
  current: defaultCode,
  local: null,
  server: null
}

Vue.prototype.$strings = { ...enUsStrings }

Vue.prototype.$getString = (key, subs) => {
  if (!Vue.prototype.$strings[key]) return ''
  if (subs && Array.isArray(subs) && subs.length) {
    return supplant(Vue.prototype.$strings[key], subs)
  }
  return Vue.prototype.$strings[key]
}

var translations = {
  [defaultCode]: enUsStrings
}

function loadTranslationStrings(code) {
  return new Promise((resolve) => {
    import(`../strings/${code}`).then((fileContents) => {
      resolve(fileContents.default)
    }).catch((error) => {
      console.error('Failed to load i18n strings', code, error)
      resolve(null)
    })
  })
}

async function loadi18n(code) {
  if (!code) return false
  if (Vue.prototype.$languageCodes.current == code) {
    // already set
    return false
  }

  const strings = translations[code] || await loadTranslationStrings(code)
  if (!strings) {
    console.warn(`Invalid lang code ${code}`)
    return false
  }

  translations[code] = strings
  Vue.prototype.$languageCodes.current = code
  localStorage.setItem('lang', code)

  for (const key in Vue.prototype.$strings) {
    Vue.prototype.$strings[key] = strings[key] || translations[defaultCode][key]
  }
  console.log(`ConfigDateFnsLocale = ${translations[code].ConfigDateFnsLocale}`)
  Vue.prototype.$setDateFnsLocale(translations[code].ConfigDateFnsLocale)

  console.log('i18n strings=', Vue.prototype.$strings)
  Vue.prototype.$eventBus.$emit('change-lang', code)
  return true
}

Vue.prototype.$setLanguageCode = loadi18n

// Set the servers default language code, does not override users local language code
Vue.prototype.$setServerLanguageCode = (code) => {
  if (!code) return

  if (!languageCodeMap[code]) {
    console.warn('invalid server language in', code)
  } else {
    Vue.prototype.$languageCodes.server = code
    if (!Vue.prototype.$languageCodes.local && code !== defaultCode) {
      loadi18n(code)
    }
  }
}

// Initialize with language code in localStorage if valid
async function initialize() {
  const localLanguage = localStorage.getItem('lang')
  if (!localLanguage) return

  if (!languageCodeMap[localLanguage]) {
    console.warn('Invalid local language code', localLanguage)
    localStorage.setItem('lang', defaultCode)
  } else {
    Vue.prototype.$languageCodes.local = localLanguage
    loadi18n(localLanguage)
  }
}
initialize()

