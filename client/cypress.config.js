const { defineConfig } = require("cypress")

module.exports = defineConfig({
  component: {
    devServer: {
      framework: "nuxt",
      bundler: "webpack"
    },
    specPattern: "cypress/tests/**/*.cy.js"
  }
})
