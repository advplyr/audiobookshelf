class PluginAbstract {
  constructor() {
    if (this.constructor === PluginAbstract) {
      throw new Error('Cannot instantiate abstract class')
    }
  }

  init() {
    throw new Error('Method "init()" not implemented')
  }

  onAction() {
    throw new Error('Method "onAction()" not implemented')
  }

  onDestroy() {
    throw new Error('Method "onDestroy()" not implemented')
  }
}
module.exports = PluginAbstract
