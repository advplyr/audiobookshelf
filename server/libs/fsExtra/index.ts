import fs from './fs'
import copy from './copy'
import empty from './empty'
import ensure from './ensure'
import mkdirs from './mkdirs'
import move from './move'
import pathExists from './path-exists'
import remove from './remove'

export = {
  // Export promiseified graceful-fs:
  ...fs,
  // Export extra methods:
  ...copy,
  ...empty,
  ...ensure,
  ...mkdirs,
  ...move,
  ...pathExists,
  ...remove
}
