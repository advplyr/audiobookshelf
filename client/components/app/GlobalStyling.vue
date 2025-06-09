<template>
  <div></div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'GlobalStyling',
  computed: {
    ...mapGetters(['getServerStyling'])
  },
  methods: {
    applyColors() {
      const styling = this.getServerStyling
      if (!styling) return

      // Create a style element if it doesn't exist
      let styleEl = document.getElementById('custom-colors')
      if (!styleEl) {
        styleEl = document.createElement('style')
        styleEl.id = 'custom-colors'
        document.head.appendChild(styleEl)
      }

      // Update CSS variables
      const css = `
        :root {
          --color-primary: ${styling.primary};
          --color-primary-dark: ${styling.primaryDark};
          --color-success: ${styling.success};
          --color-warning: ${styling.warning};
          --color-error: ${styling.error};
          --color-info: ${styling.info};
          --color-bg: ${styling.background};
        }
      `
      styleEl.innerHTML = css
    }
  },
  mounted() {
    this.applyColors()
  },
  watch: {
    getServerStyling: {
      handler() {
        this.applyColors()
      },
      deep: true
    }
  }
}
</script> 