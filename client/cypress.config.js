const { defineConfig } = require('cypress')

module.exports = defineConfig({
  component: {
    devServer: {
      framework: 'nuxt',
      bundler: 'vite'
    },
    specPattern: 'cypress/tests/**/*.cy.js'
  }
})
