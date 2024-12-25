import Vue from 'vue'
import enUsStrings from '../strings/en-us.json'
import { supplant } from './utils'

const defaultCode = 'en-us'

const languageCodeMap = {
  bg: { label: 'Български', dateFnsLocale: 'bg' },
  bn: { label: 'বাংলা', dateFnsLocale: 'bn' },
  ca: { label: 'Català', dateFnsLocale: 'ca' },
  cs: { label: 'Čeština', dateFnsLocale: 'cs' },
  da: { label: 'Dansk', dateFnsLocale: 'da' },
  de: { label: 'Deutsch', dateFnsLocale: 'de' },
  'en-us': { label: 'English', dateFnsLocale: 'enUS' },
  es: { label: 'Español', dateFnsLocale: 'es' },
  et: { label: 'Eesti', dateFnsLocale: 'et' },
  fi: { label: 'Suomi', dateFnsLocale: 'fi' },
  fr: { label: 'Français', dateFnsLocale: 'fr' },
  he: { label: 'עברית', dateFnsLocale: 'he' },
  hr: { label: 'Hrvatski', dateFnsLocale: 'hr' },
  it: { label: 'Italiano', dateFnsLocale: 'it' },
  lt: { label: 'Lietuvių', dateFnsLocale: 'lt' },
  hu: { label: 'Magyar', dateFnsLocale: 'hu' },
  nl: { label: 'Nederlands', dateFnsLocale: 'nl' },
  no: { label: 'Norsk', dateFnsLocale: 'no' },
  pl: { label: 'Polski', dateFnsLocale: 'pl' },
  'pt-br': { label: 'Português (Brasil)', dateFnsLocale: 'ptBR' },
  ru: { label: 'Русский', dateFnsLocale: 'ru' },
  sl: { label: 'Slovenščina', dateFnsLocale: 'sl' },
  sv: { label: 'Svenska', dateFnsLocale: 'sv' },
  uk: { label: 'Українська', dateFnsLocale: 'uk' },
  'vi-vn': { label: 'Tiếng Việt', dateFnsLocale: 'vi' },
  'zh-cn': { label: '简体中文 (Simplified Chinese)', dateFnsLocale: 'zhCN' },
  'zh-tw': { label: '正體中文 (Traditional Chinese)', dateFnsLocale: 'zhTW' }
}
Vue.prototype.$languageCodeOptions = Object.keys(languageCodeMap).map((code) => {
  return {
    text: languageCodeMap[code].label,
    value: code
  }
})

// iTunes search API uses ISO 3166 country codes: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2
const podcastSearchRegionMap = {
  au: { label: 'Australia' },
  br: { label: 'Brasil' },
  be: { label: 'België / Belgique / Belgien' },
  cz: { label: 'Česko' },
  dk: { label: 'Danmark' },
  de: { label: 'Deutschland' },
  ee: { label: 'Eesti' },
  es: { label: 'España / Espanya / Espainia' },
  fr: { label: 'France' },
  hr: { label: 'Hrvatska' },
  il: { label: 'ישראל / إسرائيل' },
  it: { label: 'Italia' },
  lu: { label: 'Luxembourg / Luxemburg / Lëtezebuerg' },
  hu: { label: 'Magyarország' },
  nl: { label: 'Nederland' },
  no: { label: 'Norge' },
  nz: { label: 'New Zealand' },
  at: { label: 'Österreich' },
  pl: { label: 'Polska' },
  pt: { label: 'Portugal' },
  ru: { label: 'Россия' },
  ch: { label: 'Schweiz / Suisse / Svizzera' },
  se: { label: 'Sverige' },
  vn: { label: 'Việt Nam' },
  ua: { label: 'Україна' },
  gb: { label: 'United Kingdom' },
  us: { label: 'United States' },
  cn: { label: '中国' }
}
Vue.prototype.$podcastSearchRegionOptions = Object.keys(podcastSearchRegionMap).map((code) => {
  return {
    text: podcastSearchRegionMap[code].label,
    value: code
  }
})

Vue.prototype.$languageCodes = {
  default: defaultCode, // en-us
  current: defaultCode, // Current language code in use
  local: null, // Language code set at user level
  server: null // Language code set at server level
}

// Currently loaded strings (default enUS)
Vue.prototype.$strings = { ...enUsStrings }

/**
 * Get string and substitute
 *
 * @param {string} key
 * @param {string[]} [subs=[]]
 * @returns {string}
 */
Vue.prototype.$getString = (key, subs = []) => {
  if (!Vue.prototype.$strings[key]) return ''
  if (subs?.length && Array.isArray(subs)) {
    return supplant(Vue.prototype.$strings[key], subs)
  }
  return Vue.prototype.$strings[key]
}

Vue.prototype.$formatNumber = (num) => {
  return Intl.NumberFormat(Vue.prototype.$languageCodes.current).format(num)
}

const translations = {
  [defaultCode]: enUsStrings
}

function loadTranslationStrings(code) {
  return new Promise((resolve) => {
    import(`../strings/${code}`)
      .then((fileContents) => {
        resolve(fileContents.default)
      })
      .catch((error) => {
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

  const strings = translations[code] || (await loadTranslationStrings(code))
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

  Vue.prototype.$setDateFnsLocale(languageCodeMap[code].dateFnsLocale)

  this?.$eventBus?.$emit('change-lang', code)
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
