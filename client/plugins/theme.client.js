import Vue from 'vue'

export const THEME_STORAGE_KEY = 'abs-theme'
export const DEFAULT_THEME = 'classic'

// Swatches only drive the picker preview; the real palettes live in assets/themes.css
// Keep the ids in sync with the first-paint script in nuxt.config.js
export const THEMES = [
  { id: 'classic', labelKey: 'LabelThemeClassic', swatch: { bg: '#373838', surface: '#232323', accent: '#1ad691' } },
  { id: 'midnight', labelKey: 'LabelThemeMidnight', swatch: { bg: '#171a21', surface: '#1f232c', accent: '#e8a75a' } },
  { id: 'forest', labelKey: 'LabelThemeForest', swatch: { bg: '#141b17', surface: '#1a231e', accent: '#a9cf7c' } },
  { id: 'ocean', labelKey: 'LabelThemeOcean', swatch: { bg: '#0f1620', surface: '#141d2a', accent: '#5fb4f2' } },
  { id: 'dusk', labelKey: 'LabelThemeDusk', swatch: { bg: '#1a1519', surface: '#221b21', accent: '#ee93a8' } },
  { id: 'oled', labelKey: 'LabelThemeOled', swatch: { bg: '#000000', surface: '#0b0b0c', accent: '#e8a75a' } }
]

const isKnownTheme = (id) => THEMES.some((theme) => theme.id === id)

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    return isKnownTheme(stored) ? stored : DEFAULT_THEME
  } catch (error) {
    console.warn('[Theme] Unable to read stored theme', error)
    return DEFAULT_THEME
  }
}

// Midnight is the CSS base (:root), so it is the only theme without a data-theme attribute
const BASE_THEME = 'midnight'

function applyTheme(id) {
  const root = document.documentElement
  if (id === BASE_THEME) root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', id)
}

export default (context, inject) => {
  const state = Vue.observable({ current: readStoredTheme() })
  applyTheme(state.current)

  const setTheme = (id) => {
    if (!isKnownTheme(id)) {
      console.error('[Theme] Unknown theme', id)
      return
    }
    state.current = id
    applyTheme(id)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, id)
    } catch (error) {
      console.warn('[Theme] Unable to persist theme', error)
    }
  }

  inject('theme', { state, themes: THEMES, setTheme })
}
