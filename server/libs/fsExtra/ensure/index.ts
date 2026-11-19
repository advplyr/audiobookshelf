import file from './file'
import link from './link'
import symlink from './symlink'

const { createFile, createFileSync } = file
const { createLink, createLinkSync } = link
const { createSymlink, createSymlinkSync } = symlink

export = {
  // file
  createFile,
  createFileSync,
  ensureFile: createFile,
  ensureFileSync: createFileSync,
  // link
  createLink,
  createLinkSync,
  ensureLink: createLink,
  ensureLinkSync: createLinkSync,
  // symlink
  createSymlink,
  createSymlinkSync,
  ensureSymlink: createSymlink,
  ensureSymlinkSync: createSymlinkSync
}
