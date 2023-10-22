const { defineConfig } = require("cypress");

module.exports = defineConfig({
  defaultCommandTimeout: 4000,
  e2e: {
    baseUrl: 'http://localhost:3333',
    excludeSpecPattern: ["./cypress/e2e/00-initializeDatabaseWithGui.cy.js"], // Uncomment to use API to initialize
    // excludeSpecPattern: ["./cypress/e2e/00-initializeDatabaseWithApi.cy.js"], // Uncomment to use GUI to initialize
    screenshotOnRunFailure: false,
    setupNodeEvents(on, config) {
      require('@cypress/code-coverage/task')(on, config)
      on('file:preprocessor', require('@cypress/code-coverage/use-babelrc'))
      return config
    },
  },
  env: {
    ADMIN_USERNAME: 'root',
    ADMIN_PASSWORD: 'password',
    USER_USERNAME: 'user123',
    USER_PASSWORD: 'user123',
    AUDIOBOOK_LIBRARY_NAME: 'Audiobooks',
    AUDIOBOOK_LIBRARY_PATH: './cypress/fixtures/audiobooks',
    "codeCoverage": {
      "url": "http://localhost:3333/__coverage__",
    }
  },
  retries: {
    runMode: 2,
    openMode: 0,
  },
});
