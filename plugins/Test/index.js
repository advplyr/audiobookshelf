const PluginAbstract = require('../../server/PluginAbstract')

class TestPlugin extends PluginAbstract {
  constructor() {
    super()

    this.name = 'Test'
  }

  init(context) {
    context.Logger.info('[TestPlugin] Test plugin loaded successfully')
  }

  async onAction(context, actionName, target, data) {
    context.Logger.info('[TestPlugin] Test plugin onAction', actionName, target, data)
  }
}
module.exports = new TestPlugin()
