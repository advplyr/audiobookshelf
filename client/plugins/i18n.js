import Vue from "vue"
import enUsStrings from '../strings/en-us.json'

const defaultCode = 'en-us'

function supplant(str, subs) {
  // source: http://crockford.com/javascript/remedial.html
  return str.replace(/{([^{}]*)}/g,
    function (a, b) {
      var r = subs[b]
      return typeof r === 'string' || typeof r === 'number' ? r : a
    }
  )
}

Vue.prototype.$i18nCode = ''
Vue.prototype.$strings = enUsStrings
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
  if (Vue.prototype.$i18nCode == code) {
    // already set
    return
  }
  const strings = translations[code] || await loadTranslationStrings(code)
  if (!strings) {
    console.warn(`Invalid lang code ${code}`)
    return
  }

  translations[code] = strings
  Vue.prototype.$i18nCode = code

  for (const key in Vue.prototype.$strings) {
    Vue.prototype.$strings[key] = strings[key] || translations[defaultCode][key]
  }
  console.log('i18n strings=', Vue.prototype.$strings)
}

Vue.prototype.$i18nUpdate = loadi18n

const localLanguage = localStorage.getItem('lang')
if (localLanguage !== defaultCode) {
  loadi18n(localLanguage)
}