const PluginAbstract = require('../../../../../server/PluginAbstract')

class ExamplePlugin extends PluginAbstract {
  constructor() {
    super()

    this.name = 'Example'
  }

  init(context) {
    context.Logger.info('[ExamplePlugin] Example plugin loaded successfully')
  }

  async onAction(context, actionName, target, data) {
    context.Logger.info('[ExamplePlugin] Example plugin onAction', actionName, target, data)
  }
}
module.exports = new ExamplePlugin()
