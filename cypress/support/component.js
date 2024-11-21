// ***********************************************************
// This example support/component.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************
import '../../assets/app.css'
import './tailwind.compiled.css'
// Import commands.js using ES2015 syntax:
import './commands'
import Vue from 'vue'

import { Constants } from '../../plugins/constants'
import Strings from '../../strings/en-us.json'
import '../../plugins/utils'
import '../../plugins/init.client'

import { mount } from 'cypress/vue2'

//Cypress.Commands.add('mount', mount)
Cypress.Commands.add('mount', (component, options = {}) => {

  Vue.prototype.$constants = Constants
  Vue.prototype.$strings = Strings

  return mount(component, options)
})

// Example use:
// cy.mount(MyComponent)