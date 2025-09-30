export const state = () => ({
  isDarkMode: true
})

export const mutations = {
  setDarkMode(state, isDark) {
    state.isDarkMode = isDark
  },
  toggleTheme(state) {
    console.log('Is Dark Mode State', state.isDarkMode)
    state.isDarkMode = !state.isDarkMode
  }
}

export const actions = {
  initializeTheme({ commit, dispatch }) {
    // Check localStorage for saved theme preference
    const savedTheme = localStorage.getItem('audiobookshelf_theme')
    if (savedTheme) {
      const isDark = savedTheme === 'dark'
      commit('setDarkMode', isDark)
      dispatch('applyTheme', isDark)
    } else {
      // Default to dark mode (matches your current app design)
      // or check system preference: const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      commit('setDarkMode', true)
      dispatch('applyTheme', true)
    }
  },
  toggleTheme({ commit, state, dispatch }) {
    const newTheme = !state.isDarkMode
    commit('setDarkMode', newTheme)
    localStorage.setItem('audiobookshelf_theme', newTheme ? 'dark' : 'light')
    dispatch('applyTheme', newTheme)
  },
  applyTheme({}, isDark) {
    // Apply theme class to document
    if (isDark) {
      document.documentElement.classList.add('dark')
      document.documentElement.classList.remove('light')
    } else {
      document.documentElement.classList.add('light')
      document.documentElement.classList.remove('dark')
    }

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name=theme-color]')
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', isDark ? '#232323' : '#ffffff')
    }
  }
}

export const getters = {
  isDarkMode: (state) => state.isDarkMode
}
