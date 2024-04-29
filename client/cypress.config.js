const { defineConfig } = require("cypress")

module.exports = defineConfig({
  component: {
    devServer: {
      framework: "nuxt",
      bundler: "webpack"
    }
  }
})
