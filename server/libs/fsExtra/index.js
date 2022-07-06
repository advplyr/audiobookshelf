'use strict'

module.exports = {
  // Export promiseified graceful-fs:
  ...require('./fs'),
  // Export extra methods:
  ...require('./copy'),
  ...require('./empty'),
  ...require('./ensure'),
  ...require('./mkdirs'),
  ...require('./move'),
  ...require('./path-exists'),
  ...require('./remove')
}
